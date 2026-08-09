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
  loadAdmins();
  loadContasPlataforma();
}

// ===== Contas da Plataforma (Novos Talentos) =====
// Lidas via /api/contas (server-side, service_role). O token fica só na sessão
// do navegador — nunca embutido no código.
let CONTAS_TOKEN = sessionStorage.getItem("contas_tok") || "";
let CONTAS_CACHE = [];

function pedirTokenContas() {
  const t = prompt("Token de administração da plataforma (Novos Talentos).\nNecessário para listar contas, criar acessos e ajustar limites.");
  if (!t) return false;
  CONTAS_TOKEN = t.trim();
  sessionStorage.setItem("contas_tok", CONTAS_TOKEN);
  return true;
}

async function apiContas(payload) {
  if (!CONTAS_TOKEN && !pedirTokenContas()) throw new Error("Token não informado");
  const url = "/api/contas?token=" + encodeURIComponent(CONTAS_TOKEN);
  const opts = payload
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    : undefined;
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) {
    sessionStorage.removeItem("contas_tok");
    CONTAS_TOKEN = "";
    throw new Error("Token inválido — recarregue e informe novamente");
  }
  if (!r.ok) throw new Error(data?.message || "Falha na API de contas");
  return data;
}

async function loadContasPlataforma() {
  const sel = $("fContaPlataforma");
  const msg = $("contasMsg");
  if (!sel) return;

  if (!CONTAS_TOKEN && !pedirTokenContas()) {
    msg.textContent = "Sem token: vínculo e limites ficam indisponíveis nesta sessão.";
    return;
  }

  try {
    const data = await apiContas(null);
    CONTAS_CACHE = data.contas || [];
    sel.innerHTML = '<option value="">— sem vínculo —</option>' +
      CONTAS_CACHE.map(c => `<option value="${esc(c.conta_id)}">${esc(c.nome_conta || c.conta_id)}</option>`).join("");
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
    const consumido = c.consumido ?? c.consumo ?? 0;
    const limite = c.limite_total ?? 0;
    const perto = limite && consumido / limite >= 0.8;
    return `
    <tr>
      <td>${esc(c.nome_conta || c.conta_id)}<br><small style="color:#999">${esc(c.conta_id)}</small></td>
      <td><span class="badge ${c.status === 'ATIVA' ? '' : 'bloqueado'}">${esc(c.status || '-')}</span></td>
      <td${perto ? ' style="color:#c2410c;font-weight:700"' : ''}>${consumido}${limite ? ' / ' + limite : ''}</td>
      <td><input class="limTotal" data-conta="${esc(c.conta_id)}" type="number" min="0" value="${limite}" style="width:90px;margin:0"></td>
      <td><input class="limUser" data-conta="${esc(c.conta_id)}" type="number" min="0" value="${c.limite_por_usuario ?? 0}" style="width:90px;margin:0"></td>
      <td><button class="salvarLimBtn" data-conta="${esc(c.conta_id)}" style="padding:4px 8px;font-size:11px">Salvar</button></td>
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
}

$("btnRefreshContas")?.addEventListener("click", loadContasPlataforma);

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

  const senha = prompt("Senha inicial (mínimo 6 caracteres):", Math.random().toString(36).slice(2, 10) + "A1");
  if (!senha || senha.length < 6) { alert("Senha precisa ter ao menos 6 caracteres."); return; }

  try {
    await apiContas({
      acao: "criar_usuario", conta_id: conta.conta_id,
      nome: nome || login, email_login: email, senha, perfil: "OPERADOR"
    });
  } catch (e) {
    if (!/já existe/i.test(e.message)) { alert("❌ " + e.message); return; }
    if (!confirm("Já existe login com esse e-mail na plataforma. Vincular mesmo assim?")) return;
  }

  try {
    const resp = await rpc("rpc_admin_upsert_usuario", {
      p_admin_password: ADMIN_PASS, p_login: login, p_senha: "", p_nome: nome || login,
      p_ativo: true, p_horario_coleta: "",
      p_email_plataforma: email, p_conta_id_plataforma: conta.conta_id
    });
    if (!resp.ok) { alert("❌ " + resp.error); return; }
    alert(`✅ Acesso criado.\n\nE-mail: ${email}\nSenha: ${senha}\nEmpresa: ${conta.nome_conta || conta.conta_id}\n\nAnote a senha — ela não fica visível depois.`);
    loadUsuarios();
  } catch (e) {
    alert("❌ " + e.message);
  }
}

$("btnEntrar").addEventListener("click", async () => {
  const pass = $("adminPass").value;
  if (!pass) { $("loginMsg").textContent = "Digite a senha."; return; }
  $("loginMsg").textContent = "Verificando...";
  try {
    const resp = await rpc("rpc_admin_list_usuarios", { p_admin_password: pass });
    if (!resp.ok) { $("loginMsg").textContent = "❌ " + resp.error; return; }
    ADMIN_PASS = pass;
    sessionStorage.setItem("catho_admin_pass", pass);
    renderUsuarios(resp.usuarios || []);
    showApp();
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
    tbody.innerHTML = '<tr><td colspan="4"><small>Nenhum operador cadastrado ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td>${esc(u.login)}</td>
      <td>${esc(u.nome_operador)}</td>
      <td><span class="badge ${u.ativo ? '' : 'bloqueado'}">${u.ativo ? 'Ativo' : 'Bloqueado'}</span></td>
      <td>${u.horario_coleta ? `⏰ ${esc(u.horario_coleta)}` : '<small style="color:#999">—</small>'}</td>
      <td>${u.email_plataforma
            ? `<small>🔗 ${esc(u.email_plataforma)}<br><span style="color:#888">${esc(u.conta_id_plataforma || 'sem conta')}</span></small>`
            : `<button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador||'')}" class="secondary criarAcessoBtn" style="padding:4px 8px;font-size:11px">+ Criar acesso</button>`}</td>
      <td>
        <button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador)}" data-ativo="${u.ativo}" data-horario="${esc(u.horario_coleta||'')}" data-email="${esc(u.email_plataforma||'')}" data-conta="${esc(u.conta_id_plataforma||'')}" class="ghost editBtn" style="padding:4px 8px;font-size:11px">Editar</button>
        <button data-login="${esc(u.login)}" data-ativo="${u.ativo}" class="${u.ativo ? 'danger' : 'secondary'} toggleBtn" style="padding:4px 8px;font-size:11px">${u.ativo ? 'Bloquear' : 'Reativar'}</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      $("fLogin").value = btn.dataset.login;
      $("fLogin").disabled = true;
      $("fSenha").value = "";
      $("fNome").value = btn.dataset.nome;
      $("fAtivo").value = btn.dataset.ativo;
      $("fHorario").value = btn.dataset.horario || "";
      $("fEmailPlataforma").value = btn.dataset.email || "";
      $("fContaPlataforma").value = btn.dataset.conta || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  tbody.querySelectorAll(".criarAcessoBtn").forEach(btn => {
    btn.addEventListener("click", () => criarAcessoPlataforma(btn.dataset.login, btn.dataset.nome));
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
  $("formMsg").textContent = "";
});

$("btnSalvarUsuario").addEventListener("click", async () => {
  const login = $("fLogin").value.trim();
  const senha = $("fSenha").value;
  const nome = $("fNome").value.trim();
  const ativo = $("fAtivo").value === "true";
  const horario = $("fHorario").value || "";
  const emailPlataforma = $("fEmailPlataforma").value.trim();
  const contaPlataforma = $("fContaPlataforma").value;
  if (!login) { $("formMsg").textContent = "❌ Login é obrigatório."; return; }
  if (emailPlataforma && !contaPlataforma) { $("formMsg").textContent = "❌ Escolha a conta da plataforma junto com o e-mail."; return; }

  $("formMsg").textContent = "Salvando...";
  try {
    const resp = await rpc("rpc_admin_upsert_usuario", { p_admin_password: ADMIN_PASS, p_login: login, p_senha: senha, p_nome: nome, p_ativo: ativo, p_horario_coleta: horario, p_email_plataforma: emailPlataforma, p_conta_id_plataforma: contaPlataforma });
    if (!resp.ok) { $("formMsg").textContent = "❌ " + resp.error; return; }
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
    tbody.innerHTML = '<tr><td colspan="5"><small>Nenhum admin cadastrado ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(a => `
    <tr>
      <td>${esc(a.login)}</td>
      <td>${esc(a.nome)}</td>
      <td><span class="badge ${a.ativo ? '' : 'bloqueado'}">${a.ativo ? 'Ativo' : 'Bloqueado'}</span></td>
      <td>${a.nivel === 'agendamentos' ? 'Só agendamentos' : 'Completo'}</td>
      <td>
        <button data-login="${esc(a.login)}" data-nome="${esc(a.nome)}" data-ativo="${a.ativo}" data-nivel="${esc(a.nivel||'completo')}" class="ghost admEditBtn" style="padding:4px 8px;font-size:11px">Editar</button>
        <button data-login="${esc(a.login)}" data-ativo="${a.ativo}" class="${a.ativo ? 'danger' : 'secondary'} admToggleBtn" style="padding:4px 8px;font-size:11px">${a.ativo ? 'Bloquear' : 'Reativar'}</button>
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
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
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
}

$("btnLimparAdminForm").addEventListener("click", () => {
  $("admLogin").value = "";
  $("admLogin").disabled = false;
  $("admSenha").value = "";
  $("admNome").value = "";
  $("admAtivo").value = "true";
  $("admNivel").value = "completo";
  $("admFormMsg").textContent = "";
});

$("btnSalvarAdmin").addEventListener("click", async () => {
  const login = $("admLogin").value.trim();
  const senha = $("admSenha").value;
  const nome = $("admNome").value.trim();
  const ativo = $("admAtivo").value === "true";
  const nivel = $("admNivel").value;
  if (!login) { $("admFormMsg").textContent = "❌ Login é obrigatório."; return; }

  $("admFormMsg").textContent = "Salvando...";
  try {
    const resp = await rpc("rpc_admin_upsert_admin", { p_admin_password: ADMIN_PASS, p_login: login, p_senha: senha, p_nome: nome, p_ativo: ativo, p_nivel: nivel });
    if (!resp.ok) { $("admFormMsg").textContent = "❌ " + resp.error; return; }
    $("admFormMsg").textContent = "✅ Salvo.";
    $("btnLimparAdminForm").click();
    loadAdmins();
  } catch (e) {
    $("admFormMsg").textContent = "❌ " + e.message;
  }
});

function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// Se já tinha sessão de admin aberta (mesma aba), pula o login.
if (ADMIN_PASS) {
  rpc("rpc_admin_list_usuarios", { p_admin_password: ADMIN_PASS })
    .then(resp => { if (resp.ok) { renderUsuarios(resp.usuarios || []); showApp(); } })
    .catch(() => {});
}
