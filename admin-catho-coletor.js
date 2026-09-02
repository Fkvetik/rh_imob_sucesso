const SUPABASE_URL = "https://lrejfhsomfxyaoshmpzz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y";

const $ = (id) => document.getElementById(id);
let ADMIN_PASS = sessionStorage.getItem("catho_admin_pass") || "";

async function rpc(name, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY
    },
    body: JSON.stringify(body || {})
  });
  const data = await r.json().catch(() => ({ ok:false, error:"Resposta inválida" }));
  if (!r.ok) throw new Error(data?.message || data?.error || ("HTTP " + r.status));
  return data;
}

function showApp() {
  $("loginCard").classList.add("hide");
  $("appArea").classList.remove("hide");
  loadUsuarios();
  refreshStatusColeta();
  loadAdmins();
  loadAuditLog();
  loadLogsExtensao();
  loadContasPlataforma().then(() => { loadUsuariosPlataforma(); renderWhoInfo(); });
  loadContasRhi().then(() => { loadUsuariosRhi(); });
}

// ===== Log de auditoria (Fase 12) =====
async function loadAuditLog() {
  const tbody = $("listaAudit");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6"><small>Carregando...</small></td></tr>';
  const loginFiltro = $("filtroLoginAudit").value.trim() || null;
  try {
    const resp = await rpc("rpc_admin_lead_events", { p_admin_password: ADMIN_PASS, p_limit: 100, p_login_filtro: loginFiltro });
    if (!resp.ok) { tbody.innerHTML = `<tr><td colspan="6">❌ ${esc(resp.error)}</td></tr>`; return; }
    const eventos = resp.eventos || [];
    if (!eventos.length) { tbody.innerHTML = '<tr><td colspan="6"><small>Nenhum evento registrado ainda.</small></td></tr>'; return; }
    tbody.innerHTML = eventos.map(e => `
      <tr>
        <td><small>${esc(new Date(e.criado_em).toLocaleString('pt-BR'))}</small></td>
        <td>${esc(e.login)}</td>
        <td>${esc(e.lead_nome || ('#' + e.lead_id))}</td>
        <td>${esc(e.tipo)}</td>
        <td><small>${esc(e.status_anterior || '—')} → ${esc(e.status_novo || '—')}</small></td>
        <td><small>${esc(e.detalhe || '')}</small></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">❌ ${esc(e.message)}</td></tr>`;
  }
}

$("btnAtualizarAudit")?.addEventListener("click", loadAuditLog);

// ===== Log remoto da extensão (warn/error, projeto RHI) =====
let LOGS_EXTENSAO_CACHE = [];

async function apiLogsExtensao(login, nivel) {
  const params = new URLSearchParams({ token: ADMIN_PASS, limite: "300" });
  if (login) params.set("login", login);
  if (nivel) params.set("nivel", nivel);
  const r = await fetch("/api/logs-extensao?" + params.toString());
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || "Falha ao carregar logs da extensão");
  return data;
}

async function loadLogsExtensao() {
  const tbody = $("listaLogsExtensao");
  const msg = $("logsExtensaoMsg");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6"><small>Carregando...</small></td></tr>';
  const login = $("filtroLoginLogs")?.value.trim() || null;
  const nivel = $("filtroNivelLogs")?.value || null;
  try {
    const resp = await apiLogsExtensao(login, nivel);
    LOGS_EXTENSAO_CACHE = resp.logs || [];
    if (!LOGS_EXTENSAO_CACHE.length) {
      tbody.innerHTML = '<tr><td colspan="6"><small>Nenhum warn/error registrado nos últimos 7 dias.</small></td></tr>';
      msg.textContent = "";
      return;
    }
    tbody.innerHTML = LOGS_EXTENSAO_CACHE.map(l => `
      <tr>
        <td><small>${esc(new Date(l.criado_em).toLocaleString('pt-BR'))}</small></td>
        <td>${esc(l.login || '—')}</td>
        <td>${l.nivel === 'error' ? '🔴' : '🟡'} ${esc(l.nivel)}</td>
        <td>${esc(l.mensagem)}</td>
        <td><small>${esc(l.detalhe || '')}</small></td>
        <td><small>${esc(l.versao || '')}</small></td>
      </tr>
    `).join('');
    msg.textContent = LOGS_EXTENSAO_CACHE.length + " registro(s).";
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">❌ ${esc(e.message)}</td></tr>`;
  }
}

function copiarLogsExtensao() {
  if (!LOGS_EXTENSAO_CACHE.length) return;
  const texto = LOGS_EXTENSAO_CACHE.map(l =>
    `[${new Date(l.criado_em).toLocaleString('pt-BR')}] ${l.login || '—'} ${l.nivel.toUpperCase()} — ${l.mensagem}${l.detalhe ? ' | ' + l.detalhe : ''}`
  ).join('\n');
  navigator.clipboard.writeText(texto).then(() => {
    $("logsExtensaoMsg").textContent = "📋 Copiado (" + LOGS_EXTENSAO_CACHE.length + " linha(s)).";
  }).catch(() => {
    $("logsExtensaoMsg").textContent = "❌ Não consegui copiar automaticamente — selecione manualmente.";
  });
}

$("btnAtualizarLogs")?.addEventListener("click", loadLogsExtensao);
$("btnCopiarLogs")?.addEventListener("click", copiarLogsExtensao);

// ===== Contas da Plataforma (Novos Talentos) =====
// Lidas via /api/contas (server-side, service_role), autenticado com a
// MESMA senha de admin já usada pra entrar neste painel — não existe mais
// um segundo token separado que precisasse ser pedido/guardado à parte.
let CONTAS_CACHE = [];

async function apiContas(payload) {
  const login = (CURRENT_ADMIN && CURRENT_ADMIN.login) || "";
  const url = "/api/contas?token=" + encodeURIComponent(ADMIN_PASS) + "&login=" + encodeURIComponent(login);
  const opts = payload
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    : undefined;
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || "Falha na API de contas");
  return data;
}

async function loadContasPlataforma() {
  const sel = $("fContaPlataforma");
  const msg = $("contasMsg");
  if (!sel) return;

  try {
    const data = await apiContas(null);
    CONTAS_CACHE = data.contas || [];
    sel.innerHTML = '<option value="">— sem vínculo —</option>' +
      CONTAS_CACHE.map(c => `<option value="${esc(c.conta_id)}">${esc(c.nome_conta || c.conta_id)}</option>`).join("");
    // Fase 10.4: mesma lista de empresas também alimenta o formulário de Admin
    // (define se o admin fica restrito a uma empresa ou é super-admin).
    const selAdm = $("admConta");
    if (selAdm) {
      selAdm.innerHTML = '<option value="">— nenhuma (super-admin, vê e gerencia todas as empresas) —</option>' +
        CONTAS_CACHE.map(c => `<option value="${esc(c.conta_id)}">${esc(c.nome_conta || c.conta_id)}</option>`).join("");
    }
    msg.textContent = CONTAS_CACHE.length + " conta(s) carregada(s).";
    renderContas();
  } catch (e) {
    msg.textContent = "❌ " + e.message;
  }
}

function renderContas() {
  const tbody = $("listaContas");
  if (!tbody) return;
  if (!CONTAS_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="6"><small>Nenhuma conta carregada.</small></td></tr>';
    return;
  }
  tbody.innerHTML = CONTAS_CACHE.map(c => {
    const consumido = c.consumidos ?? 0; // nome do campo vem de /api/contas
    const limite = c.limite_total ?? 0;
    const perto = limite && consumido / limite >= 0.8;
    return `
    <tr>
      <td>${esc(c.nome_conta || c.conta_id)}<br><small style="color:#999">${esc(c.conta_id)}</small></td>
      <td><span class="badge ${c.status === 'ATIVA' ? '' : 'bloqueado'}">${esc(c.status || '-')}</span></td>
      <td${perto ? ' style="color:#c2410c;font-weight:700"' : ''}>${consumido}${limite ? ' / ' + limite : ''}</td>
      <td><input class="limTotal" data-conta="${esc(c.conta_id)}" type="number" min="0" value="${limite}" style="width:90px;margin:0"></td>
      <td><input class="limUser" data-conta="${esc(c.conta_id)}" type="number" min="0" value="${c.limite_por_usuario ?? 0}" style="width:90px;margin:0"></td>
      <td style="white-space:nowrap">
        <button class="salvarLimBtn" data-conta="${esc(c.conta_id)}" style="padding:4px 8px;font-size:11px">Salvar</button>
        <button class="${c.status === 'ATIVA' ? 'danger' : 'secondary'} statusContaBtn" data-conta="${esc(c.conta_id)}" data-status="${esc(c.status||'')}" data-nome="${esc(c.nome_conta||c.conta_id)}" style="padding:4px 8px;font-size:11px">${c.status === 'ATIVA' ? 'Desativar' : 'Ativar'}</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".salvarLimBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const conta = btn.dataset.conta;
      const total = tbody.querySelector(`.limTotal[data-conta="${CSS.escape(conta)}"]`).value;
      const porUser = tbody.querySelector(`.limUser[data-conta="${CSS.escape(conta)}"]`).value;
      btn.disabled = true;
      $("contasEditMsg").textContent = "Salvando...";
      try {
        await apiContas({ acao: "editar_conta", conta_id: conta, limite_total: total, limite_por_usuario: porUser });
        $("contasEditMsg").textContent = "✅ Limite atualizado para " + conta;
        await loadContasPlataforma();
      } catch (e) {
        $("contasEditMsg").textContent = "❌ " + e.message;
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Empresa não tem "excluir" de verdade — apagar quebraria o histórico de
  // consumo (nt_talento_consumos referencia a conta) e os usuários vinculados.
  // Desativar é o equivalente seguro: some das opções de vínculo, mas nada
  // se perde e dá pra reverter.
  tbody.querySelectorAll(".statusContaBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const vaiDesativar = btn.dataset.status === "ATIVA";
      const msg = vaiDesativar
        ? `Desativar "${btn.dataset.nome}"?\n\nOs usuários dela deixam de conseguir abrir o pool. Nada é apagado — o histórico de consumo continua, e dá pra reativar depois.`
        : `Reativar "${btn.dataset.nome}"?`;
      if (!confirm(msg)) return;
      btn.disabled = true;
      try {
        await apiContas({ acao: "editar_conta", conta_id: btn.dataset.conta, status: vaiDesativar ? "INATIVA" : "ATIVA" });
        await loadContasPlataforma();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });
}

$("btnRefreshContas")?.addEventListener("click", loadContasPlataforma);

// ===== Usuários da plataforma (CRUD completo, sem sair deste painel) =====
let USUARIOS_PLAT_CACHE = [];

function preencherSelectContas(sel, valorAtual) {
  if (!sel) return;
  sel.innerHTML = '<option value="">— escolha —</option>' +
    CONTAS_CACHE.map(c => `<option value="${esc(c.conta_id)}">${esc(c.nome_conta || c.conta_id)}</option>`).join("");
  if (valorAtual) sel.value = valorAtual;
}

async function loadUsuariosPlataforma() {
  const tbody = $("listaUsuariosPlataforma");
  if (!tbody) return;
  try {
    const data = await apiContas(null);
    CONTAS_CACHE = data.contas || CONTAS_CACHE;
    USUARIOS_PLAT_CACHE = data.usuarios || [];
    preencherSelectContas($("puConta"), $("puConta")?.value);
    renderUsuariosPlataforma();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6"><small>❌ ${esc(e.message)}</small></td></tr>`;
  }
}

function nomeDaConta(contaId) {
  const c = CONTAS_CACHE.find(x => x.conta_id === contaId);
  return c ? (c.nome_conta || c.conta_id) : (contaId || "—");
}

function renderUsuariosPlataforma() {
  const tbody = $("listaUsuariosPlataforma");
  if (!tbody) return;
  if (!USUARIOS_PLAT_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="6"><small>Nenhum usuário cadastrado na plataforma ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = USUARIOS_PLAT_CACHE.map(u => {
    const ativo = String(u.status || "").toUpperCase() === "ATIVO";
    return `
    <tr>
      <td>${esc(u.nome || "—")}</td>
      <td><small>${esc(u.email_login || "—")}</small></td>
      <td><small>${esc(nomeDaConta(u.conta_id))}</small></td>
      <td><small>${esc(u.perfil || "—")}</small></td>
      <td><span class="badge ${ativo ? "" : "bloqueado"}">${ativo ? "Ativo" : "Inativo"}</span></td>
      <td style="white-space:nowrap">
        <button data-id="${esc(u.usuario_id)}" class="ghost puEditBtn" style="padding:4px 8px;font-size:11px">Editar</button>
        <button data-id="${esc(u.usuario_id)}" data-ativo="${ativo}" class="${ativo ? "danger" : "secondary"} puToggleBtn" style="padding:4px 8px;font-size:11px">${ativo ? "Desativar" : "Ativar"}</button>
        <button data-id="${esc(u.usuario_id)}" data-senha="${esc(u.senha_temporaria || "")}" class="ghost puVerSenhaBtn" style="padding:4px 8px;font-size:11px">Ver senha</button>
        <button data-id="${esc(u.usuario_id)}" class="ghost puSenhaBtn" style="padding:4px 8px;font-size:11px">Redefinir senha</button>
        <button data-id="${esc(u.usuario_id)}" data-nome="${esc(u.nome || u.email_login || "")}" class="danger puExcluirBtn" style="padding:4px 8px;font-size:11px">Excluir</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".puExcluirBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Excluir "${btn.dataset.nome}" da plataforma?\n\nIsso apaga o login e o vínculo com a empresa. O histórico de contatos já consumidos por essa pessoa continua registrado.\n\nSe ela também é operadora da extensão, desvincule o acesso no cadastro dela depois.`)) return;
      btn.disabled = true;
      try {
        await apiContas({ acao: "excluir_usuario", usuario_id: btn.dataset.id });
        await loadUsuariosPlataforma();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".puEditBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const u = USUARIOS_PLAT_CACHE.find(x => String(x.usuario_id) === btn.dataset.id);
      if (!u) return;
      $("puUsuarioId").value = u.usuario_id;
      $("puNome").value = u.nome || "";
      $("puEmail").value = u.email_login || "";
      $("puEmail").disabled = true; // e-mail é o login no Auth — não muda por aqui
      preencherSelectContas($("puConta"), u.conta_id);
      $("puConta").disabled = true;  // trocar de empresa exige recriar o vínculo
      $("puPerfil").value = u.perfil || "OPERADOR";
      $("puStatus").value = String(u.status || "ATIVO").toUpperCase();
      $("puSenha").value = "";
      $("puSenhaLabel").textContent = "Senha (deixe em branco pra manter)";
      $("puMsg").textContent = "Editando: " + (u.nome || u.email_login);
      $("puNome").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  tbody.querySelectorAll(".puToggleBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const novoStatus = btn.dataset.ativo === "true" ? "INATIVO" : "ATIVO";
      if (!confirm(`Mudar status para ${novoStatus}?`)) return;
      btn.disabled = true;
      try {
        await apiContas({ acao: "alterar_status_usuario", usuario_id: btn.dataset.id, status: novoStatus });
        await loadUsuariosPlataforma();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".puVerSenhaBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const senha = btn.dataset.senha;
      if (senha) {
        alert("🔑 Senha atual salva: " + senha);
      } else {
        alert("⚠️ Essa conta não tem senha salva como referência (foi criada antes desse recurso existir, ou por fora do painel).\n\nUse \"Redefinir senha\" pra definir uma nova — a partir daí ela já fica visível aqui.");
      }
    });
  });

  tbody.querySelectorAll(".puSenhaBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nova = prompt("Nova senha (mínimo 6 caracteres):", Math.random().toString(36).slice(2, 10) + "A1");
      if (!nova) return;
      if (nova.length < 6) { alert("Senha muito curta."); return; }
      try {
        await apiContas({ acao: "resetar_senha_usuario", usuario_id: btn.dataset.id, senha: nova });
        alert("✅ Senha redefinida: " + nova + "\n\nSe este usuário também é operador da extensão, atualize o campo \"Senha da plataforma\" no cadastro dele — senão o acesso automático ao pool para de funcionar.");
        loadUsuariosPlataforma();
      } catch (e) {
        alert("❌ " + e.message);
      }
    });
  });
}

$("btnGerarSenhaPu")?.addEventListener("click", () => {
  $("puSenha").value = Math.random().toString(36).slice(2, 10) + "A1";
});

$("btnLimparUsuarioPlataforma")?.addEventListener("click", () => {
  $("puUsuarioId").value = "";
  $("puNome").value = "";
  $("puEmail").value = "";
  $("puEmail").disabled = false;
  $("puConta").disabled = false;
  preencherSelectContas($("puConta"), "");
  $("puPerfil").value = "OPERADOR";
  $("puStatus").value = "ATIVO";
  $("puSenha").value = "";
  $("puSenhaLabel").textContent = "Senha inicial";
  $("puMsg").textContent = "";
});

$("btnSalvarUsuarioPlataforma")?.addEventListener("click", async () => {
  const id = $("puUsuarioId").value;
  const nome = $("puNome").value.trim();
  const email = $("puEmail").value.trim().toLowerCase();
  const conta = $("puConta").value;
  const perfil = $("puPerfil").value;
  const status = $("puStatus").value;
  const senha = $("puSenha").value.trim();
  const msg = $("puMsg");

  if (!nome) { msg.textContent = "❌ Informe o nome."; return; }

  msg.textContent = "Salvando...";
  try {
    if (id) {
      await apiContas({ acao: "editar_usuario", usuario_id: id, nome, perfil, status });
      if (senha) {
        if (senha.length < 6) { msg.textContent = "❌ Senha deve ter ao menos 6 caracteres."; return; }
        await apiContas({ acao: "resetar_senha_usuario", usuario_id: id, senha });
      }
      msg.textContent = "✅ Usuário atualizado.";
    } else {
      if (!conta) { msg.textContent = "❌ Escolha a empresa."; return; }
      if (!email) { msg.textContent = "❌ Informe o e-mail."; return; }
      if (senha.length < 6) { msg.textContent = "❌ Senha deve ter ao menos 6 caracteres."; return; }
      await apiContas({ acao: "criar_usuario", conta_id: conta, nome, email_login: email, senha, perfil });
      if (status !== "ATIVO") {
        await loadUsuariosPlataforma();
        const novo = USUARIOS_PLAT_CACHE.find(u => (u.email_login || "").toLowerCase() === email);
        if (novo) await apiContas({ acao: "alterar_status_usuario", usuario_id: novo.usuario_id, status });
      }
      msg.textContent = "✅ Usuário criado. Senha: " + senha;
    }
    $("btnLimparUsuarioPlataforma").click();
    await loadUsuariosPlataforma();
  } catch (e) {
    msg.textContent = "❌ " + e.message;
  }
});

$("btnRefreshUsuariosPlataforma")?.addEventListener("click", loadUsuariosPlataforma);

// ===== Banco de Corretores CRECI (projeto RHI) — mesmo padrão do bloco
// acima (Novos Talentos), só que chamando /api/contas-rhi. Mais simples:
// esse projeto não tem conceito de "plano" nem produto_codigo (é dedicado
// só a isso), e o CRUD de conta/usuário é mais enxuto por causa disso.
let CONTAS_RHI_CACHE = [];
let USUARIOS_RHI_CACHE = [];

async function apiContasRhi(payload) {
  const url = "/api/contas-rhi?token=" + encodeURIComponent(ADMIN_PASS);
  const opts = payload
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    : undefined;
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || "Falha na API de contas do Corretores CRECI");
  return data;
}

async function loadContasRhi() {
  const tbody = $("listaContasRhi");
  if (!tbody) return;
  try {
    const data = await apiContasRhi(null);
    CONTAS_RHI_CACHE = data.contas || [];
    USUARIOS_RHI_CACHE = data.usuarios || CONTAS_RHI_CACHE.usuarios || [];
    renderContasRhi();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5"><small>❌ ${esc(e.message)}</small></td></tr>`;
  }
}

function renderContasRhi() {
  const tbody = $("listaContasRhi");
  if (!tbody) return;
  if (!CONTAS_RHI_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="5"><small>Nenhuma empresa cadastrada ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = CONTAS_RHI_CACHE.map(c => {
    const consumido = c.consumidos ?? 0;
    const limite = c.limite_leads ?? 0;
    const perto = limite && consumido / limite >= 0.8;
    const ativa = String(c.status || "").toUpperCase() === "ATIVA";
    return `
    <tr>
      <td>${esc(c.nome_empresa || c.id)}<br><small style="color:#999">${esc(c.id)}</small></td>
      <td><span class="badge ${ativa ? '' : 'bloqueado'}">${esc(c.status || '-')}</span></td>
      <td${perto ? ' style="color:#c2410c;font-weight:700"' : ''}>${consumido}${limite ? ' / ' + limite : ''}</td>
      <td><input class="limLeadsRhi" data-conta="${esc(c.id)}" type="number" min="0" value="${limite}" style="width:100px;margin:0"></td>
      <td style="white-space:nowrap">
        <button class="salvarLimRhiBtn" data-conta="${esc(c.id)}" style="padding:4px 8px;font-size:11px">Salvar</button>
        <button class="${ativa ? 'danger' : 'secondary'} statusContaRhiBtn" data-conta="${esc(c.id)}" data-status="${esc(c.status||'')}" data-nome="${esc(c.nome_empresa||c.id)}" style="padding:4px 8px;font-size:11px">${ativa ? 'Desativar' : 'Ativar'}</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".salvarLimRhiBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const conta = btn.dataset.conta;
      const limite = tbody.querySelector(`.limLeadsRhi[data-conta="${CSS.escape(conta)}"]`).value;
      btn.disabled = true;
      $("contasRhiEditMsg").textContent = "Salvando...";
      try {
        await apiContasRhi({ acao: "editar_conta", conta_id: conta, limite_leads: limite });
        $("contasRhiEditMsg").textContent = "✅ Limite atualizado.";
        await loadContasRhi();
      } catch (e) {
        $("contasRhiEditMsg").textContent = "❌ " + e.message;
      } finally {
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".statusContaRhiBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const vaiDesativar = btn.dataset.status === "ATIVA";
      const msg = vaiDesativar
        ? `Desativar "${btn.dataset.nome}"?\n\nOs usuários dela deixam de conseguir liberar corretores. Nada é apagado — dá pra reativar depois.`
        : `Reativar "${btn.dataset.nome}"?`;
      if (!confirm(msg)) return;
      btn.disabled = true;
      try {
        await apiContasRhi({ acao: "editar_conta", conta_id: btn.dataset.conta, status: vaiDesativar ? "INATIVA" : "ATIVA" });
        await loadContasRhi();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });
}

$("btnRefreshContasRhi")?.addEventListener("click", loadContasRhi);

$("btnNovaEmpresaRhi")?.addEventListener("click", () => {
  $("formNovaEmpresaRhi").classList.toggle("hide");
});
$("btnCancelarEmpresaRhi")?.addEventListener("click", () => {
  $("formNovaEmpresaRhi").classList.add("hide");
  $("novaEmpresaRhiMsg").textContent = "";
});
$("btnSalvarEmpresaRhi")?.addEventListener("click", async () => {
  const nome = $("rncNome").value.trim();
  if (!nome) { $("novaEmpresaRhiMsg").textContent = "❌ Informe o nome da empresa."; return; }
  $("novaEmpresaRhiMsg").textContent = "Criando...";
  try {
    await apiContasRhi({
      acao: "criar_conta",
      nome_empresa: nome,
      telefone: $("rncTelefone").value.trim(),
      limite_leads: $("rncLimLeads").value,
      usuarios_contratados: $("rncUsuarios").value,
      status: "ATIVA"
    });
    $("novaEmpresaRhiMsg").textContent = "✅ Empresa criada.";
    $("rncNome").value = "";
    await loadContasRhi();
  } catch (e) {
    $("novaEmpresaRhiMsg").textContent = "❌ " + e.message;
  }
});

function preencherSelectContasRhi(sel, valorAtual) {
  if (!sel) return;
  sel.innerHTML = '<option value="">— escolha —</option>' +
    CONTAS_RHI_CACHE.map(c => `<option value="${esc(c.id)}">${esc(c.nome_empresa || c.id)}</option>`).join("");
  if (valorAtual) sel.value = valorAtual;
}

async function loadUsuariosRhi() {
  const tbody = $("listaUsuariosRhi");
  if (!tbody) return;
  try {
    const data = await apiContasRhi(null);
    CONTAS_RHI_CACHE = data.contas || CONTAS_RHI_CACHE;
    USUARIOS_RHI_CACHE = data.usuarios || [];
    preencherSelectContasRhi($("ruConta"), $("ruConta")?.value);
    renderUsuariosRhi();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6"><small>❌ ${esc(e.message)}</small></td></tr>`;
  }
}

function nomeDaContaRhi(contaId) {
  const c = CONTAS_RHI_CACHE.find(x => x.id === contaId);
  return c ? (c.nome_empresa || c.id) : (contaId || "—");
}

function renderUsuariosRhi() {
  const tbody = $("listaUsuariosRhi");
  if (!tbody) return;
  if (!USUARIOS_RHI_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="6"><small>Nenhum usuário cadastrado ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = USUARIOS_RHI_CACHE.map(u => {
    const ativo = String(u.status || "").toUpperCase() === "ATIVO";
    return `
    <tr>
      <td>${esc(u.nome || "—")}</td>
      <td><small>${esc(u.email || "—")}</small></td>
      <td><small>${esc(nomeDaContaRhi(u.conta_id))}</small></td>
      <td><small>${esc(u.perfil || "—")}</small></td>
      <td><span class="badge ${ativo ? "" : "bloqueado"}">${ativo ? "Ativo" : "Inativo"}</span></td>
      <td style="white-space:nowrap">
        <button data-id="${esc(u.id)}" class="ghost ruEditBtn" style="padding:4px 8px;font-size:11px">Editar</button>
        <button data-id="${esc(u.id)}" data-ativo="${ativo}" class="${ativo ? "danger" : "secondary"} ruToggleBtn" style="padding:4px 8px;font-size:11px">${ativo ? "Desativar" : "Ativar"}</button>
        <button data-id="${esc(u.id)}" class="ghost ruSenhaBtn" style="padding:4px 8px;font-size:11px">Senha</button>
        <button data-id="${esc(u.id)}" data-nome="${esc(u.nome || u.email || "")}" class="danger ruExcluirBtn" style="padding:4px 8px;font-size:11px">Excluir</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".ruExcluirBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Excluir "${btn.dataset.nome}" do Banco de Corretores CRECI?\n\nIsso apaga o login e o vínculo com a empresa.`)) return;
      btn.disabled = true;
      try {
        await apiContasRhi({ acao: "excluir_usuario", usuario_id: btn.dataset.id });
        await loadUsuariosRhi();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".ruEditBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const u = USUARIOS_RHI_CACHE.find(x => String(x.id) === btn.dataset.id);
      if (!u) return;
      $("ruUsuarioId").value = u.id;
      $("ruNome").value = u.nome || "";
      $("ruEmail").value = u.email || "";
      $("ruEmail").disabled = true; // e-mail é o login no Auth — não muda por aqui
      preencherSelectContasRhi($("ruConta"), u.conta_id);
      $("ruConta").disabled = true; // trocar de empresa exige recriar o vínculo
      $("ruPerfil").value = u.perfil || "OPERADOR";
      $("ruStatus").value = String(u.status || "ATIVO").toUpperCase();
      $("ruSenha").value = "";
      $("ruSenhaLabel").textContent = "Senha (deixe em branco pra manter)";
      $("ruMsg").textContent = "Editando: " + (u.nome || u.email);
      $("ruNome").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  tbody.querySelectorAll(".ruToggleBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const novoStatus = btn.dataset.ativo === "true" ? "INATIVO" : "ATIVO";
      if (!confirm(`Mudar status para ${novoStatus}?`)) return;
      btn.disabled = true;
      try {
        await apiContasRhi({ acao: "alterar_status_usuario", usuario_id: btn.dataset.id, status: novoStatus });
        await loadUsuariosRhi();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".ruSenhaBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nova = prompt("Nova senha (mínimo 6 caracteres):", Math.random().toString(36).slice(2, 10) + "A1");
      if (!nova) return;
      if (nova.length < 6) { alert("Senha muito curta."); return; }
      try {
        await apiContasRhi({ acao: "resetar_senha_usuario", usuario_id: btn.dataset.id, senha: nova });
        alert("✅ Senha redefinida: " + nova + "\n\nSe essa pessoa também é operadora da extensão, atualize o campo \"Senha do banco de Corretores CRECI\" no cadastro dela, mais abaixo.");
      } catch (e) {
        alert("❌ " + e.message);
      }
    });
  });
}

$("btnGerarSenhaRu")?.addEventListener("click", () => {
  $("ruSenha").value = Math.random().toString(36).slice(2, 10) + "A1";
});

$("btnLimparUsuarioRhi")?.addEventListener("click", () => {
  $("ruUsuarioId").value = "";
  $("ruNome").value = "";
  $("ruEmail").value = "";
  $("ruEmail").disabled = false;
  $("ruConta").disabled = false;
  preencherSelectContasRhi($("ruConta"), "");
  $("ruPerfil").value = "OPERADOR";
  $("ruStatus").value = "ATIVO";
  $("ruSenha").value = "";
  $("ruSenhaLabel").textContent = "Senha inicial";
  $("ruMsg").textContent = "";
});

$("btnSalvarUsuarioRhi")?.addEventListener("click", async () => {
  const id = $("ruUsuarioId").value;
  const nome = $("ruNome").value.trim();
  const email = $("ruEmail").value.trim().toLowerCase();
  const conta = $("ruConta").value;
  const perfil = $("ruPerfil").value;
  const status = $("ruStatus").value;
  const senha = $("ruSenha").value.trim();
  const msg = $("ruMsg");

  if (!nome) { msg.textContent = "❌ Informe o nome."; return; }

  msg.textContent = "Salvando...";
  try {
    if (id) {
      await apiContasRhi({ acao: "editar_usuario", usuario_id: id, nome, perfil, status });
      if (senha) {
        if (senha.length < 6) { msg.textContent = "❌ Senha deve ter ao menos 6 caracteres."; return; }
        await apiContasRhi({ acao: "resetar_senha_usuario", usuario_id: id, senha });
      }
      msg.textContent = "✅ Usuário atualizado.";
    } else {
      if (!conta) { msg.textContent = "❌ Escolha a empresa."; return; }
      if (!email) { msg.textContent = "❌ Informe o e-mail."; return; }
      if (senha.length < 6) { msg.textContent = "❌ Senha deve ter ao menos 6 caracteres."; return; }
      await apiContasRhi({ acao: "criar_usuario", conta_id: conta, nome, email, senha, perfil });
      if (status !== "ATIVO") {
        await loadUsuariosRhi();
        const novo = USUARIOS_RHI_CACHE.find(u => (u.email || "").toLowerCase() === email);
        if (novo) await apiContasRhi({ acao: "alterar_status_usuario", usuario_id: novo.id, status });
      }
      msg.textContent = "✅ Usuário criado. Senha: " + senha;
    }
    $("btnLimparUsuarioRhi").click();
    await loadUsuariosRhi();
  } catch (e) {
    msg.textContent = "❌ " + e.message;
  }
});

$("btnRefreshUsuariosRhi")?.addEventListener("click", loadUsuariosRhi);

// ===== Nova empresa (conta na plataforma) =====
$("btnNovaEmpresa")?.addEventListener("click", () => {
  $("formNovaEmpresa").classList.toggle("hide");
});
$("btnCancelarEmpresa")?.addEventListener("click", () => {
  $("formNovaEmpresa").classList.add("hide");
  $("novaEmpresaMsg").textContent = "";
});
$("btnSalvarEmpresa")?.addEventListener("click", async () => {
  const nome = $("ncNome").value.trim();
  if (!nome) { $("novaEmpresaMsg").textContent = "❌ Informe o nome da empresa."; return; }
  $("novaEmpresaMsg").textContent = "Criando...";
  try {
    await apiContas({
      acao: "criar_conta",
      nome_conta: nome,
      plano_tipo: $("ncPlano").value,
      modo_integracao: $("ncModo").value,
      limite_total: $("ncLimTotal").value,
      limite_por_usuario: $("ncLimUser").value,
      usuarios_contratados: $("ncUsuarios").value,
      status: "ATIVA"
    });
    $("novaEmpresaMsg").textContent = "✅ Empresa criada. Agora crie os acessos dos operadores nela.";
    $("ncNome").value = "";
    await loadContasPlataforma();
  } catch (e) {
    $("novaEmpresaMsg").textContent = "❌ " + e.message;
  }
});

// Cria o login na plataforma para um operador que ainda não tem, e já grava
// o vínculo aqui no Coletor. Uma ação só, em vez de dois cadastros manuais.
async function criarAcessoPlataforma(login, nome) {
  if (!CONTAS_CACHE.length) { alert("Carregue as contas primeiro (botão Atualizar em 'Limites de envio')."); return; }

  const email = prompt(`E-mail de login na plataforma para "${nome || login}":`);
  if (!email) return;

  const lista = CONTAS_CACHE.map((c, i) => `${i + 1}) ${c.nome_conta || c.conta_id}`).join("\n");
  const escolha = prompt("Em qual empresa este operador entra?\n\n" + lista + "\n\nDigite o número:");
  if (!escolha) return;
  const conta = CONTAS_CACHE[parseInt(escolha, 10) - 1];
  if (!conta) { alert("Opção inválida."); return; }

  // Princípio de senha única: usa a MESMA senha que o operador já digita pra
  // entrar na extensão — não inventa uma segunda senha que ele nunca vê.
  const atual = await rpc("rpc_admin_get_senha", { p_admin_password: ADMIN_PASS, p_login: login });
  if (!atual.ok) { alert("❌ " + atual.error); return; }
  const senha = atual.senha;

  try {
    await apiContas({
      acao: "criar_usuario", conta_id: conta.conta_id,
      nome: nome || login, email_login: email, senha, perfil: "OPERADOR"
    });
  } catch (e) {
    if (!/já existe/i.test(e.message)) { alert("❌ " + e.message); return; }
    if (!confirm("Já existe login com esse e-mail na plataforma.\n\nVou redefinir a senha dele para a senha atual desse operador na extensão — só assim o acesso automático ao pool funciona.\n\nContinuar?")) return;

    try {
      const data = await apiContas(null);
      const existente = (data.usuarios || []).find(u => (u.email_login || "").toLowerCase() === email.toLowerCase());
      if (!existente) { alert("❌ Não localizei esse usuário na plataforma para redefinir a senha."); return; }
      await apiContas({ acao: "resetar_senha_usuario", usuario_id: existente.usuario_id, senha });
    } catch (err) {
      alert("❌ Não consegui redefinir a senha: " + err.message);
      return;
    }
  }

  try {
    const resp = await rpc("rpc_admin_upsert_usuario", {
      p_admin_password: ADMIN_PASS, p_login: login, p_senha: "", p_nome: nome || login,
      p_ativo: true, p_horario_coleta: "",
      p_email_plataforma: email, p_conta_id_plataforma: conta.conta_id,
      p_senha_plataforma: senha, p_limite_pool: ""
    });
    if (!resp.ok) { alert("❌ " + resp.error); return; }
    alert(`✅ Acesso criado.\n\nEmpresa: ${conta.nome_conta || conta.conta_id}\n\nO operador NÃO precisa dessa senha — ele entra na extensão com o login de sempre e o acesso ao pool vem junto.\n\n(Guardado para uso interno: ${email} / ${senha})`);
    loadUsuarios();
  } catch (e) {
    alert("❌ " + e.message);
  }
}

// Quem está logado agora — pra sempre dar pra saber, olhando a barra do
// topo, sem precisar adivinhar ou perguntar.
let CURRENT_ADMIN = null;

async function pegarIpPublico() {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const d = await r.json();
    return d.ip || null;
  } catch {
    return null; // rede bloqueada/lenta — segue sem IP, não trava o login
  }
}

function renderWhoInfo() {
  const el = $("whoInfo");
  if (!el || !CURRENT_ADMIN) return;
  const a = CURRENT_ADMIN;
  const empresaLabel = a.conta_id_plataforma ? esc(nomeDaConta(a.conta_id_plataforma)) : "super-admin";
  const anterior = a.login_anterior_em
    ? `último acesso anterior: ${esc(new Date(a.login_anterior_em).toLocaleString('pt-BR'))}${a.login_anterior_ip ? ' · IP ' + esc(a.login_anterior_ip) : ''}`
    : "primeiro acesso registrado";
  el.innerHTML = `👤 <b>${esc(a.nome || a.login)}</b> (${esc(a.login)}) · ${empresaLabel}<br><span style="opacity:.8">${anterior}</span>`;
  el.classList.remove("hide");
}

async function fazerLogin(pass) {
  const ip = await pegarIpPublico();
  const resp = await rpc("rpc_admin_login", { p_admin_password: pass, p_ip: ip });
  if (!resp.ok) return resp;
  ADMIN_PASS = pass;
  sessionStorage.setItem("catho_admin_pass", pass);
  CURRENT_ADMIN = resp;
  showApp();
  renderWhoInfo(); // primeira tentativa — reforçada de novo quando as contas carregarem (pro nome da empresa aparecer)
  return resp;
}

$("btnEntrar").addEventListener("click", async () => {
  const pass = $("adminPass").value;
  if (!pass) { $("loginMsg").textContent = "Digite a senha."; return; }
  $("loginMsg").textContent = "Verificando...";
  try {
    const resp = await fazerLogin(pass);
    if (!resp.ok) { $("loginMsg").textContent = "❌ " + resp.error; return; }
  } catch (e) {
    $("loginMsg").textContent = "❌ " + e.message;
  }
});

async function loadUsuarios() {
  try {
    const resp = await rpc("rpc_admin_list_usuarios", { p_admin_password: ADMIN_PASS });
    if (!resp.ok) { alert("Sessão expirou: " + resp.error); location.reload(); return; }
    renderUsuarios(resp.usuarios || []);
  } catch (e) {
    alert("Falha ao carregar: " + e.message);
  }
}

function renderUsuarios(list) {
  const tbody = $("listaUsuarios");
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6"><small>Nenhum operador cadastrado ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td>${esc(u.login)}<br><small class="statusColetaBadge" data-login-badge="${esc(u.login)}"></small></td>
      <td>${esc(u.nome_operador)}</td>
      <td><span class="badge ${u.ativo ? '' : 'bloqueado'}">${u.ativo ? 'Ativo' : 'Bloqueado'}</span></td>
      <td>${u.horario_coleta ? `⏰ ${esc(u.horario_coleta)}` : '<small style="color:#999">—</small>'}</td>
      <td>${u.email_plataforma
            ? `<small>${u.tem_senha_plataforma ? '🔗' : '⚠️'} ${esc(u.email_plataforma)}<br>
                 <span style="color:#888">${esc(u.conta_id_plataforma || 'sem conta')}</span><br>
                 <span style="color:${u.limite_pool != null ? '#5b21b6' : '#999'}">teto: ${u.limite_pool != null ? u.limite_pool : 'só o da empresa'}</span>
                 ${u.tem_senha_plataforma ? '' : '<br><span style="color:#c2410c">sem senha salva — não entra no pool</span>'}
                 <br>
                 <button data-login="${esc(u.login)}" data-email="${esc(u.email_plataforma)}" class="secondary sincronizarBtn" style="padding:3px 7px;font-size:10px;margin-top:4px">🔄 Sincronizar</button>
                 <button data-login="${esc(u.login)}" class="ghost desvincularBtn" style="padding:3px 7px;font-size:10px;margin-top:4px">Desvincular</button>
               </small>`
            : `<button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador||'')}" class="secondary criarAcessoBtn" style="padding:4px 8px;font-size:11px">+ Criar acesso</button>`}</td>
      <td>
        <button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador)}" data-ativo="${u.ativo}" data-horario="${esc(u.horario_coleta||'')}" data-email="${esc(u.email_plataforma||'')}" data-conta="${esc(u.conta_id_plataforma||'')}" data-limite="${u.limite_pool != null ? u.limite_pool : ''}" class="ghost editBtn" style="padding:4px 8px;font-size:11px">Editar</button>
        <button data-login="${esc(u.login)}" data-ativo="${u.ativo}" class="${u.ativo ? 'danger' : 'secondary'} toggleBtn" style="padding:4px 8px;font-size:11px">${u.ativo ? 'Bloquear' : 'Reativar'}</button>
        <button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador||u.login)}" class="danger excluirOperadorBtn" style="padding:4px 8px;font-size:11px">Excluir</button>
        <button data-login="${esc(u.login)}" class="ghost filtrosBtn" style="padding:4px 8px;font-size:11px">📋 Filtros</button>
      </td>
    </tr>
    <tr class="filtrosRow hide" data-login-row="${esc(u.login)}"><td colspan="6"><div class="filtrosPainel" data-login="${esc(u.login)}"></div></td></tr>
  `).join('');

  tbody.querySelectorAll(".filtrosBtn").forEach(btn => {
    btn.addEventListener("click", () => toggleFiltrosPanel(btn.dataset.login));
  });
  aplicarBadgesColeta(); // já aplica o que tiver em cache, sem esperar o próximo poll

  tbody.querySelectorAll(".excluirOperadorBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Excluir o operador "${btn.dataset.nome}" (${btn.dataset.login})?\n\nSó funciona se ele ainda não coletou nenhum lead — se já coletou, use "Bloquear" em vez de excluir.\n\nIsso NÃO apaga o login dele na plataforma Novos Talentos (se tiver); pra isso use Excluir em "Usuários da plataforma".`)) return;
      btn.disabled = true;
      try {
        const resp = await rpc("rpc_admin_excluir_usuario", { p_admin_password: ADMIN_PASS, p_login: btn.dataset.login });
        if (!resp.ok) { alert("❌ " + resp.error); btn.disabled = false; return; }
        loadUsuarios();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      $("fLogin").value = btn.dataset.login;
      $("fLogin").disabled = true;
      $("fSenha").value = "";
      $("fNome").value = btn.dataset.nome;
      $("fAtivo").value = btn.dataset.ativo;
      $("fHorario").value = btn.dataset.horario || "";
      $("fEmailPlataforma").value = btn.dataset.email || "";
      $("fEmailRhi").value = "";
      $("fSenhaRhi").value = "";
      // Se as contas ainda não carregaram (sem token, ou API lenta), o select
      // não tem a opção e o valor não "cola" — aí o salvar reclamava que faltava
      // a conta. Cria a opção na hora para preservar o vínculo que já existe.
      const selConta = $("fContaPlataforma");
      const contaAtual = btn.dataset.conta || "";
      if (contaAtual && !Array.from(selConta.options).some(o => o.value === contaAtual)) {
        selConta.insertAdjacentHTML("beforeend", `<option value="${esc(contaAtual)}">${esc(contaAtual)}</option>`);
      }
      selConta.value = contaAtual;
      $("fLimitePool").value = btn.dataset.limite || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  tbody.querySelectorAll(".criarAcessoBtn").forEach(btn => {
    btn.addEventListener("click", () => criarAcessoPlataforma(btn.dataset.login, btn.dataset.nome));
  });

  tbody.querySelectorAll(".sincronizarBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Sincronizando...";
      try {
        const atual = await rpc("rpc_admin_get_senha", { p_admin_password: ADMIN_PASS, p_login: btn.dataset.login });
        if (!atual.ok) throw new Error(atual.error);
        await sincronizarSenhaComPlataforma(btn.dataset.login, btn.dataset.email, atual.senha);
        alert("✅ Senha sincronizada. O operador já pode sair e entrar de novo na extensão pra abrir o pool.");
        loadUsuarios();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
        btn.textContent = "🔄 Sincronizar";
      }
    });
  });

  tbody.querySelectorAll(".desvincularBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Desvincular "${btn.dataset.login}" da plataforma?\n\nEle continua coletando normalmente, mas perde o acesso ao banco de talentos.\n\nO login na plataforma NÃO é apagado — pra isso use Excluir em "Usuários da plataforma".`)) return;
      btn.disabled = true;
      try {
        const resp = await rpc("rpc_admin_desvincular_plataforma", { p_admin_password: ADMIN_PASS, p_login: btn.dataset.login });
        if (!resp.ok) { alert("❌ " + resp.error); btn.disabled = false; return; }
        loadUsuarios();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".toggleBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const novoAtivo = btn.dataset.ativo !== "true";
      if (!confirm(`${novoAtivo ? "Reativar" : "Bloquear"} o operador "${btn.dataset.login}"?`)) return;
      try {
        const resp = await rpc("rpc_admin_set_ativo", { p_admin_password: ADMIN_PASS, p_login: btn.dataset.login, p_ativo: novoAtivo });
        if (!resp.ok) { alert("❌ " + resp.error); return; }
        loadUsuarios();
      } catch (e) {
        alert("❌ " + e.message);
      }
    });
  });
}

// ───────────────────────── "Coletando agora?" (status ao vivo) ─────────────────────────
// Poll simples a cada 20s — mostra 🟢 direto na lista de operadores, sem
// precisar abrir o painel de filtros de cada um pra saber quem está rodando.
let STATUS_COLETA_CACHE = {}; // login -> coletando_desde (string ISO) | null

async function refreshStatusColeta() {
  try {
    const resp = await rpc("rpc_admin_status_coleta", { p_admin_password: ADMIN_PASS });
    STATUS_COLETA_CACHE = {};
    (Array.isArray(resp) ? resp : []).forEach(r => { STATUS_COLETA_CACHE[r.login] = r.coletando_desde; });
    aplicarBadgesColeta();
  } catch (e) {
    // silencioso — não trava o resto do admin por causa disso
  }
}

function estaColetandoAgora(login) {
  const desde = STATUS_COLETA_CACHE[login];
  if (!desde) return false;
  const ms = Date.now() - new Date(desde).getTime();
  // ignora "preso" há mais de 20min — provável crash/fechou o Chrome sem limpar
  return ms >= 0 && ms < 20 * 60 * 1000;
}

function aplicarBadgesColeta() {
  document.querySelectorAll(".statusColetaBadge").forEach(el => {
    const login = el.dataset.loginBadge;
    el.innerHTML = estaColetandoAgora(login) ? '<span style="color:#16a34a;font-weight:800">🟢 Coletando agora</span>' : '';
  });
}

setInterval(refreshStatusColeta, 20000);

// ───────────────────────── Filtros de coleta (por operador) ─────────────────────────
// Antes só existiam no navegador de cada operador. Agora moram no banco —
// o admin edita de longe e ainda consegue mandar "Rodar agora" remotamente
// (a extensão do operador checa comando pendente a cada ~3min).

async function toggleFiltrosPanel(login) {
  const row = document.querySelector(`tr.filtrosRow[data-login-row="${CSS.escape(login)}"]`);
  if (!row) return;
  const estavaEscondido = row.classList.contains("hide");
  // fecha qualquer outro painel aberto — evita empilhar vários ao mesmo tempo
  document.querySelectorAll("tr.filtrosRow").forEach(r => r.classList.add("hide"));
  if (!estavaEscondido) return; // já estava aberto: o clique só fechou (feito acima)
  row.classList.remove("hide");
  await carregarFiltrosOperador(login);
}

async function carregarFiltrosOperador(login) {
  const painel = document.querySelector(`.filtrosPainel[data-login="${CSS.escape(login)}"]`);
  if (!painel) return;
  painel.innerHTML = "<small>Carregando filtros...</small>";
  try {
    const resp = await rpc("rpc_admin_listar_filtros", { p_admin_password: ADMIN_PASS, p_login: login });
    renderFiltrosOperador(login, Array.isArray(resp) ? resp : []);
  } catch (e) {
    painel.innerHTML = `<small style="color:#c2410c">❌ ${esc(e.message)}</small>`;
  }
}

function renderFiltrosOperador(login, filtros) {
  const painel = document.querySelector(`.filtrosPainel[data-login="${CSS.escape(login)}"]`);
  if (!painel) return;

  const linhas = filtros.map(f => {
    const ultima = f.ultima_coleta
      ? new Date(f.ultima_coleta).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "ainda não rodou";
    return `
      <div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:10px 12px;margin-top:8px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">
          <div style="min-width:0;flex:1">
            <a href="${esc(f.link)}" target="_blank" style="font-size:12px;word-break:break-all">${esc(f.link)}</a>
            <div style="font-size:11px;color:#888;margin-top:2px">Páginas: ${f.paginas} • Coletados: ${f.coletados || 0} • Última coleta: ${ultima}${f.ultimo_erro ? ' • ⚠️ ' + esc(f.ultimo_erro) : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
            <span class="badge ${f.pausado ? 'pausado' : ''}">${f.pausado ? 'PAUSADO' : 'ATIVO'}</span>
            <button data-id="${esc(f.id)}" data-pausado="${f.pausado}" class="ghost toggleFiltroAdminBtn" style="padding:3px 8px;font-size:11px">${f.pausado ? '▶' : '⏸'}</button>
            <button data-id="${esc(f.id)}" class="danger excluirFiltroAdminBtn" style="padding:3px 8px;font-size:11px">✕</button>
          </div>
        </div>
      </div>`;
  }).join('') || '<small>Nenhum filtro cadastrado ainda.</small>';

  painel.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
      <button type="button" class="secondary rodarAgoraBtn">▶ Rodar agora (coleta + disparo)</button>
      <small style="color:#888">O computador/Chrome do operador precisa estar aberto — o comando é consumido em até 3min.</small>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input type="text" class="novoFiltroLink" placeholder="Link de busca de currículos da Catho" style="flex:2;min-width:220px">
      <input type="number" class="novoFiltroPaginas" placeholder="Páginas" value="2" min="1" style="width:80px">
      <button type="button" class="secondary addFiltroAdminBtn">+ Adicionar</button>
    </div>
    ${linhas}
  `;

  painel.querySelector(".rodarAgoraBtn")?.addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Enviando comando...";
    try {
      await rpc("rpc_admin_definir_comando", { p_admin_password: ADMIN_PASS, p_login: login, p_comando: { tipo: "RODAR_AGORA" } });
      alert("✅ Comando enviado. A extensão desse operador roda em até 3 minutos, assim que checar (precisa do Chrome dele aberto).");
    } catch (e) {
      alert("❌ " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  painel.querySelector(".addFiltroAdminBtn")?.addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    const link = painel.querySelector(".novoFiltroLink").value.trim();
    const paginas = parseInt(painel.querySelector(".novoFiltroPaginas").value, 10) || 2;
    if (!/catho\.com\.br\/curriculos\/busca\//i.test(link)) { alert("Link inválido — cole o link de uma busca de currículos da Catho."); return; }
    btn.disabled = true;
    try {
      await rpc("rpc_admin_salvar_filtro", { p_admin_password: ADMIN_PASS, p_login: login, p_link: link, p_paginas: paginas });
      carregarFiltrosOperador(login);
    } catch (e) {
      alert("❌ " + e.message);
      btn.disabled = false;
    }
  });

  painel.querySelectorAll(".toggleFiltroAdminBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await rpc("rpc_admin_atualizar_filtro", { p_admin_password: ADMIN_PASS, p_login: login, p_id: btn.dataset.id, p_pausado: btn.dataset.pausado !== "true" });
        carregarFiltrosOperador(login);
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

  painel.querySelectorAll(".excluirFiltroAdminBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir esse filtro de coleta?")) return;
      btn.disabled = true;
      try {
        await rpc("rpc_admin_excluir_filtro", { p_admin_password: ADMIN_PASS, p_login: login, p_id: btn.dataset.id });
        carregarFiltrosOperador(login);
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });
}

$("btnRefresh").addEventListener("click", loadUsuarios);

$("btnLimparForm").addEventListener("click", () => {
  $("fLogin").value = "";
  $("fLogin").disabled = false;
  $("fSenha").value = "";
  $("fNome").value = "";
  $("fAtivo").value = "true";
  $("fHorario").value = "";
  $("fEmailPlataforma").value = "";
  $("fContaPlataforma").value = "";
  $("fLimitePool").value = "";
  $("fEmailRhi").value = "";
  $("fSenhaRhi").value = "";
  $("formMsg").textContent = "";
});

// Aplica UMA senha nos dois lugares: login da extensão (tabela usuarios) e
// login da plataforma (Supabase Auth). É o que garante que nunca divirjam.
async function sincronizarSenhaComPlataforma(login, emailPlataforma, senha) {
  const data = await apiContas(null);
  const alvo = (data.usuarios || []).find(u => (u.email_login || "").toLowerCase() === emailPlataforma.toLowerCase());
  if (!alvo) throw new Error("Esse e-mail não existe na plataforma. Cadastre em 'Usuários da plataforma' primeiro.");

  const rSenha = await apiContas({ acao: "resetar_senha_usuario", usuario_id: alvo.usuario_id, senha });
  if (rSenha && rSenha.ok === false) throw new Error(rSenha.message || rSenha.error || "Falha ao redefinir a senha na plataforma.");

  // rpc_admin_upsert_usuario sempre responde HTTP 200 mesmo quando falha por
  // regra de negócio (ex: 0 linhas afetadas) — precisa checar o campo .ok do
  // corpo, não só o status HTTP. Foi essa checagem que faltava antes: o botão
  // dizia "sincronizado" mesmo quando nada tinha sido gravado.
  const rUpsert = await rpc("rpc_admin_upsert_usuario", {
    p_admin_password: ADMIN_PASS, p_login: login, p_senha: "", p_nome: "",
    p_ativo: true, p_horario_coleta: null,
    p_senha_plataforma: senha
  });
  if (!rUpsert.ok) throw new Error("Senha atualizada na plataforma, mas falhou ao gravar no Coletor: " + rUpsert.error);
}

$("btnSalvarUsuario").addEventListener("click", async () => {
  const login = $("fLogin").value.trim();
  const senha = $("fSenha").value;
  const nome = $("fNome").value.trim();
  const ativo = $("fAtivo").value === "true";
  const horario = $("fHorario").value || "";
  const emailPlataforma = $("fEmailPlataforma").value.trim();
  const contaPlataforma = $("fContaPlataforma").value;
  const emailRhi = $("fEmailRhi").value.trim();
  const senhaRhi = $("fSenhaRhi").value;
  if (!login) { $("formMsg").textContent = "❌ Login é obrigatório."; return; }
  if (emailPlataforma && !contaPlataforma) { $("formMsg").textContent = "❌ Escolha a conta da plataforma junto com o e-mail."; return; }

  $("formMsg").textContent = "Salvando...";
  try {
    const resp = await rpc("rpc_admin_upsert_usuario", {
      p_admin_password: ADMIN_PASS, p_login: login, p_senha: senha, p_nome: nome,
      p_ativo: ativo, p_horario_coleta: horario,
      p_email_plataforma: emailPlataforma, p_conta_id_plataforma: contaPlataforma,
      // A senha da plataforma só é mexida aqui se o admin digitou uma senha
      // NOVA de extensão nesta tela — daí ela vira a mesma dos dois lados.
      p_senha_plataforma: (senha && emailPlataforma) ? senha : null,
      p_limite_pool: $("fLimitePool").value,
      // Corretores CRECI: login real e independente, digitado (não copiado
      // da senha da extensão) — é o mesmo em todos os operadores.
      p_email_rhi: emailRhi || null,
      p_senha_rhi: senhaRhi || null
    });
    if (!resp.ok) { $("formMsg").textContent = "❌ " + resp.error; return; }

    if (senha && emailPlataforma) {
      $("formMsg").textContent = "Sincronizando com a plataforma...";
      await sincronizarSenhaComPlataforma(login, emailPlataforma, senha);
    }

    $("formMsg").textContent = "✅ Salvo.";
    $("btnLimparForm").click();
    loadUsuarios();
  } catch (e) {
    $("formMsg").textContent = "❌ " + e.message;
  }
});

// ===== Administradores =====
async function loadAdmins() {
  try {
    const resp = await rpc("rpc_admin_list_admins", { p_admin_password: ADMIN_PASS });
    if (!resp.ok) return;
    renderAdmins(resp.admins || []);
  } catch (e) { /* silencioso */ }
}

function renderAdmins(list) {
  const tbody = $("listaAdmins");
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7"><small>Nenhum admin cadastrado ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(a => `
    <tr>
      <td>${esc(a.login)}</td>
      <td>${esc(a.nome)}</td>
      <td><span class="badge ${a.ativo ? '' : 'bloqueado'}">${a.ativo ? 'Ativo' : 'Bloqueado'}</span></td>
      <td>${a.nivel === 'agendamentos' ? 'Só agendamentos' : 'Completo'}</td>
      <td>${a.conta_id_plataforma ? `<small>${esc(nomeDaConta(a.conta_id_plataforma))}</small>` : '<small style="color:#999">— super-admin —</small>'}</td>
      <td>${a.operador_login ? `<small>${esc(a.operador_login)}</small>` : '<small style="color:#999">—</small>'}</td>
      <td>
        <button data-login="${esc(a.login)}" data-nome="${esc(a.nome)}" data-ativo="${a.ativo}" data-nivel="${esc(a.nivel||'completo')}" data-conta="${esc(a.conta_id_plataforma||'')}" data-operador="${esc(a.operador_login||'')}" class="ghost admEditBtn" style="padding:4px 8px;font-size:11px">Editar</button>
        <button data-login="${esc(a.login)}" data-ativo="${a.ativo}" class="${a.ativo ? 'danger' : 'secondary'} admToggleBtn" style="padding:4px 8px;font-size:11px">${a.ativo ? 'Bloquear' : 'Reativar'}</button>
        <button data-login="${esc(a.login)}" data-nome="${esc(a.nome)}" class="danger admExcluirBtn" style="padding:4px 8px;font-size:11px">Excluir</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll(".admEditBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      $("admLogin").value = btn.dataset.login;
      $("admLogin").disabled = true;
      $("admSenha").value = "";
      $("admNome").value = btn.dataset.nome;
      $("admAtivo").value = btn.dataset.ativo;
      $("admNivel").value = btn.dataset.nivel || "completo";
      const selConta = $("admConta");
      const contaAtual = btn.dataset.conta || "";
      if (selConta) {
        if (contaAtual && !Array.from(selConta.options).some(o => o.value === contaAtual)) {
          selConta.insertAdjacentHTML("beforeend", `<option value="${esc(contaAtual)}">${esc(contaAtual)}</option>`);
        }
        selConta.value = contaAtual;
      }
      if ($("admOperadorLogin")) $("admOperadorLogin").value = btn.dataset.operador || "";
      // Rolar até o fim da página parava de funcionar quando o Log de
      // auditoria (Fase 12) passou a existir depois desta seção — agora
      // rola direto até o campo Login do formulário de admin.
      $("admLogin").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  tbody.querySelectorAll(".admToggleBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const novoAtivo = btn.dataset.ativo !== "true";
      if (!confirm(`${novoAtivo ? "Reativar" : "Bloquear"} o admin "${btn.dataset.login}"?`)) return;
      try {
        const resp = await rpc("rpc_admin_set_admin_ativo", { p_admin_password: ADMIN_PASS, p_login: btn.dataset.login, p_ativo: novoAtivo });
        if (!resp.ok) { alert("❌ " + resp.error); return; }
        loadAdmins();
      } catch (e) {
        alert("❌ " + e.message);
      }
    });
  });

  tbody.querySelectorAll(".admExcluirBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Excluir o admin "${btn.dataset.nome}" (${btn.dataset.login})? Essa ação não pode ser desfeita.`)) return;
      btn.disabled = true;
      try {
        const resp = await rpc("rpc_admin_excluir_admin", { p_admin_password: ADMIN_PASS, p_login: btn.dataset.login });
        if (!resp.ok) { alert("❌ " + resp.error); btn.disabled = false; return; }
        loadAdmins();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });
}

$("btnLimparAdminForm").addEventListener("click", () => {
  $("admLogin").value = "";
  $("admLogin").disabled = false;
  $("admSenha").value = "";
  $("admNome").value = "";
  $("admAtivo").value = "true";
  $("admNivel").value = "completo";
  if ($("admConta")) $("admConta").value = "";
  if ($("admOperadorLogin")) $("admOperadorLogin").value = "";
  $("admFormMsg").textContent = "";
});

$("btnSalvarAdmin").addEventListener("click", async () => {
  const login = $("admLogin").value.trim();
  const senha = $("admSenha").value;
  const nome = $("admNome").value.trim();
  const ativo = $("admAtivo").value === "true";
  const nivel = $("admNivel").value;
  const contaIdPlataforma = $("admConta") ? $("admConta").value : "";
  const operadorLogin = $("admOperadorLogin") ? $("admOperadorLogin").value.trim() : "";
  if (!login) { $("admFormMsg").textContent = "❌ Login é obrigatório."; return; }

  $("admFormMsg").textContent = "Salvando...";
  try {
    const resp = await rpc("rpc_admin_upsert_admin", { p_admin_password: ADMIN_PASS, p_login: login, p_senha: senha, p_nome: nome, p_ativo: ativo, p_nivel: nivel, p_conta_id_plataforma: contaIdPlataforma || null, p_operador_login: operadorLogin || null });
    if (!resp.ok) { $("admFormMsg").textContent = "❌ " + resp.error; return; }
    $("admFormMsg").textContent = "✅ Salvo.";
    $("btnLimparAdminForm").click();
    loadAdmins();
  } catch (e) {
    $("admFormMsg").textContent = "❌ " + e.message;
  }
});

function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// Olhinho pra ver a senha de login do painel.
$("btnToggleAdminPass")?.addEventListener("click", () => {
  const input = $("adminPass");
  input.type = input.type === "password" ? "text" : "password";
});

// Enter em qualquer campo de um formulário aciona o botão de salvar dele —
// em vez de precisar clicar no botão toda vez.
function enterSubmete(inputIds, botaoId) {
  inputIds.forEach(id => {
    $(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $(botaoId)?.click(); }
    });
  });
}
enterSubmete(["adminPass"], "btnEntrar");
enterSubmete(["fLogin", "fSenha", "fNome", "fHorario", "fEmailPlataforma", "fLimitePool", "fEmailRhi", "fSenhaRhi"], "btnSalvarUsuario");
enterSubmete(["ncNome", "ncLimTotal", "ncLimUser", "ncUsuarios"], "btnSalvarEmpresa");
enterSubmete(["puNome", "puEmail", "puSenha"], "btnSalvarUsuarioPlataforma");
enterSubmete(["admLogin", "admSenha", "admNome", "admOperadorLogin"], "btnSalvarAdmin");

// Se já tinha sessão de admin aberta (mesma aba), pula a tela de login.
if (ADMIN_PASS) {
  fazerLogin(ADMIN_PASS).catch(() => {});
}
