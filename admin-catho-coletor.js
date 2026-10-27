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
  iniciarPollingStatusColeta();
  loadAdmins();
  loadAuditLog();
  loadLogsExtensao();
  loadContasPlataforma().then(() => { loadUsuariosPlataforma(); renderWhoInfo(); });
  loadContratos();
  // Banco de Corretores CRECI é só da RH IMOB: admin de empresa não vê a aba.
  const superAdmin = !(CURRENT_ADMIN && CURRENT_ADMIN.conta_id_plataforma);
  document.querySelector('[data-tab="tabCreci"]')?.classList.toggle("hide", !superAdmin);
  if (superAdmin) {
    loadContasRhi().then(() => { loadUsuariosRhi(); });
    loadCidadesExportarContatos();
  }
  loadUsuariosEnriquecimento();
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

async function limparAuditLog() {
  const dias = parseInt($("diasLimparAudit")?.value, 10) || 90;
  if (!confirm(`Apagar todos os eventos de auditoria com mais de ${dias} dia(s)? Não dá pra desfazer.`)) return;
  const msg = $("limparAuditMsg");
  msg.textContent = "Apagando...";
  try {
    const resp = await rpc("rpc_admin_limpar_auditoria", { p_admin_password: ADMIN_PASS, p_dias: dias });
    if (!resp.ok) { msg.textContent = "❌ " + resp.error; return; }
    msg.textContent = `✅ ${resp.apagados} registro(s) apagado(s).`;
    loadAuditLog();
  } catch (e) {
    msg.textContent = "❌ " + e.message;
  }
}
$("btnLimparAudit")?.addEventListener("click", limparAuditLog);

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
    tbody.innerHTML = '<tr><td colspan="7"><small>Nenhuma conta carregada.</small></td></tr>';
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
      <td>${celulaValidadeConta(c, 'nt')}</td>
      <td${perto ? ' style="color:#c2410c;font-weight:700"' : ''}>${consumido}${limite ? ' / ' + limite : ''}</td>
      <td><input class="limTotal" data-conta="${esc(c.conta_id)}" type="number" min="0" value="${limite}" style="width:90px;margin:0"></td>
      <td><input class="limUser" data-conta="${esc(c.conta_id)}" type="number" min="0" value="${c.limite_por_usuario ?? 0}" style="width:90px;margin:0"></td>
      <td style="white-space:nowrap">
        <button class="salvarLimBtn" data-conta="${esc(c.conta_id)}" style="padding:4px 8px;font-size:11px">Salvar</button>
        <button class="${c.status === 'ATIVA' ? 'danger' : 'secondary'} statusContaBtn" data-conta="${esc(c.conta_id)}" data-status="${esc(c.status||'')}" data-nome="${esc(c.nome_conta||c.conta_id)}" style="padding:4px 8px;font-size:11px">${c.status === 'ATIVA' ? 'Desativar' : 'Ativar'}</button>
        <button class="danger excluirContaBtn" data-conta="${esc(c.conta_id)}" data-nome="${esc(c.nome_conta||c.conta_id)}" style="padding:4px 8px;font-size:11px">🗑 Excluir</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".validadeContaBtn").forEach(btn => {
    btn.addEventListener("click", () => editarValidadeConta(btn.dataset.tipo, btn.dataset.conta, btn.dataset.modo));
  });
  renderAvisosValidade();

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

  // "Desativar" é o caminho seguro (reversível, preserva histórico). "Excluir"
  // é definitivo — usar só pra empresa que cancelou/venceu e não vai renovar.
  tbody.querySelectorAll(".excluirContaBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nome = btn.dataset.nome;
      if (!confirm(`Excluir definitivamente "${nome}"?\n\nRemove a empresa e os usuários/logins vinculados a ela. Não dá pra desfazer. Use só se ela cancelou ou não vai renovar — senão prefira "Desativar".`)) return;
      btn.disabled = true;
      try {
        await apiContas({ acao: "excluir_conta", conta_id: btn.dataset.conta });
        await loadContasPlataforma();
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

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

// ===== Exportar contatos (CSV Google Contatos) por cidade/ano — usa as
// mesmas tabelas de filtro (lead_filtros_cidade/_ano) que a Plataforma de
// Corretores já mantém atualizadas, então não recalcula nada aqui.
async function loadCidadesExportarContatos() {
  const select = $("ecCidade");
  if (!select) return;
  try {
    const url = "/api/exportar-contatos-rhi?token=" + encodeURIComponent(ADMIN_PASS) + "&acao=cidades";
    const r = await fetch(url);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data?.message || "Falha ao carregar cidades");
    const cidades = data.cidades || [];
    select.innerHTML = cidades.length
      ? cidades.map(c => `<option value="${esc(c.cidade)}">${esc(c.cidade)} (${c.total})</option>`).join('')
      : '<option value="">Nenhuma cidade encontrada</option>';
    if (cidades.length) loadAnosExportarContatos(cidades[0].cidade);
  } catch (e) {
    select.innerHTML = `<option value="">❌ ${esc(e.message)}</option>`;
  }
}

async function loadAnosExportarContatos(cidade) {
  const select = $("ecAno");
  if (!select || !cidade) return;
  select.innerHTML = '<option value="">Todos</option>';
  try {
    const url = "/api/exportar-contatos-rhi?token=" + encodeURIComponent(ADMIN_PASS) + "&acao=anos&cidade=" + encodeURIComponent(cidade);
    const r = await fetch(url);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data?.message || "Falha ao carregar anos");
    (data.anos || []).forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.ano_inscricao;
      opt.textContent = `${a.ano_inscricao} (${a.total})`;
      select.appendChild(opt);
    });
  } catch (e) {
    // silencioso — o filtro de ano é opcional, não trava o resto da tela
  }
}

$("ecCidade")?.addEventListener("change", (e) => loadAnosExportarContatos(e.target.value));

$("btnGerarContatosRhi")?.addEventListener("click", () => {
  const cidade = $("ecCidade").value;
  const ano = $("ecAno").value;
  const msgEl = $("exportarContatosMsg");
  if (!cidade) { if (msgEl) msgEl.textContent = "⚠️ Escolha uma cidade."; return; }
  if (msgEl) msgEl.textContent = "Gerando... o download começa em instantes.";
  const url = "/api/exportar-contatos-rhi?token=" + encodeURIComponent(ADMIN_PASS) +
    "&acao=exportar&cidade=" + encodeURIComponent(cidade) +
    (ano ? "&ano=" + encodeURIComponent(ano) : "");
  window.location.href = url;
});

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
    tbody.innerHTML = '<tr><td colspan="6"><small>Nenhuma empresa cadastrada ainda.</small></td></tr>';
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
      <td>${celulaValidadeConta(c, 'rhi')}</td>
      <td${perto ? ' style="color:#c2410c;font-weight:700"' : ''}>${consumido}${limite ? ' / ' + limite : ''}</td>
      <td><input class="limLeadsRhi" data-conta="${esc(c.id)}" type="number" min="0" value="${limite}" style="width:100px;margin:0"></td>
      <td style="white-space:nowrap">
        <button class="salvarLimRhiBtn" data-conta="${esc(c.id)}" style="padding:4px 8px;font-size:11px">Salvar</button>
        <button class="${ativa ? 'danger' : 'secondary'} statusContaRhiBtn" data-conta="${esc(c.id)}" data-status="${esc(c.status||'')}" data-nome="${esc(c.nome_empresa||c.id)}" style="padding:4px 8px;font-size:11px">${ativa ? 'Desativar' : 'Ativar'}</button>
        <button class="danger excluirContaRhiBtn" data-conta="${esc(c.id)}" data-nome="${esc(c.nome_empresa||c.id)}" style="padding:4px 8px;font-size:11px">🗑 Excluir</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".validadeContaBtn").forEach(btn => {
    btn.addEventListener("click", () => editarValidadeConta(btn.dataset.tipo, btn.dataset.conta, btn.dataset.modo));
  });
  renderAvisosValidade();

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

  // "Desativar" é o caminho seguro (reversível). "Excluir" é definitivo —
  // para empresa com quem não se trabalha mais.
  tbody.querySelectorAll(".excluirContaRhiBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nome = btn.dataset.nome;
      if (!confirm(`Excluir definitivamente "${nome}" do Banco de Corretores CRECI?\n\nRemove a empresa e os usuários/logins dela. Não dá pra desfazer. Se pode voltar a trabalhar com ela, prefira "Desativar".`)) return;
      btn.disabled = true;
      try {
        try {
          await apiContasRhi({ acao: "excluir_conta", conta_id: btn.dataset.conta });
        } catch (e) {
          const m = String(e.message).match(/^TEM_HISTORICO:(\d+)/);
          if (!m) throw e;
          if (!confirm(`"${nome}" já liberou ${m[1]} contato(s). Para excluir, esse histórico de consumo também é apagado.\n\nExcluir mesmo assim?`)) { btn.disabled = false; return; }
          await apiContasRhi({ acao: "excluir_conta", conta_id: btn.dataset.conta, apagar_historico: true });
        }
        await loadContasRhi();
        loadUsuariosRhi();
      } catch (e) {
        alert("❌ " + e.message);
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
      ...validadeInicial($("rncValidade").value),
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
      ...validadeInicial($("ncValidade").value),
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

  // A extensão não usa mais senha para entrar no pool: o servidor
  // (/api/ext-sessao) gera o acesso pelo e-mail. O login da plataforma recebe
  // uma senha aleatória forte que não fica guardada em lugar nenhum.
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const senha = btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "") + "Aa1!";

  try {
    await apiContas({
      acao: "criar_usuario", conta_id: conta.conta_id,
      nome: nome || login, email_login: email, senha, perfil: "OPERADOR"
    });
  } catch (e) {
    // Já existe login com esse e-mail na plataforma: só vincula, sem mexer na senha dele.
    if (!/já existe/i.test(e.message)) { alert("❌ " + e.message); return; }
  }

  try {
    const resp = await rpc("rpc_admin_upsert_usuario", {
      p_admin_password: ADMIN_PASS, p_login: login, p_senha: "", p_nome: nome || login,
      p_ativo: true, p_horario_coleta: "",
      p_email_plataforma: email, p_conta_id_plataforma: conta.conta_id,
      p_senha_plataforma: null, p_limite_pool: ""
    });
    if (!resp.ok) { alert("❌ " + resp.error); return; }
    alert(`✅ Acesso criado.\n\nEmpresa: ${conta.nome_conta || conta.conta_id}\n\nO operador entra na extensão com o login de sempre e o acesso ao pool vem junto (precisa da extensão atualizada).`);
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
  // Nível "Só agendamentos" nunca deve ver o painel completo (operadores,
  // empresas, administradores, etc.) — mesmo que a senha seja válida, o
  // acesso dela é só o Kanban de agendamentos. Antes disso não era checado
  // em lugar nenhum: a senha certa sempre abria o painel inteiro.
  if (resp.nivel === "agendamentos") {
    sessionStorage.setItem("catho_admin_pass", pass);
    location.href = "/agendamentos";
    return resp;
  }
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
    const [resp] = await Promise.all([
      rpc("rpc_admin_list_usuarios", { p_admin_password: ADMIN_PASS }),
      loadValidadeOperadores(),
      loadFiltrosAtrasados()
    ]);
    if (!resp.ok) { alert("Sessão expirou: " + resp.error); location.reload(); return; }
    renderUsuarios(resp.usuarios || []);
    renderAvisosValidade();
    preencherOperadoresRanking();
  } catch (e) {
    alert("Falha ao carregar: " + e.message);
  }
}

let USUARIOS_COLETOR_CACHE = []; // para o "Entregar para" dos filtros
function renderUsuarios(list) {
  USUARIOS_COLETOR_CACHE = list || [];
  crPreencherOperadores();
  const tbody = $("listaUsuarios");
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8"><small>Nenhum operador cadastrado ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td>${esc(u.login)}<br><small class="statusColetaBadge" data-login-badge="${esc(u.login)}"></small></td>
      <td>${esc(u.nome_operador)}</td>
      <td><span class="badge ${u.ativo ? '' : 'bloqueado'}">${u.ativo ? 'Ativo' : 'Bloqueado'}</span></td>
      <td>${celulaValidadeOperador(u)}</td>
      <td>${celulaUsoOperador(u)}</td>
      <td>${u.horario_coleta ? `⏰ ${esc(u.horario_coleta)}` : '<small style="color:#999">—</small>'}</td>
      <td>${u.email_plataforma
            ? `<small>🔗 ${esc(u.email_plataforma)}<br>
                 <span style="color:#888">${esc(u.conta_id_plataforma || 'sem conta')}</span><br>
                 <span style="color:${u.limite_pool != null ? '#5b21b6' : '#999'}">teto: ${u.limite_pool != null ? u.limite_pool : 'só o da empresa'}</span>
                 <br>
                 <button data-login="${esc(u.login)}" class="ghost desvincularBtn" style="padding:3px 7px;font-size:10px;margin-top:4px">Desvincular</button>
               </small>`
            : `<button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador||'')}" class="secondary criarAcessoBtn" style="padding:4px 8px;font-size:11px">+ Criar acesso</button>`}</td>
      <td>
        <button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador)}" data-ativo="${u.ativo}" data-horario="${esc(u.horario_coleta||'')}" data-email="${esc(u.email_plataforma||'')}" data-conta="${esc(u.conta_id_plataforma||'')}" data-limite="${u.limite_pool != null ? u.limite_pool : ''}" class="ghost editBtn" style="padding:4px 8px;font-size:11px">Editar</button>
        <button data-login="${esc(u.login)}" data-ativo="${u.ativo}" class="${u.ativo ? 'danger' : 'secondary'} toggleBtn" style="padding:4px 8px;font-size:11px">${u.ativo ? 'Bloquear' : 'Reativar'}</button>
        <button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador||u.login)}" class="danger excluirOperadorBtn" style="padding:4px 8px;font-size:11px">Excluir</button>
        <button data-login="${esc(u.login)}" class="ghost filtrosBtn" style="padding:4px 8px;font-size:11px">📋 Filtros</button>
        <button data-login="${esc(u.login)}" class="ghost resumoBtn" style="padding:4px 8px;font-size:11px" title="Resumo do período para mandar ao cliente (imprime ou salva em PDF)">📊 Resumo</button>
        <button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador||u.login)}" class="ghost novaContagemBtn" style="padding:4px 8px;font-size:11px" title="Zera os números do funil deste operador para medir uma nova fase. Não apaga leads nem conversas.">↺ Nova contagem</button>
      </td>
    </tr>
    <tr class="filtrosRow hide" data-login-row="${esc(u.login)}"><td colspan="8"><div class="filtrosPainel" data-login="${esc(u.login)}"></div></td></tr>
  `).join('');

  tbody.querySelectorAll(".filtrosBtn").forEach(btn => {
    btn.addEventListener("click", () => toggleFiltrosPanel(btn.dataset.login));
  });
  // Resumo do período (resumo-cliente.html). window.open sem noopener leva a
  // sessão de admin desta aba junto (sessionStorage).
  tbody.querySelectorAll(".resumoBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = VALIDADE_OPER[btn.dataset.login] || {};
      const hoje = hojeBR();
      const de = v.acesso_inicio && v.acesso_inicio <= hoje ? v.acesso_inicio : somarPeriodo(hoje, "-29:d");
      window.open(`resumo-cliente.html?login=${encodeURIComponent(btn.dataset.login)}&de=${de}&ate=${hoje}`, "_blank");
    });
  });
  tbody.querySelectorAll(".validadeOperBtn").forEach(btn => {
    btn.addEventListener("click", () => editarValidadeOperador(btn.dataset.login, btn.dataset.modo));
  });
  aplicarBadgesColeta(); // já aplica o que tiver em cache, sem esperar o próximo poll

  // "Nova contagem" do funil (abordados → responderam → proposta → agendaram).
  // Fica só aqui no painel: a tela /agendamentos também é aberta pelo cliente.
  tbody.querySelectorAll(".novaContagemBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nome = btn.dataset.nome;
      if (!confirm(`Começar uma nova contagem do funil para ${nome}?\n\n• Os números dele (abordados, responderam, proposta, agendaram) voltam a zero e passam a contar só o que for abordado a partir de agora.\n• Nenhum lead, conversa ou agendamento é apagado.\n• Os números de hoje ficam guardados como "contagem anterior" e continuam visíveis em /agendamentos e na bolha.\n\nNão dá para desfazer.`)) return;
      const nota = prompt("O que muda nesta nova fase? (opcional — ajuda a comparar depois)\nEx.: \"nova proposta com ajuda de custo maior\"", "");
      if (nota === null) return;
      btn.disabled = true;
      try {
        const resp = await rpc("rpc_admin_reiniciar_funil", { p_admin_password: ADMIN_PASS, p_login: btn.dataset.login, p_nota: nota || null });
        if (!resp || !resp.ok) { alert("❌ " + ((resp && (resp.error || resp.message)) || "Não foi possível reiniciar a contagem.")); btn.disabled = false; return; }
        const n = resp.encerrado || {};
        alert(`✅ Nova contagem iniciada para ${nome}.\n\nContagem encerrada: ${n.abordados||0} abordados · ${n.responderam||0} responderam · ${n.proposta||0} receberam a proposta · ${n.agendaram||0} agendaram · ${n.pararam_na_proposta||0} pararam na proposta.`);
        btn.disabled = false;
      } catch (e) {
        alert("❌ " + e.message);
        btn.disabled = false;
      }
    });
  });

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
let STATUS_COLETA_INTERVAL = null;
let STATUS_COLETA_FALHAS = 0;

async function refreshStatusColeta() {
  if (!ADMIN_PASS) return; // sem sessão válida — nem tenta (evita martelar o backend deslogado)
  try {
    const resp = await rpc("rpc_admin_status_coleta", { p_admin_password: ADMIN_PASS });
    STATUS_COLETA_CACHE = {};
    (Array.isArray(resp) ? resp : []).forEach(r => { STATUS_COLETA_CACHE[r.login] = r.coletando_desde; });
    aplicarBadgesColeta();
    STATUS_COLETA_FALHAS = 0;
  } catch (e) {
    // depois de várias falhas seguidas (ex: senha mudou, sessão velha numa aba
    // esquecida aberta) para de tentar, em vez de martelar o backend pra sempre
    STATUS_COLETA_FALHAS++;
    if (STATUS_COLETA_FALHAS >= 3 && STATUS_COLETA_INTERVAL) {
      clearInterval(STATUS_COLETA_INTERVAL);
      STATUS_COLETA_INTERVAL = null;
    }
  }
}

let BQ_AUTO_CARREGADA = false;
function iniciarPollingStatusColeta() {
  STATUS_COLETA_FALHAS = 0;
  refreshStatusColeta();
  loadMaquinas();
  // Base qualificada já aberta com tudo (e a lista de cidades preenchida),
  // sem precisar clicar em Buscar na primeira vez.
  if (!BQ_AUTO_CARREGADA) { BQ_AUTO_CARREGADA = true; loadBaseQualificada(); }
  if (MAQUINAS_INTERVAL) clearInterval(MAQUINAS_INTERVAL);
  MAQUINAS_INTERVAL = setInterval(() => { if (!document.hidden) loadMaquinas(); }, 60000);
  if (STATUS_COLETA_INTERVAL) clearInterval(STATUS_COLETA_INTERVAL);
  STATUS_COLETA_INTERVAL = setInterval(refreshStatusColeta, 20000);
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
    const [resp, dest] = await Promise.all([
      rpc("rpc_admin_listar_filtros", { p_admin_password: ADMIN_PASS, p_login: login }),
      // Destinos dos filtros (SQL DEST_1). Sem o SQL, o seletor não aparece.
      rpc("rpc_admin_destinos_filtros", { p_admin_password: ADMIN_PASS, p_login: login }).catch(() => null)
    ]);
    const destinos = (dest && dest.ok) ? Object.fromEntries((dest.destinos || []).filter(d => d.destino_login).map(d => [String(d.id), d.destino_login])) : null;
    // Horário próprio de cada filtro (SQL DEST_2). Sem o SQL, o campo não aparece.
    const horarios = (dest && dest.ok && (dest.destinos || []).some(d => "horario" in d)) || (dest && dest.ok && !(dest.destinos || []).length)
      ? Object.fromEntries((dest.destinos || []).filter(d => d.horario).map(d => [String(d.id), d.horario])) : null;
    const usuario = USUARIOS_COLETOR_CACHE.find(u => u.login === login);
    renderFiltrosOperador(login, Array.isArray(resp) ? resp : [], destinos, horarios, usuario && usuario.horario_coleta);
  } catch (e) {
    painel.innerHTML = `<small style="color:#c2410c">❌ ${esc(e.message)}</small>`;
  }
}

// Filtro com destino: o filtro roda no computador deste login (com a Catho
// dele), mas os contatos coletados entram na fila do login escolhido em
// "Entregar para", que dispara pelo próprio WhatsApp. Não vão para o pool.
function seletorDestino_(login, f, destinos) {
  if (!destinos) return "";
  const atual = destinos[String(f.id)] || "";
  const opcoes = USUARIOS_COLETOR_CACHE
    .filter(u => u.login !== login && (u.ativo || u.login === atual))
    .map(u => `<option value="${esc(u.login)}" ${u.login === atual ? "selected" : ""}>${esc(u.nome_operador || u.login)} (${esc(u.login)})</option>`).join("");
  return `<div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <label style="font-size:11px;font-weight:700;color:${atual ? "#5b21b6" : "#555"}">📦 Entregar para:</label>
      <select class="destinoFiltroSel" data-id="${esc(f.id)}" style="font-size:11px;padding:3px 6px;max-width:260px">
        <option value="">Própria fila (${esc(login)})</option>${opcoes}
      </select>
      ${atual ? '<small style="color:#5b21b6">coleta aqui, o disparo é no computador do cliente</small>' : ""}
    </div>`;
}

// Horário próprio do filtro: roda nesse horário, todo dia, no computador do
// login dono do filtro. Vazio = segue o horário do login.
function seletorHorario_(f, horarios, horarioLogin) {
  if (!horarios) return "";
  const atual = horarios[String(f.id)] || "";
  return `<div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <label style="font-size:11px;font-weight:700;color:${atual ? "#5b21b6" : "#555"}">⏰ Horário deste filtro:</label>
      <input type="time" class="horarioFiltroInp" data-id="${esc(f.id)}" value="${esc(atual)}" style="font-size:11px;padding:2px 6px;width:auto">
      ${atual ? `<button type="button" class="ghost limparHorarioFiltroBtn" data-id="${esc(f.id)}" style="padding:2px 7px;font-size:10px">usar o do login</button>`
               : `<small style="color:#888">${horarioLogin ? "vazio = segue o horário do login (" + esc(horarioLogin) + ")" : "vazio = só roda manualmente (o login não tem horário)"}</small>`}
    </div>`;
}

function renderFiltrosOperador(login, filtros, destinos, horarios, horarioLogin) {
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
            ${seletorDestino_(login, f, destinos)}
            ${seletorHorario_(f, horarios, horarioLogin)}
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
      <button type="button" class="danger zerarFilaBtn">🗑 Zerar fila (reiniciar operação)</button>
      <button type="button" class="secondary operacaoNovaBtn" title="Encerra os contatos que ficaram em Novo, zera a fila e começa uma nova contagem do funil">🔄 Começar operação nova</button>
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

  // "Zerar fila": limpa o que estava preso na fila/falhas/dúvidas desse
  // operador e para o disparo, sem mexer em quem já foi confirmado enviado
  // (não reenvia duplicado). Útil quando ele avisa que deu erro e você quer
  // recomeçar do zero sem precisar mexer no computador dele.
  painel.querySelector(".zerarFilaBtn")?.addEventListener("click", async (ev) => {
    if (!confirm(`Zerar a fila de envio de "${login}"?\n\nIsso limpa a fila pendente, os itens em falha/dúvida e para o disparo dele. Quem já foi confirmado enviado continua protegido (não recebe mensagem de novo). A próxima coleta recomeça do zero.`)) return;
    const btn = ev.currentTarget;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Enviando comando...";
    try {
      await rpc("rpc_admin_definir_comando", { p_admin_password: ADMIN_PASS, p_login: login, p_comando: { tipo: "ZERAR_FILA" } });
      alert("✅ Comando enviado. A fila desse operador é zerada em até 3 minutos, assim que a extensão dele checar (precisa do Chrome dele aberto).");
    } catch (e) {
      alert("❌ " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  painel.querySelector(".operacaoNovaBtn")?.addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try { await comecarOperacaoNova(login, login); }
    finally { btn.disabled = false; }
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

  painel.querySelectorAll(".destinoFiltroSel").forEach(sel => {
    sel.addEventListener("change", async () => {
      const destino = sel.value;
      const nome = sel.options[sel.selectedIndex].textContent;
      if (destino && !confirm(`Entregar os contatos deste filtro para ${nome}?\n\nA coleta continua no computador de "${login}" (com a Catho dele). Os contatos entram na fila de ${nome}, que dispara pelo WhatsApp dele. Eles não vão para o pool nem para a fila de "${login}".`)) {
        carregarFiltrosOperador(login); return;
      }
      sel.disabled = true;
      try {
        const r = await rpc("rpc_admin_definir_destino_filtro", { p_admin_password: ADMIN_PASS, p_login: login, p_id: sel.dataset.id, p_destino: destino || null });
        if (r && r.ok === false) throw new Error(r.error || "Falha ao salvar");
        carregarFiltrosOperador(login);
      } catch (e) {
        alert("❌ " + e.message);
        carregarFiltrosOperador(login);
      }
    });
  });

  const salvarHorario = async (id, horario, el) => {
    if (el) el.disabled = true;
    try {
      const r = await rpc("rpc_admin_definir_horario_filtro", { p_admin_password: ADMIN_PASS, p_login: login, p_id: id, p_horario: horario || null });
      if (r && r.ok === false) throw new Error(r.error || "Falha ao salvar");
    } catch (e) {
      alert("❌ " + e.message);
    }
    carregarFiltrosOperador(login);
  };
  painel.querySelectorAll(".horarioFiltroInp").forEach(inp => {
    inp.addEventListener("change", () => { if (inp.value) salvarHorario(inp.dataset.id, inp.value, inp); });
  });
  painel.querySelectorAll(".limparHorarioFiltroBtn").forEach(btn => {
    btn.addEventListener("click", () => salvarHorario(btn.dataset.id, null, btn));
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
      // Senha de plataforma não é mais guardada: a extensão entra no pool
      // pelo servidor (/api/ext-sessao), só com o e-mail.
      p_senha_plataforma: null,
      p_limite_pool: $("fLimitePool").value,
      // Corretores CRECI: só o e-mail; o acesso é gerado pelo servidor.
      p_email_rhi: emailRhi || null,
      p_senha_rhi: null
    });
    if (!resp.ok) { $("formMsg").textContent = "❌ " + resp.error; return; }

    const novo = !USUARIOS_COLETOR_CACHE.some(u => String(u.login).toLowerCase() === login.toLowerCase());
    if (novo && VALIDADE_PODE_EDITAR) {
      const p = $("fValidade").value;
      const v = await rpc("rpc_admin_definir_validade", {
        p_admin_password: ADMIN_PASS, p_login: login,
        p_inicio: hojeBR(), p_fim: p === "sem" ? null : somarPeriodo(hojeBR(), p)
      }).catch(e => ({ ok: false, error: e.message }));
      if (!v.ok) { $("formMsg").textContent = "⚠️ Operador salvo, mas a validade não: " + v.error; loadUsuarios(); return; }
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

// Quem já é super-admin aqui não precisa digitar senha de novo lá —
// a página de avaliações confia nessa mesma chave de localStorage.
$("btnAbrirAvaliacoes")?.addEventListener("click", () => {
  if (CURRENT_ADMIN && !CURRENT_ADMIN.conta_id_plataforma) {
    localStorage.setItem("rh_painel_ok", "Meldesouza1508$");
  }
  window.open("/admin-avaliacoes", "_blank", "noopener");
});

// ===== Logins da extensão RHIMOB_NT_ENRIQUECIMENTO (Novos Talentos) =====
let USUARIOS_ENRIQ_CACHE = [];

async function apiEnriquecimentoUsuarios(payload) {
  const login = (CURRENT_ADMIN && CURRENT_ADMIN.login) || "";
  const url = "/api/enriquecimento-usuarios?token=" + encodeURIComponent(ADMIN_PASS) + "&login=" + encodeURIComponent(login);
  const opts = payload
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    : undefined;
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || "Falha na API de logins do Enriquecimento");
  return data;
}

async function loadUsuariosEnriquecimento() {
  const tbody = $("listaUsuariosEnriquecimento");
  if (!tbody) return;
  try {
    const data = await apiEnriquecimentoUsuarios(null);
    USUARIOS_ENRIQ_CACHE = data.usuarios || [];
    renderUsuariosEnriquecimento();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4"><small>❌ ${esc(e.message)}</small></td></tr>`;
  }
}

function renderUsuariosEnriquecimento() {
  const tbody = $("listaUsuariosEnriquecimento");
  if (!tbody) return;
  if (!USUARIOS_ENRIQ_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="4"><small>Nenhum login cadastrado ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = USUARIOS_ENRIQ_CACHE.map(u => `
    <tr>
      <td><small>${esc(u.login)}</small></td>
      <td><small>${esc(u.nome || "—")}</small></td>
      <td><span class="badge ${u.ativo ? "" : "bloqueado"}">${u.ativo ? "Ativo" : "Inativo"}</span></td>
      <td style="white-space:nowrap">
        <button data-id="${esc(u.id)}" class="ghost euEditBtn" style="padding:4px 8px;font-size:11px">Editar</button>
        <button data-id="${esc(u.id)}" data-ativo="${u.ativo}" class="${u.ativo ? "danger" : "secondary"} euToggleBtn" style="padding:4px 8px;font-size:11px">${u.ativo ? "Desativar" : "Ativar"}</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".euEditBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const u = USUARIOS_ENRIQ_CACHE.find(x => String(x.id) === btn.dataset.id);
      if (!u) return;
      $("euId").value = u.id;
      $("euLogin").value = u.login;
      $("euNome").value = u.nome || "";
      $("euSenha").value = "";
      $("euSenhaLabel").textContent = "Senha (deixe em branco pra manter a atual)";
      $("euMsg").textContent = "";
    });
  });
  tbody.querySelectorAll(".euToggleBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const ativo = btn.dataset.ativo === "true";
      try {
        await apiEnriquecimentoUsuarios({ acao: "editar", id: btn.dataset.id, ativo: !ativo });
        await loadUsuariosEnriquecimento();
      } catch (e) {
        alert("❌ " + e.message);
      }
    });
  });
}

$("btnGerarSenhaEu")?.addEventListener("click", () => {
  $("euSenha").value = Math.random().toString(36).slice(2, 10) + "A1";
});

$("btnLimparUsuarioEnriquecimento")?.addEventListener("click", () => {
  $("euId").value = "";
  $("euLogin").value = "";
  $("euNome").value = "";
  $("euSenha").value = "";
  $("euSenhaLabel").textContent = "Senha";
  $("euMsg").textContent = "";
});

$("btnSalvarUsuarioEnriquecimento")?.addEventListener("click", async () => {
  const msg = $("euMsg");
  const id = $("euId").value.trim();
  const loginVal = $("euLogin").value.trim().toLowerCase();
  const nome = $("euNome").value.trim();
  const senha = $("euSenha").value.trim();
  if (!loginVal) { msg.textContent = "❌ Preencha o login."; return; }
  if (!id && (!senha || senha.length < 6)) { msg.textContent = "❌ Senha precisa ter pelo menos 6 caracteres."; return; }
  msg.textContent = "Salvando...";
  try {
    if (id) {
      await apiEnriquecimentoUsuarios({ acao: "editar", id, nome, senha: senha || undefined });
    } else {
      await apiEnriquecimentoUsuarios({ acao: "criar", login: loginVal, nome, senha });
    }
    msg.textContent = "✅ Salvo.";
    $("btnLimparUsuarioEnriquecimento").click();
    await loadUsuariosEnriquecimento();
  } catch (e) {
    msg.textContent = "❌ " + e.message;
  }
});

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

// ===== Validade de acesso (operadores + empresas das plataformas) =====
// Datas "AAAA-MM-DD" no dia de Brasília. O acesso vale até o fim do dia
// final; no dia seguinte o próprio banco bloqueia (SQL ACESSO_1 e ACESSO_2) —
// este painel só mostra, avisa e renova. Data final vazia = sem vencimento.
let VALIDADE_OPER = {};          // login -> linha de rpc_admin_validade_usuarios
let VALIDADE_HOJE = null;        // "hoje" do banco (evita relógio errado do PC)
let VALIDADE_PODE_EDITAR = false;
let VALIDADE_ERRO = "";
const AVISAR_DIAS_ANTES = 3;

function hojeBR() {
  return VALIDADE_HOJE || new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function dataBR(iso) {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
function diasAte(iso) {
  return Math.round((Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") - Date.parse(hojeBR() + "T00:00:00Z")) / 86400000);
}
// "30:d" = 30 dias, "12:m" = 12 meses. 31/01 + 1 mês = 28/02 (não pula pra março).
function somarPeriodo(iso, periodo) {
  const [n, u] = String(periodo).split(":");
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  if (u === "m") {
    const dia = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + Number(n));
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dia, ultimo));
  } else {
    d.setUTCDate(d.getUTCDate() + Number(n));
  }
  return d.toISOString().slice(0, 10);
}
function validadeInicial(periodo) {
  return { data_inicio: hojeBR(), data_fim: periodo === "sem" ? null : somarPeriodo(hojeBR(), periodo) };
}
function seloValidade(fim) {
  if (!fim) return { nivel: "sem", html: '<span class="selo sem">⚫ Sem vencimento</span>' };
  const dias = diasAte(fim);
  if (dias < 0) return { nivel: "vencido", dias, html: `<span class="selo vencido">🔴 Venceu em ${dataBR(fim)}</span>` };
  if (dias <= AVISAR_DIAS_ANTES) {
    const quando = dias === 0 ? "Vence hoje" : `Vence em ${dias} dia${dias > 1 ? "s" : ""}`;
    return { nivel: "logo", dias, html: `<span class="selo logo">🟡 ${quando}</span>` };
  }
  return { nivel: "ok", dias, html: `<span class="selo ok">🟢 ${dias} dias</span>` };
}
function botoesValidade(attrs, classe) {
  if (!VALIDADE_PODE_EDITAR) return "";
  return `<br><button ${attrs} class="${classe}" data-modo="renovar" style="padding:3px 7px;font-size:10px;margin-top:4px">🔄 Renovar</button>
    <button ${attrs} class="ghost ${classe}" data-modo="editar" style="padding:3px 7px;font-size:10px;margin-top:4px">📅 Datas</button>`;
}

async function loadValidadeOperadores() {
  try {
    const r = await rpc("rpc_admin_validade_usuarios", { p_admin_password: ADMIN_PASS });
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
    VALIDADE_HOJE = r.hoje || null;
    VALIDADE_PODE_EDITAR = !!r.pode_editar;
    VALIDADE_OPER = {};
    (r.usuarios || []).forEach(v => { VALIDADE_OPER[v.login] = v; });
    VALIDADE_ERRO = "";
  } catch (e) {
    VALIDADE_ERRO = /rpc_admin_validade_usuarios|function|não existe|does not exist|404/i.test(e.message)
      ? "Falta rodar o SQL ACESSO_1 no Supabase do Coletor."
      : e.message;
    // empresas das plataformas não dependem desse SQL: super-admin edita igual
    VALIDADE_PODE_EDITAR = !!(CURRENT_ADMIN && !CURRENT_ADMIN.conta_id_plataforma && CURRENT_ADMIN.nivel !== "agendamentos");
  }
  const box = $("fValidadeBox");
  if (box) box.classList.toggle("hide", !VALIDADE_PODE_EDITAR);
}

function celulaValidadeOperador(u) {
  if (VALIDADE_ERRO) return `<small style="color:#999">${esc(VALIDADE_ERRO)}</small>`;
  const v = VALIDADE_OPER[u.login];
  if (!v) return '<small style="color:#999">—</small>';
  const s = seloValidade(v.acesso_fim);
  const periodo = v.acesso_fim ? `<br><small style="color:#666">${dataBR(v.acesso_inicio)} → ${dataBR(v.acesso_fim)}</small>` : "";
  const motivo = v.bloqueado_por_vencimento ? '<br><small style="color:#991b1b">bloqueado por vencimento</small>' : "";
  return s.html + periodo + motivo + botoesValidade(`data-login="${esc(u.login)}"`, "validadeOperBtn");
}

function celulaUsoOperador(u) {
  const v = VALIDADE_OPER[u.login];
  if (!v || !v.uso) return '<small style="color:#999">—</small>';
  const x = v.uso, temPeriodo = !!v.acesso_inicio;
  const n = (tot, per) => `<b>${tot || 0}</b>${temPeriodo ? ` <span style="color:#888">(${per || 0})</span>` : ""}`;
  return `<small style="white-space:nowrap;line-height:1.6">
    📤 Abordados: ${n(x.abordados_total, x.abordados_periodo)}<br>
    🧩 Banco de Talentos: ${n(x.banco_total, x.banco_periodo)}<br>
    🏘️ CRECI: ${n(x.creci_total, x.creci_periodo)}<br>
    🔎 Catho: ${n(x.catho_total, x.catho_periodo)}
    ${temPeriodo ? `<br><span style="color:#888">(entre parênteses: desde ${dataBR(v.acesso_inicio)})</span>` : ""}
  </small>`;
}

function celulaValidadeConta(c, tipo) {
  const s = seloValidade(c.data_fim);
  const periodo = c.data_fim ? `<br><small style="color:#666">${dataBR(c.data_inicio)} → ${dataBR(c.data_fim)}</small>` : "";
  const id = tipo === "nt" ? c.conta_id : c.id;
  return s.html + periodo + botoesValidade(`data-tipo="${tipo}" data-conta="${esc(id)}"`, "validadeContaBtn");
}

// ---------- diálogo: renovar / definir datas ----------
function dialogoValidade({ titulo, inicio, fim, modo, valorSugerido }) {
  let dlg = $("dlgValidade");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "dlgValidade";
    dlg.innerHTML = `
      <h3 id="dvTitulo" style="margin:0 0 4px;font-size:15px"></h3>
      <div id="dvSub" style="font-size:12px;color:#666;margin-bottom:10px"></div>
      <label>Início do acesso</label><input id="dvInicio" type="date">
      <label>Período</label>
      <select id="dvPeriodo">
        <option value="30:d">30 dias</option><option value="3:m">3 meses</option>
        <option value="6:m">6 meses</option><option value="12:m">12 meses (anual)</option>
        <option value="livre">Escolher a data final</option><option value="sem">Sem vencimento</option>
      </select>
      <label>Acesso vale até (inclusive)</label><input id="dvFim" type="date">
      <div id="dvPagtoBox" style="margin-top:6px;padding-top:8px;border-top:1px dashed #e4dbe8">
        <label>Registrar no histórico de contratos</label>
        <select id="dvPagto">
          <option value="pago">✅ Pago (gera recibo)</option>
          <option value="receber">⏳ A receber</option>
          <option value="nao">Não registrar</option>
        </select>
        <div style="display:flex;gap:8px">
          <div style="flex:1"><label>Valor (R$)</label><input id="dvValor" type="number" min="0" step="0.01" placeholder="999,00"></div>
          <div style="flex:1"><label>Forma</label><select id="dvForma"><option>Pix</option><option>Boleto</option><option>Cartão</option><option>Transferência</option><option>Dinheiro</option></select></div>
        </div>
      </div>
      <div id="dvMsg" class="msg"></div>
      <div class="btns" style="margin-top:12px">
        <button id="dvSalvar">💾 Salvar</button>
        <button id="dvCancelar" class="ghost">Cancelar</button>
      </div>`;
    document.body.appendChild(dlg);
  }
  const ini = $("dvInicio"), per = $("dvPeriodo"), fimEl = $("dvFim"), msg = $("dvMsg");
  const hoje = hojeBR();
  const vencido = fim && fim < hoje;
  // Renovar: soma a partir do fim atual (não perde dias já pagos); se já
  // venceu, recomeça hoje. Datas: soma a partir do início.
  const base = () => modo === "renovar" ? (fim && !vencido ? fim : hoje) : (ini.value || hoje);
  const recalcular = () => {
    if (per.value === "sem") { fimEl.value = ""; fimEl.disabled = true; return; }
    fimEl.disabled = false;
    if (per.value !== "livre") fimEl.value = somarPeriodo(base(), per.value);
  };
  $("dvTitulo").textContent = (modo === "renovar" ? "🔄 Renovar — " : "📅 Validade — ") + titulo;
  $("dvSub").textContent = fim
    ? `Hoje: ${vencido ? "venceu em" : "vale até"} ${dataBR(fim)}.` + (modo === "renovar" ? (vencido ? " A renovação conta a partir de hoje." : " A renovação soma a partir dessa data.") : "")
    : "Hoje: sem vencimento.";
  ini.value = modo === "renovar" && (vencido || !inicio) ? hoje : (inicio || hoje);
  ini.disabled = modo === "renovar";
  per.value = modo === "editar" && !fim ? "sem" : (modo === "editar" ? "livre" : "30:d");
  fimEl.value = fim || "";
  msg.textContent = "";
  // valor/pagamento: só faz sentido na renovação; sugere o valor do último contrato
  const pagtoBox = $("dvPagtoBox"), pagto = $("dvPagto"), valorEl = $("dvValor");
  pagtoBox.classList.toggle("hide", modo !== "renovar" || !VALIDADE_PODE_EDITAR);
  pagto.value = "pago";
  valorEl.value = valorSugerido != null ? valorSugerido : "";
  $("dvForma").value = "Pix";
  if (modo === "renovar") recalcular(); else { fimEl.disabled = per.value === "sem"; }
  per.onchange = recalcular;
  ini.onchange = () => { if (per.value !== "livre") recalcular(); };
  fimEl.oninput = () => { per.value = "livre"; };

  return new Promise(resolve => {
    $("dvCancelar").onclick = () => { dlg.close(); resolve(null); };
    dlg.onclose = () => resolve(null);
    $("dvSalvar").onclick = () => {
      const novoIni = ini.value || hoje;
      const novoFim = per.value === "sem" ? null : (fimEl.value || null);
      if (per.value !== "sem" && !novoFim) { msg.textContent = "❌ Escolha a data final (ou \"Sem vencimento\")."; return; }
      if (novoFim && novoFim < novoIni) { msg.textContent = "❌ A data final não pode ser antes do início."; return; }
      if (novoFim && novoFim < hoje && !confirm(`A data final (${dataBR(novoFim)}) já passou — o acesso será bloqueado agora. Continuar?`)) return;
      const registrar = modo === "renovar" && !pagtoBox.classList.contains("hide") && pagto.value !== "nao";
      if (registrar && !(Number(valorEl.value) > 0) && !confirm("Registrar o contrato sem valor?")) return;
      dlg.onclose = null;
      dlg.close();
      resolve({ inicio: novoIni, fim: novoFim,
        contrato: registrar ? { valor: valorEl.value || null, forma_pagamento: $("dvForma").value, pago_em: pagto.value === "pago" ? hoje : null } : null });
    };
    dlg.showModal();
  });
}

async function editarValidadeOperador(login, modo) {
  const v = VALIDADE_OPER[login] || {};
  const u = USUARIOS_COLETOR_CACHE.find(x => x.login === login) || {};
  const r = await dialogoValidade({ titulo: u.nome_operador || login, inicio: v.acesso_inicio, fim: v.acesso_fim, modo,
    valorSugerido: ultimoValor("operador", login) });
  if (!r) return;
  try {
    const resp = await rpc("rpc_admin_definir_validade", { p_admin_password: ADMIN_PASS, p_login: login, p_inicio: r.inicio, p_fim: r.fim });
    if (!resp.ok) { alert("❌ " + resp.error); return; }
    if (r.contrato) await registrarContrato({ ...r.contrato, cliente_tipo: "operador", cliente_id: login,
      cliente_nome: u.nome_operador || login, inicio: renovacaoInicio(v.acesso_fim, r.inicio), fim: r.fim });
    await loadUsuarios();
  } catch (e) {
    alert("❌ " + e.message);
  }
}

async function editarValidadeConta(tipo, contaId, modo) {
  const cache = tipo === "nt" ? CONTAS_CACHE : CONTAS_RHI_CACHE;
  const c = cache.find(x => String(tipo === "nt" ? x.conta_id : x.id) === String(contaId));
  if (!c) return;
  const fimAtual = c.data_fim ? String(c.data_fim).slice(0, 10) : null;
  const iniAtual = c.data_inicio ? String(c.data_inicio).slice(0, 10) : null;
  const tipoContrato = tipo === "nt" ? "empresa_nt" : "empresa_rhi";
  const r = await dialogoValidade({ titulo: c.nome_conta || c.nome_empresa || contaId, inicio: iniAtual, fim: fimAtual, modo,
    valorSugerido: ultimoValor(tipoContrato, contaId) });
  if (!r) return;
  const payload = { acao: "editar_conta", conta_id: contaId, data_inicio: r.inicio, data_fim: r.fim };
  // Empresa que caiu por vencimento volta a ficar ATIVA quando a nova data
  // ainda vale. Desativada à mão (sem estar vencida) continua desativada.
  const caiuPorVencimento = String(c.status || "").toUpperCase() !== "ATIVA" && fimAtual && fimAtual < hojeBR();
  if (caiuPorVencimento && (!r.fim || r.fim >= hojeBR())) payload.status = "ATIVA";
  try {
    if (tipo === "nt") { await apiContas(payload); }
    else { await apiContasRhi(payload); }
    if (r.contrato) await registrarContrato({ ...r.contrato, cliente_tipo: tipoContrato, cliente_id: String(contaId),
      cliente_nome: c.nome_conta || c.nome_empresa || contaId, inicio: renovacaoInicio(fimAtual, r.inicio), fim: r.fim });
    if (tipo === "nt") await loadContasPlataforma(); else await loadContasRhi();
  } catch (e) {
    alert("❌ " + e.message);
  }
}

// ---------- filtros com horário que não rodaram hoje (SQL COLETA_1) ----------
let FILTROS_ATRASADOS = [];
async function loadFiltrosAtrasados() {
  try {
    const r = await rpc("rpc_admin_filtros_atrasados", { p_admin_password: ADMIN_PASS });
    FILTROS_ATRASADOS = (r && r.ok && r.filtros) || [];
  } catch (e) {
    FILTROS_ATRASADOS = []; // sem o SQL ainda: só não mostra o aviso
  }
}
function abrirFiltrosDoOperador(login) {
  document.querySelector('[data-tab="tabOperadores"]')?.click();
  const row = document.querySelector(`.filtrosRow[data-login-row="${CSS.escape(login)}"]`);
  if (row && row.classList.contains("hide")) toggleFiltrosPanel(login);
  setTimeout(() => (row || $("listaUsuarios"))?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
}

// ---------- aviso no topo: vence em até 3 dias ou já venceu ----------
function renderAvisosValidade() {
  const box = $("avisosValidade");
  if (!box) return;
  const itens = [];
  const add = (fim, nome, onde, abrir, cliente) => {
    const s = seloValidade(fim);
    if (s.nivel !== "logo" && s.nivel !== "vencido") return;
    if (s.nivel === "vencido" && s.dias < -30) return; // vencido há mais de 30 dias: já não é novidade
    itens.push({ dias: s.dias, html: `${s.html} <b>${esc(nome)}</b> <small style="color:#666">${onde} · até ${dataBR(fim)}</small>`, abrir, cliente: { ...cliente, nome, fim } });
  };
  USUARIOS_COLETOR_CACHE.forEach(u => {
    const v = VALIDADE_OPER[u.login];
    if (v && v.acesso_fim) add(v.acesso_fim, u.nome_operador || u.login, "operador da extensão", () => editarValidadeOperador(u.login, "renovar"), { tipo: "operador", id: u.login });
  });
  CONTAS_CACHE.forEach(c => { if (c.data_fim) add(String(c.data_fim).slice(0, 10), c.nome_conta || c.conta_id, "empresa · Novos Talentos", () => editarValidadeConta("nt", c.conta_id, "renovar"), { tipo: "empresa_nt", id: c.conta_id }); });
  CONTAS_RHI_CACHE.forEach(c => { if (c.data_fim) add(String(c.data_fim).slice(0, 10), c.nome_empresa || c.id, "empresa · Corretores CRECI", () => editarValidadeConta("rhi", c.id, "renovar"), { tipo: "empresa_rhi", id: c.id }); });
  itens.sort((a, b) => a.dias - b.dias);
  const filtros = FILTROS_ATRASADOS.map(f => {
    const ult = f.ultima_coleta ? new Date(f.ultima_coleta).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca";
    const oque = f.motivo === "erro"
      ? `<span class="selo vencido">⚠️ Rodou com erro</span>`
      : `<span class="selo logo">⏰ Não rodou hoje</span>`;
    const para = f.destino_login ? ` → ${esc(f.destino_login)}` : "";
    const detalhe = f.motivo === "erro" ? esc(String(f.ultimo_erro || "").slice(0, 120)) : `última coleta: ${ult}`;
    return { html: `${oque} <b>${esc(f.nome_operador || f.login)}</b> <small style="color:#666">filtro das ${esc(f.horario)}${para} · ${detalhe}</small>`, login: f.login };
  });
  const total = itens.length + filtros.length;
  box.classList.toggle("hide", !total);
  if (!total) { box.innerHTML = ""; return; }
  box.innerHTML = `<h3 style="margin:0 0 6px;font-size:14px">⏳ Avisos (${total})</h3>`;
  if (filtros.length) {
    const h = document.createElement("small");
    h.style.cssText = "display:block;color:#92400e;margin-top:4px";
    h.textContent = "Filtros com horário que não coletaram hoje — confira se o Chrome do operador está aberto, com a Catho logada.";
    box.appendChild(h);
    filtros.forEach(f => {
      const d = document.createElement("div");
      d.className = "item";
      d.innerHTML = f.html;
      const b = document.createElement("button");
      b.textContent = "📋 Ver filtro";
      b.className = "ghost";
      b.style.cssText = "padding:3px 8px;font-size:11px;margin-left:auto";
      b.addEventListener("click", () => abrirFiltrosDoOperador(f.login));
      d.appendChild(b);
      box.appendChild(d);
    });
  }
  if (itens.length) {
    const h = document.createElement("small");
    h.style.cssText = "display:block;color:#92400e;margin-top:8px";
    h.textContent = "Acessos vencendo — sem renovação, o bloqueio é automático no dia seguinte ao vencimento.";
    box.appendChild(h);
  }
  itens.forEach(it => {
    const d = document.createElement("div");
    d.className = "item";
    d.innerHTML = it.html;
    if (VALIDADE_PODE_EDITAR) {
      const m = document.createElement("button");
      m.textContent = "📋 Mensagem";
      m.className = "ghost";
      m.title = "Copia a mensagem de renovação para colar no WhatsApp/e-mail do cliente";
      m.style.cssText = "padding:3px 8px;font-size:11px;margin-left:auto";
      m.addEventListener("click", () => copiarMensagemRenovacao(it.cliente, m));
      d.appendChild(m);
      const b = document.createElement("button");
      b.textContent = "🔄 Renovar";
      b.style.cssText = "padding:3px 8px;font-size:11px";
      b.addEventListener("click", it.abrir);
      d.appendChild(b);
    }
    box.appendChild(d);
  });
}

// Se já tinha sessão de admin aberta (mesma aba), pula a tela de login.
if (ADMIN_PASS) {
  fazerLogin(ADMIN_PASS).catch(() => {});
}

// ===== Contratos e pagamentos (SQL CONTRATOS_1) =====
// Registro de cada renovação (período, valor, pago/a receber), recibo e a
// mensagem de renovação pronta para o cliente. Só o super-admin vê.
let CONTRATOS_CACHE = [];
let EMITENTE = null;
const SERVICO_POR_TIPO = {
  operador: "Extensão RH IMOB Aceleradora",
  empresa_nt: "Plataforma Novos Talentos",
  empresa_rhi: "Banco de Corretores CRECI"
};
const brl = (v) => v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ultimoValor(tipo, id) {
  const c = CONTRATOS_CACHE.find(x => x.cliente_tipo === tipo && String(x.cliente_id) === String(id) && x.valor != null);
  return c ? Number(c.valor) : null;
}
// período pago desta renovação: emenda no fim anterior (se ainda valia) ou começa hoje
function renovacaoInicio(fimAntigo, inicioDialogo) {
  const hoje = hojeBR();
  if (fimAntigo && fimAntigo >= hoje) return somarPeriodo(fimAntigo, "1:d");
  return inicioDialogo && inicioDialogo >= hoje ? inicioDialogo : hoje;
}

async function registrarContrato(dados) {
  try {
    const r = await rpc("rpc_admin_registrar_contrato", { p_admin_password: ADMIN_PASS,
      p_dados: { ...dados, servico: SERVICO_POR_TIPO[dados.cliente_tipo] || "" } });
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
    await loadContratos();
    if (dados.pago_em && confirm("✅ Renovado e registrado como pago.\n\nAbrir o recibo agora?")) abrirRecibo(r.id);
  } catch (e) {
    alert("⚠️ A validade foi salva, mas o contrato não entrou no histórico: " +
      (/rpc_admin_registrar_contrato|function|404/i.test(e.message) ? "falta rodar o SQL CONTRATOS_1." : e.message));
  }
}

function abrirRecibo(id) {
  window.open(`recibo.html?id=${encodeURIComponent(id)}`, "_blank"); // sem noopener: leva a sessão de admin
}

async function loadContratos() {
  const tbody = $("listaContratos");
  if (!tbody) return;
  const card = $("cardContratos");
  const superAdmin = CURRENT_ADMIN && !CURRENT_ADMIN.conta_id_plataforma && CURRENT_ADMIN.nivel !== "agendamentos";
  if (card) card.classList.toggle("hide", !superAdmin);
  if (!superAdmin) return;
  try {
    const [r, e] = await Promise.all([
      rpc("rpc_admin_listar_contratos", { p_admin_password: ADMIN_PASS }),
      EMITENTE ? Promise.resolve(null) : rpc("rpc_admin_emitente", { p_admin_password: ADMIN_PASS }).catch(() => null)
    ]);
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
    CONTRATOS_CACHE = r.contratos || [];
    if (e && e.ok) EMITENTE = e.emitente;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><small>${/rpc_admin_listar_contratos|function|404/i.test(err.message) ? "Falta rodar o SQL CONTRATOS_1 no Supabase do Coletor." : esc(err.message)}</small></td></tr>`;
    return;
  }
  renderContratos();
}

function renderContratos() {
  const tbody = $("listaContratos");
  const mes = hojeBR().slice(0, 7);
  const recebidoMes = CONTRATOS_CACHE.filter(c => c.pago_em && String(c.pago_em).slice(0, 7) === mes).reduce((t, c) => t + Number(c.valor || 0), 0);
  const aReceber = CONTRATOS_CACHE.filter(c => !c.pago_em);
  const totalReceber = aReceber.reduce((t, c) => t + Number(c.valor || 0), 0);
  const resumo = $("contratosResumo");
  if (resumo) resumo.innerHTML = `<span class="selo ok">💵 Recebido no mês: ${brl(recebidoMes)}</span> `
    + `<span class="selo ${aReceber.length ? "logo" : "sem"}">⏳ A receber: ${brl(totalReceber)} (${aReceber.length})</span>`;
  if (!CONTRATOS_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="6"><small>Nenhum contrato registrado ainda. Eles entram aqui quando você usa 🔄 Renovar com "Pago" ou "A receber".</small></td></tr>';
    return;
  }
  tbody.innerHTML = CONTRATOS_CACHE.map(c => `
    <tr>
      <td><b>${esc(c.cliente_nome || c.cliente_id)}</b><br><small>${esc(c.cliente_tipo === "operador" ? c.cliente_id : (c.cliente_tipo === "empresa_nt" ? "empresa · Novos Talentos" : "empresa · CRECI"))}</small></td>
      <td><small>${esc(c.servico || "")}</small></td>
      <td>${dataBR(c.inicio)} → ${c.fim ? dataBR(c.fim) : "sem vencimento"}</td>
      <td><b>${brl(c.valor)}</b></td>
      <td>${c.pago_em ? `<span class="selo ok">✅ Pago ${dataBR(c.pago_em)}</span><br><small>${esc(c.forma_pagamento || "")}</small>`
                      : `<span class="selo logo">⏳ A receber</span>`}</td>
      <td style="white-space:nowrap">
        ${c.pago_em ? `<button class="ghost reciboBtn" data-id="${c.id}" style="padding:4px 8px;font-size:11px">🧾 Recibo</button>`
                    : `<button class="secondary pagoBtn" data-id="${c.id}" style="padding:4px 8px;font-size:11px">✅ Marcar pago</button>`}
        <button class="danger excluirContratoBtn" data-id="${c.id}" style="padding:4px 8px;font-size:11px">Excluir</button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll(".reciboBtn").forEach(b => b.addEventListener("click", () => abrirRecibo(b.dataset.id)));
  tbody.querySelectorAll(".pagoBtn").forEach(b => b.addEventListener("click", async () => {
    const forma = prompt("Forma de pagamento:", "Pix");
    if (forma === null) return;
    b.disabled = true;
    try {
      const r = await rpc("rpc_admin_atualizar_contrato", { p_admin_password: ADMIN_PASS, p_id: Number(b.dataset.id), p_dados: { pago_em: hojeBR(), forma_pagamento: forma || "Pix" } });
      if (!r.ok) throw new Error(r.error || "não atualizou");
      await loadContratos();
      if (confirm("✅ Marcado como pago. Abrir o recibo?")) abrirRecibo(b.dataset.id);
    } catch (e) { alert("❌ " + e.message); b.disabled = false; }
  }));
  tbody.querySelectorAll(".excluirContratoBtn").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Excluir este registro do histórico? (A validade do acesso não muda.)")) return;
    b.disabled = true;
    try {
      const r = await rpc("rpc_admin_atualizar_contrato", { p_admin_password: ADMIN_PASS, p_id: Number(b.dataset.id), p_dados: { excluir: true } });
      if (!r.ok) throw new Error(r.error || "não excluiu");
      await loadContratos();
    } catch (e) { alert("❌ " + e.message); b.disabled = false; }
  }));
}

// Mensagem de renovação pronta para colar no WhatsApp/e-mail do cliente
async function copiarMensagemRenovacao(cliente, btn) {
  if (!EMITENTE) await loadContratos();
  const servico = SERVICO_POR_TIPO[cliente.tipo] || "nossa plataforma";
  const dias = diasAte(cliente.fim);
  const quando = dias < 0 ? `venceu em ${dataBR(cliente.fim)}`
    : dias === 0 ? `vence hoje (${dataBR(cliente.fim)})`
    : `vence em ${dias} dia${dias > 1 ? "s" : ""} (${dataBR(cliente.fim)})`;
  const ult = CONTRATOS_CACHE.find(x => x.cliente_tipo === cliente.tipo && String(x.cliente_id) === String(cliente.id) && x.valor != null);
  const linhas = [
    `Olá, ${cliente.nome}! Tudo bem?`,
    ``,
    `Seu acesso à ${servico} ${quando}.`,
    dias < 0 ? `Para voltar a usar, é só renovar.` : `Para continuar sem interrupção, é só renovar.`
  ];
  if (ult) {
    const meses = ult.inicio && ult.fim ? Math.round(diasEntreDatas(ult.inicio, ult.fim) / 30) : 0;
    linhas.push(`Valor da renovação${meses >= 1 ? ` (${meses === 12 ? "anual" : meses + (meses > 1 ? " meses" : " mês")})` : ""}: ${brl(ult.valor)}.`);
  }
  if (EMITENTE && EMITENTE.pix) linhas.push(``, `Pagamento via Pix: ${EMITENTE.pix}`);
  linhas.push(``, `Assim que o pagamento for confirmado, eu renovo o acesso e envio o recibo.`, `Qualquer dúvida, estou à disposição.`, ``, (EMITENTE && EMITENTE.assinatura) || "RH IMOB");
  const texto = linhas.join("\n");
  try {
    await navigator.clipboard.writeText(texto);
    const antes = btn.textContent;
    btn.textContent = "✅ Copiada";
    setTimeout(() => { btn.textContent = antes; }, 2000);
  } catch (_) {
    prompt("Copie a mensagem:", texto);
  }
}
function diasEntreDatas(a, b) {
  return Math.round((Date.parse(String(b).slice(0, 10) + "T00:00:00Z") - Date.parse(String(a).slice(0, 10) + "T00:00:00Z")) / 86400000);
}

// ===== Ranking de mensagens (SQL RANKING_1) =====
function preencherOperadoresRanking() {
  const sel = $("rkLogin");
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + USUARIOS_COLETOR_CACHE
    .map(u => `<option value="${esc(u.login)}">${esc(u.nome_operador || u.login)}</option>`).join("");
  sel.value = atual;
}
async function loadRanking() {
  const tbody = $("listaRanking");
  tbody.innerHTML = '<tr><td colspan="5"><small>Calculando...</small></td></tr>';
  try {
    const r = await rpc("rpc_admin_ranking_mensagens", { p_admin_password: ADMIN_PASS, p_login: $("rkLogin").value || null,
      p_dias: Number($("rkDias").value), p_min: Number($("rkMin").value) });
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
    const lista = r.modelos || [];
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5"><small>Nenhuma mensagem com pelo menos ${r.minimo} envios no período. Diminua o mínimo ou aumente o período.</small></td></tr>`;
      return;
    }
    const maxAg = Math.max(0.1, ...lista.map(m => m.taxa_agendamento));
    const maxResp = Math.max(0.1, ...lista.map(m => m.taxa_resposta));
    const barra = (v, max, cor) => `<div style="height:6px;border-radius:3px;background:#f1ecf4;margin-top:4px;width:120px"><div style="height:6px;border-radius:3px;background:${cor};width:${Math.round(v / max * 100)}%"></div></div>`;
    tbody.innerHTML = lista.map((m, i) => `
      <tr>
        <td style="font-weight:800;color:${i === 0 ? "#b45309" : "#6b5a72"}">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
        <td style="max-width:520px"><div style="white-space:pre-wrap;font-size:12px;line-height:1.45;max-height:4.4em;overflow:hidden" class="rkTexto">${esc(m.modelo)}</div>
          <button class="ghost rkVer" style="padding:2px 6px;font-size:10px;margin-top:3px">ver inteira</button>
          <button class="ghost rkCopiar" style="padding:2px 6px;font-size:10px;margin-top:3px">📋 copiar</button>
          ${m.operadores > 1 ? `<small style="margin-left:4px">${m.operadores} operadores</small>` : ""}</td>
        <td><b>${m.enviados}</b></td>
        <td><b>${m.taxa_resposta}%</b> <small>(${m.responderam})</small>${barra(m.taxa_resposta, maxResp, "#6C0070")}</td>
        <td><b>${m.taxa_agendamento}%</b> <small>(${m.agendaram})</small>${barra(m.taxa_agendamento, maxAg, "#F89A45")}</td>
      </tr>`).join("");
    tbody.querySelectorAll(".rkVer").forEach(b => b.addEventListener("click", () => {
      const t = b.parentElement.querySelector(".rkTexto");
      const aberto = t.style.maxHeight === "none";
      t.style.maxHeight = aberto ? "4.4em" : "none";
      b.textContent = aberto ? "ver inteira" : "recolher";
    }));
    tbody.querySelectorAll(".rkCopiar").forEach((b, i) => b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(lista[i].modelo); b.textContent = "✅ copiada"; setTimeout(() => { b.textContent = "📋 copiar"; }, 1500); }
      catch (_) { prompt("Copie a mensagem:", lista[i].modelo); }
    }));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5"><small>${/rpc_admin_ranking_mensagens|function|404/i.test(e.message) ? "Falta rodar o SQL RANKING_1 no Supabase do Coletor." : esc(e.message)}</small></td></tr>`;
  }
}
$("btnRanking")?.addEventListener("click", loadRanking);

// ===== Base qualificada (zona e tipo marcados na bolha — SQL QUALI_1) =====
const BQ_ZONA = { NORTE: "Norte", SUL: "Sul", LESTE: "Leste", OESTE: "Oeste", CENTRO: "Centro" };
const BQ_TIPO = { CORRETOR: "Corretor", IMOBILIARIA: "Imobiliária", ADVOGADO: "Advogado", OUTRO: "Outro" };
let BQ_LINHAS = [];
const BQ_POR_PAGINA = 100;
let BQ_FILTROS = null, BQ_TOTAL = 0, BQ_PAGINA = 0;
const bqData = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
function bqFiltrosTela() {
  return { cidade: $("bqCidade").value, zona: $("bqZona").value, tipo: $("bqTipo").value,
    nao_abordado_dias: $("bqDias").value, busca: $("bqBusca").value.trim() };
}
function bqRenderPaginas() {
  const box = $("bqPaginas");
  const paginas = Math.ceil(BQ_TOTAL / BQ_POR_PAGINA);
  if (paginas <= 1) { box.innerHTML = ""; return; }
  box.innerHTML = `<button class="ghost" id="bqAnt" ${BQ_PAGINA === 0 ? "disabled" : ""}>◀ Anterior</button>
    <small>Página <b>${BQ_PAGINA + 1}</b> de ${paginas}</small>
    <button class="ghost" id="bqProx" ${BQ_PAGINA >= paginas - 1 ? "disabled" : ""}>Próxima ▶</button>`;
  $("bqAnt").addEventListener("click", () => loadBaseQualificada(BQ_PAGINA - 1));
  $("bqProx").addEventListener("click", () => loadBaseQualificada(BQ_PAGINA + 1));
}
function bqPreencherDestinos() {
  // mesma lista de operadores do painel (já respeita a empresa do admin)
  const dest = $("bqDestino");
  if (!dest) return;
  const atual = dest.value;
  dest.innerHTML = '<option value="">Escolha o operador</option>' + (USUARIOS_COLETOR_CACHE || [])
    .filter(u => u.ativo !== false)
    .map(u => `<option value="${esc(u.login)}">${esc(u.nome_operador || u.login)}</option>`).join("");
  dest.value = atual;
}
// pagina: número da página; sem número = nova busca com os filtros da tela
async function loadBaseQualificada(pagina) {
  const novaBusca = typeof pagina !== "number";
  if (novaBusca) { BQ_FILTROS = bqFiltrosTela(); BQ_PAGINA = 0; } else { BQ_PAGINA = pagina; }
  const tbody = $("listaBaseQuali");
  tbody.innerHTML = '<tr><td colspan="7"><small>Buscando...</small></td></tr>';
  $("btnBaseQualiCsv").disabled = true;
  try {
    const r = await rpc("rpc_admin_base_qualificada", { p_admin_password: ADMIN_PASS, p_filtros: {
      ...BQ_FILTROS, limite: BQ_POR_PAGINA, offset: BQ_PAGINA * BQ_POR_PAGINA } });
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
    // cidades disponíveis (mantém a escolhida)
    const sel = $("bqCidade"), atual = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' + (r.cidades || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    sel.value = atual;
    BQ_LINHAS = r.linhas || [];
    BQ_TOTAL = r.total || 0;
    const pz = r.por_zona || {}, pt = r.por_tipo || {};
    const pilula = (t) => `<span style="display:inline-block;background:#f1ecf4;color:#6C0070;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700;margin:0 4px 4px 0">${t}</span>`;
    $("bqResumo").innerHTML = pilula(`${r.total} profissionais`) +
      Object.keys(BQ_ZONA).filter(z => pz[z]).map(z => pilula(`${BQ_ZONA[z]}: ${pz[z]}`)).join("") +
      Object.keys(pt).map(t => pilula(`${BQ_TIPO[t] || "Sem tipo"}: ${pt[t]}`)).join("");
    bqRenderPaginas();
    bqPreencherDestinos();
    $("bqFila").style.display = BQ_TOTAL ? "flex" : "none";
    if (!BQ_LINHAS.length) {
      tbody.innerHTML = '<tr><td colspan="7"><small>Ninguém com esses filtros ainda. As marcações aparecem aqui conforme os operadores clicam na zona/tipo na bolha (extensão 3.15.0 ou mais nova).</small></td></tr>';
    } else {
      tbody.innerHTML = BQ_LINHAS.map(l => `
        <tr>
          <td>${esc(l.nome || "—")}${l.empresas_marcaram > 1 ? ` <small title="Empresas que marcaram esta pessoa">(${l.empresas_marcaram} empresas)</small>` : ""}</td>
          <td>${esc(l.telefone || "")}</td>
          <td>${esc(l.cidade || "—")}</td>
          <td>${(l.zonas || []).map(z => BQ_ZONA[z] || z).join(", ") || "—"}</td>
          <td>${esc(BQ_TIPO[l.tipo] || "—")}</td>
          <td>${bqData(l.ultima_abordagem)}</td>
          <td>${esc(l.marcado_por || "")}${l.empresa ? `<br><small>${esc(l.empresa)}</small>` : ""}<br><small>${bqData(l.atualizado_em)}</small></td>
        </tr>`).join("");
      $("btnBaseQualiCsv").disabled = false;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7"><small>${/rpc_admin_base_qualificada|function|404/i.test(e.message) ? "Falta rodar o SQL QUALI_1 / QUALI_2 no Supabase do Coletor." : esc(e.message)}</small></td></tr>`;
  }
  if (novaBusca) loadQualiOperadores();
}
async function loadQualiOperadores() {
  const tbody = $("listaQualiOperadores");
  try {
    const r = await rpc("rpc_admin_qualificacao_operadores", { p_admin_password: ADMIN_PASS, p_dias: 30 });
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
    const ops = (r.operadores || []).filter(o => o.abordados > 0);
    // com_tipo vem do SQL QUALI_3; sem ele, a coluna fica com "—".
    const cor = p => p >= 50 ? "#1a7a3d" : p >= 20 ? "#b45309" : "#b91c1c";
    tbody.innerHTML = ops.length ? ops.map(o => `
      <tr><td>${esc(o.nome || o.login)}</td><td>${o.abordados}</td>
        <td>${o.com_tipo != null ? o.com_tipo : "—"}</td><td>${o.qualificados}</td>
        <td><b style="color:${cor(o.pct)}">${o.pct}%</b></td></tr>`).join("")
      : '<tr><td colspan="5"><small>Nenhuma abordagem nos últimos 30 dias.</small></td></tr>';
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4"><small>${esc(e.message)}</small></td></tr>`;
  }
}
// Exporta TUDO o que bate com o filtro (não só a página), buscando em lotes de 1000.
async function exportarBaseQualificada() {
  const btn = $("btnBaseQualiCsv");
  const rotulo = btn.textContent;
  btn.disabled = true;
  const todas = [];
  try {
    for (let off = 0; off < BQ_TOTAL; off += 1000) {
      btn.textContent = `Exportando ${Math.min(off + 1000, BQ_TOTAL)} de ${BQ_TOTAL}...`;
      const r = await rpc("rpc_admin_base_qualificada", { p_admin_password: ADMIN_PASS, p_filtros: { ...BQ_FILTROS, limite: 1000, offset: off } });
      if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
      todas.push(...(r.linhas || []));
      if (!(r.linhas || []).length) break;
    }
  } catch (e) {
    alert("Não consegui exportar tudo: " + e.message);
    btn.textContent = rotulo; btn.disabled = false;
    return;
  }
  btn.textContent = rotulo; btn.disabled = false;
  const q = (v) => { const s = String(v == null ? "" : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const linhas = [["Nome", "Telefone", "Cidade", "Zonas", "Tipo", "Última abordagem", "Marcado por", "Marcado em"]]
    .concat(todas.map(l => [l.nome, l.telefone, l.cidade, (l.zonas || []).map(z => BQ_ZONA[z] || z).join(" / "),
      BQ_TIPO[l.tipo] || "", bqData(l.ultima_abordagem).replace("—", ""), l.marcado_por, bqData(l.atualizado_em)]));
  const csv = "﻿" + linhas.map(l => l.map(q).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `base-qualificada-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function enviarBaseQualiParaFila() {
  const login = $("bqDestino").value;
  const qtd = Math.min(Math.max(parseInt($("bqQtd").value, 10) || 0, 1), 500);
  if (!login) { alert("Escolha o operador."); return; }
  if (!confirm(`Colocar até ${qtd} contato(s) deste recorte na fila de ${login}?`)) return;
  const btn = $("btnBaseQualiFila");
  btn.disabled = true;
  try {
    const r = await rpc("rpc_admin_quali_para_fila", { p_admin_password: ADMIN_PASS, p_login: login, p_filtros: BQ_FILTROS || bqFiltrosTela(), p_quantidade: qtd });
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
    alert(`✅ ${r.na_fila} contato(s) entraram na fila de ${login}.` +
      (r.bloqueados_outra_empresa ? `\n${r.bloqueados_outra_empresa} ficaram de fora: outra empresa falou com eles nos últimos 30 dias.` : "") +
      (r.na_fila === 0 && !r.bloqueados_outra_empresa ? "\nNinguém disponível: todos já foram abordados pela empresa nos últimos 30 dias ou já estão na fila." : ""));
  } catch (e) {
    alert(/rpc_admin_quali_para_fila|function|404/i.test(e.message) ? "Falta rodar o SQL QUALI_2 no Supabase do Coletor." : "⚠️ " + e.message);
  }
  btn.disabled = false;
}
$("btnBaseQuali")?.addEventListener("click", () => loadBaseQualificada());
$("btnBaseQualiFila")?.addEventListener("click", enviarBaseQualiParaFila);
$("btnBaseQualiCsv")?.addEventListener("click", exportarBaseQualificada);
$("bqBusca")?.addEventListener("keydown", (e) => { if (e.key === "Enter") loadBaseQualificada(); });
// ===== Começar operação nova (SQL OPNOVA_1) =====
// Antes de um lote novo: os contatos que ficaram em "Novo" (nunca receberam
// mensagem) vão para "Encerrado", a fila da máquina do operador é zerada e,
// se escolhido, começa uma nova contagem do funil. Quem já recebeu mensagem
// ou está em conversa não é tocado.
async function comecarOperacaoNova(login, nome, opts) {
  opts = opts || {};
  if (!opts.semPerguntar && !confirm(`Começar uma operação nova para ${nome}?\n\n• Os contatos dele que ficaram em "Novo" (nunca receberam mensagem) vão para "Encerrado". Nada é apagado.\n• A fila da extensão dele é zerada (em até 3 min).\n• Quem já recebeu mensagem ou está em conversa continua como está e não recebe de novo.\n\nDepois disso, coloque o lote novo na fila.`)) return false;
  const novaContagem = opts.novaContagem != null ? opts.novaContagem
    : confirm(`Começar também uma NOVA CONTAGEM do funil de ${nome}? (recomendado)\n\nOK = sim: os números recomeçam do zero e a contagem atual fica guardada no histórico.\nCancelar = não: mantém a contagem atual.`);
  try {
    const r = await rpc("rpc_admin_encerrar_novos", { p_admin_password: ADMIN_PASS, p_login: login });
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
    await rpc("rpc_admin_definir_comando", { p_admin_password: ADMIN_PASS, p_login: login, p_comando: { tipo: "ZERAR_FILA" } });
    let contagem = false, avisoContagem = "";
    if (novaContagem) {
      const c = await rpc("rpc_admin_reiniciar_funil", { p_admin_password: ADMIN_PASS, p_login: login, p_nota: "Operação nova" }).catch(e => ({ ok: false, error: e.message }));
      contagem = !!(c && c.ok);
      if (!contagem) avisoContagem = "\n• ⚠️ A nova contagem do funil não foi feita: " + ((c && c.error) || "sem resposta");
    }
    if (!opts.semAviso) alert(`✅ Operação nova para ${nome}.\n\n• ${r.encerrados} contato(s) que estavam em "Novo" foram para "Encerrado".\n• A fila da extensão dele é zerada em até 3 minutos.` +
      (contagem ? "\n• Nova contagem do funil iniciada." : "") + avisoContagem + "\n\nAgora é só colocar o lote novo na fila.");
    return { ok: true, encerrados: r.encerrados, contagem };
  } catch (e) {
    alert(/rpc_admin_encerrar_novos|function|404/i.test(e.message) ? "Falta rodar o SQL OPNOVA_1 no Supabase do Coletor." : "❌ " + e.message);
    return false;
  }
}

// ===== Corretores CRECI → fila do operador (/api/admin-creci + SQL CRECI_ADM_1) =====
// O servidor usa o acesso do próprio operador ao banco CRECI: a busca esconde
// quem a empresa dele já liberou e o consumo cai no limite da empresa dele.
async function adminCreci(body) {
  const r = await fetch("/api/admin-creci", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha: ADMIN_PASS, ...body })
  });
  const d = await r.json().catch(() => null);
  if (!d) throw new Error("Resposta inválida do servidor (HTTP " + r.status + ")");
  if (!d.ok) throw new Error(d.error || "Falhou");
  return d;
}
function crPreencherOperadores() {
  const sel = $("crOperador");
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">Escolha o operador</option>' + (USUARIOS_COLETOR_CACHE || [])
    .filter(u => u.ativo !== false)
    .map(u => `<option value="${esc(u.login)}">${esc(u.nome_operador || u.login)}</option>`).join("");
  sel.value = atual;
}
function crFiltros() {
  return { cidade: $("crCidade").value || null, ano: $("crAno").value || null, cargo: $("crCargo").value || null };
}
function crOpcoesHtml(lista, campo, rotuloTodos) {
  const total = (lista || []).reduce((s, x) => s + (Number(x.total) || 0), 0);
  return `<option value="">${rotuloTodos}${total ? " (" + total + ")" : ""}</option>` + (lista || [])
    .map(x => `<option value="${esc(x[campo])}">${esc(x[campo])}${x.total != null ? " (" + x.total + ")" : ""}</option>`).join("");
}
async function crCarregar() {
  const login = $("crOperador").value;
  if (!login) { alert("Escolha o operador."); return; }
  const btn = $("btnCrCarregar");
  btn.disabled = true; btn.textContent = "Carregando…";
  $("crResumo").innerHTML = ""; $("crAndamento").innerHTML = "";
  try {
    const d = await adminCreci({ acao: "contexto", login });
    $("crCidade").innerHTML = crOpcoesHtml(d.cidades, "cidade", "Todas");
    $("crFiltros").style.display = "";
    await crAtualizarOpcoes();
  } catch (e) {
    $("crFiltros").style.display = "none";
    alert("⚠️ " + e.message);
  }
  btn.disabled = false; btn.textContent = "Carregar filtros";
}
async function crAtualizarOpcoes() {
  const login = $("crOperador").value;
  if (!login) return;
  const f = crFiltros();
  try {
    const d = await adminCreci({ acao: "opcoes", login, cidade: f.cidade, ano: f.ano, cargo: f.cargo });
    const ano = $("crAno").value, cargo = $("crCargo").value;
    $("crAno").innerHTML = crOpcoesHtml(d.anos, "ano", "Todos");
    $("crCargo").innerHTML = crOpcoesHtml(d.cargos, "cargo", "Todos");
    $("crAno").value = ano; $("crCargo").value = cargo;
  } catch (_) { /* sem contagem: os filtros continuam valendo */ }
  if (!$("crCampanha").dataset.editado) {
    $("crCampanha").value = "Corretores CRECI" + (f.cidade ? " — " + f.cidade : "") + (f.ano ? " — " + f.ano : "");
  }
}
async function crContar() {
  const login = $("crOperador").value;
  if (!login) return;
  $("crResumo").textContent = "Contando…";
  try {
    const d = await adminCreci({ acao: "contar", login, filtros: crFiltros() });
    $("crResumo").innerHTML = `<b>${d.total}</b> corretor(es) disponíveis neste filtro para a empresa deste operador.`;
  } catch (e) { $("crResumo").textContent = "⚠️ " + e.message; }
}
async function crEnviar() {
  const login = $("crOperador").value;
  const nome = $("crOperador").selectedOptions[0]?.textContent || login;
  const qtd = Math.min(Math.max(parseInt($("crQtd").value, 10) || 0, 1), 500);
  if (!login) { alert("Escolha o operador."); return; }
  const campanha = $("crCampanha").value.trim() || "Corretores CRECI";
  const opNova = $("crOpNova").checked;
  if (!confirm(`Liberar até ${qtd} corretor(es) e colocar na fila de ${nome}?\n\nCampanha: "${campanha}"\n\nCada corretor é descontado do limite da empresa dele.` +
    (opNova ? `\n\nAntes, começa uma operação nova: os contatos dele que ficaram em "Novo" vão para "Encerrado", a fila dele é zerada e o funil recomeça a contagem.` : ""))) return;
  const btn = $("btnCrEnviar");
  btn.disabled = true;
  let opNovaTxt = "";
  if (opNova) {
    $("crAndamento").textContent = "Começando a operação nova…";
    const o = await comecarOperacaoNova(login, nome, { semPerguntar: true, novaContagem: true, semAviso: true });
    if (!o) { btn.disabled = false; $("crAndamento").textContent = ""; return; }
    opNovaTxt = `🔄 Operação nova: ${o.encerrados} contato(s) antigos em "Novo" foram para "Encerrado"${o.contagem ? " e o funil recomeçou a contagem" : ""}.<br>`;
    $("crOpNova").checked = false;
  }
  const tot = { liberados: 0, na_fila: 0, ja_estavam: 0, falhas: 0 };
  let aviso = null, erro = null;
  try {
    while (tot.liberados < qtd) {
      $("crAndamento").textContent = `Liberando… ${tot.liberados} de ${qtd}`;
      const d = await adminCreci({ acao: "enviar", login, filtros: crFiltros(), campanha, lote: Math.min(25, qtd - tot.liberados) });
      ["liberados", "na_fila", "ja_estavam", "falhas"].forEach(k => { tot[k] += Number(d[k]) || 0; });
      if (d.aviso) aviso = d.aviso;
      // Acabou o filtro, o limite, ou nada saiu neste lote: para (não fica tentando os mesmos).
      if (d.acabou || !d.liberados) break;
    }
  } catch (e) { erro = e.message; }
  btn.disabled = false;
  $("crAndamento").innerHTML = opNovaTxt +
    `✅ <b>${tot.na_fila}</b> corretor(es) entraram na fila de ${esc(nome)}` +
    (tot.ja_estavam ? ` · ${tot.ja_estavam} já estavam na fila` : "") +
    (tot.falhas ? ` · ${tot.falhas} falharam` : "") +
    (tot.liberados < qtd && !erro ? ` · o filtro tinha menos corretores disponíveis que o pedido` : "") +
    (aviso ? `<br>⚠️ ${esc(aviso)}` : "") +
    (erro ? `<br>⚠️ Parou por erro: ${esc(erro)}` : "") +
    (tot.na_fila ? `<br><small>A extensão de ${esc(nome)} começa o disparo em até 3 minutos (precisa estar aberta e logada).</small>` : "");
  crContar();
}
$("crOperador")?.addEventListener("focus", crPreencherOperadores);
$("crOperador")?.addEventListener("change", () => { $("crFiltros").style.display = "none"; $("crCampanha").dataset.editado = ""; });
$("btnCrCarregar")?.addEventListener("click", crCarregar);
["crCidade", "crAno", "crCargo"].forEach(id => $(id)?.addEventListener("change", () => { $("crResumo").innerHTML = ""; crAtualizarOpcoes(); }));
$("crCampanha")?.addEventListener("input", () => { $("crCampanha").dataset.editado = "1"; });
$("btnCrContar")?.addEventListener("click", crContar);
$("btnCrEnviar")?.addEventListener("click", crEnviar);
// ===== Máquinas (sinal de vida das extensões — SQL SAUDE_1) =====
let MAQUINAS_INTERVAL = null;
const COMANDO_DISPARO_PENDENTE = {}; // login -> comando enviado e ainda não confirmado pelo sinal de vida
const ONLINE_ATE_MIN = 10; // a extensão manda sinal a cada 3 min

function compararVersao(a, b) {
  const pa = String(a || "0").split(".").map(Number), pb = String(b || "0").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
function tempoDesde(min) {
  if (min == null) return "";
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} dias`;
}

async function loadMaquinas() {
  const tbody = $("listaMaquinas");
  if (!tbody) return;
  let r;
  try {
    r = await rpc("rpc_admin_saude", { p_admin_password: ADMIN_PASS });
    if (!r || !r.ok) throw new Error((r && r.error) || "sem resposta");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6"><small>${/rpc_admin_saude|function|404/i.test(e.message) ? "Falta rodar o SQL SAUDE_1 no Supabase do Coletor." : esc(e.message)}</small></td></tr>`;
    return;
  }
  const lista = r.maquinas || [];
  const versaoMaisNova = lista.reduce((m, x) => x.versao && compararVersao(x.versao, m) > 0 ? x.versao : m, "0");
  let online = 0, atencao = 0;
  tbody.innerHTML = lista.map(m => {
    const nunca = m.minutos_sem_sinal == null;
    const on = !nunca && m.minutos_sem_sinal <= ONLINE_ATE_MIN;
    if (on) online++;
    const situacao = nunca ? '<span class="selo sem">⚪ Nunca conectou</span><br><small>extensão antiga ou não logada</small>'
      : on ? `<span class="selo ok">🟢 Online</span><br><small>${tempoDesde(m.minutos_sem_sinal)}${m.coletando ? " · coletando" : ""}</small>`
      : `<span class="selo vencido">🔴 Offline</span><br><small>último sinal ${tempoDesde(m.minutos_sem_sinal)}</small>`;
    const velha = m.versao && compararVersao(m.versao, versaoMaisNova) < 0;
    const versao = !m.versao ? "—" : velha ? `<span class="selo logo">⚠️ ${esc(m.versao)}</span><br><small>atualizar para ${esc(versaoMaisNova)}</small>` : esc(m.versao);
    const whats = m.whatsapp_aberto == null ? "—" : m.whatsapp_aberto ? "✅ aberto" : "❌ fechado";
    const disparo = !m.disparo ? "—"
      : m.disparo === "rodando" ? `▶️ rodando<br><small>fila: ${m.fila || 0}</small>`
      : m.disparo === "pausado" ? `⏸ pausado<br><small>${esc(m.pausa_motivo || "")}${m.fila ? " · fila: " + m.fila : ""}</small>`
      : `⏹ parado${m.fila ? `<br><small>fila: ${m.fila}</small>` : ""}`;
    // controle remoto (chega na máquina em até 3 min, como o "Rodar agora")
    if ((COMANDO_DISPARO_PENDENTE[m.login] === "PAUSAR_DISPARO" && m.disparo === "pausado")
      || (COMANDO_DISPARO_PENDENTE[m.login] === "RETOMAR_DISPARO" && m.disparo === "rodando")) delete COMANDO_DISPARO_PENDENTE[m.login];
    const pendente = COMANDO_DISPARO_PENDENTE[m.login];
    const controle = !m.versao || compararVersao(m.versao, "3.14.1") < 0 ? ""
      : pendente ? `<br><small style="color:#92400e">⏳ ${pendente === "PAUSAR_DISPARO" ? "pausando" : "retomando"}… (até 3 min)</small>`
      : m.disparo === "rodando"
        ? `<br><button class="danger disparoRemotoBtn" data-login="${esc(m.login)}" data-tipo="PAUSAR_DISPARO" style="padding:3px 8px;font-size:11px;margin-top:4px">⏸ Pausar</button>`
        : `<br><button class="secondary disparoRemotoBtn" data-login="${esc(m.login)}" data-tipo="RETOMAR_DISPARO" style="padding:3px 8px;font-size:11px;margin-top:4px">▶️ ${m.disparo === "pausado" ? "Retomar" : "Iniciar"}</button>`;
    let coleta = "—";
    if (m.ultima_coleta_em) {
      const quando = new Date(m.ultima_coleta_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const problema = m.ultima_coleta_erro || m.ultima_coleta_falhas;
      coleta = `${problema ? "⚠️" : "✅"} ${quando}<br><small>${m.ultima_coleta_encontrados || 0} achados · ${m.ultima_coleta_entregues || 0} na fila${m.ultima_coleta_erro ? "<br>" + esc(m.ultima_coleta_erro) : ""}</small>`;
    }
    if (velha || (m.ultima_coleta_erro) || (on && m.whatsapp_aberto === false && m.disparo === "rodando")) atencao++;
    return `<tr>
      <td><b>${esc(m.nome || m.login)}</b><br><small>${esc(m.login)}${m.horario_coleta ? " · ⏰ " + esc(m.horario_coleta) : ""}</small></td>
      <td>${situacao}</td><td>${versao}</td><td>${whats}</td><td>${disparo}${controle}</td><td>${coleta}</td>
    </tr>`;
  }).join("") || '<tr><td colspan="6"><small>Nenhum operador ativo.</small></td></tr>';
  tbody.querySelectorAll(".disparoRemotoBtn").forEach(b => b.addEventListener("click", async () => {
    const pausar = b.dataset.tipo === "PAUSAR_DISPARO";
    const m = lista.find(x => x.login === b.dataset.login) || {};
    if (!confirm(`${pausar ? "Pausar" : "Retomar"} o disparo de ${m.nome || b.dataset.login}?\n\nA extensão recebe o comando em até 3 minutos (precisa estar online).`)) return;
    b.disabled = true;
    try {
      const r = await rpc("rpc_admin_definir_comando", { p_admin_password: ADMIN_PASS, p_login: b.dataset.login, p_comando: { tipo: b.dataset.tipo } });
      if (r && r.ok === false) throw new Error(r.error || "não enviado");
      COMANDO_DISPARO_PENDENTE[b.dataset.login] = b.dataset.tipo;
      setTimeout(() => { delete COMANDO_DISPARO_PENDENTE[b.dataset.login]; loadMaquinas(); }, 4 * 60 * 1000);
      loadMaquinas();
    } catch (e) { alert("❌ " + e.message); b.disabled = false; }
  }));
  const resumo = $("maquinasResumo");
  if (resumo) resumo.innerHTML = `<span class="selo ok">🟢 ${online} online</span> <span class="selo sem">${lista.length - online} sem sinal agora</span>`
    + (atencao ? ` <span class="selo logo">⚠️ ${atencao} pedem atenção</span>` : "");
}

// Resposta visual a todo clique em botão (pulso rápido) — o "carregando" é o
// disabled que cada ação já liga enquanto espera o servidor (ver CSS).
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("button");
  if (!b || b.disabled) return;
  b.classList.remove("clicado");
  void b.offsetWidth; // reinicia a animação
  b.classList.add("clicado");
}, true);
