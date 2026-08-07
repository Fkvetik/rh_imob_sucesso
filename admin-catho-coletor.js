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
      <td>
        <button data-login="${esc(u.login)}" data-nome="${esc(u.nome_operador)}" data-ativo="${u.ativo}" class="ghost editBtn" style="padding:4px 8px;font-size:11px">Editar</button>
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
      window.scrollTo({ top: 0, behavior: "smooth" });
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

$("btnRefresh").addEventListener("click", loadUsuarios);

$("btnLimparForm").addEventListener("click", () => {
  $("fLogin").value = "";
  $("fLogin").disabled = false;
  $("fSenha").value = "";
  $("fNome").value = "";
  $("fAtivo").value = "true";
  $("formMsg").textContent = "";
});

$("btnSalvarUsuario").addEventListener("click", async () => {
  const login = $("fLogin").value.trim();
  const senha = $("fSenha").value;
  const nome = $("fNome").value.trim();
  const ativo = $("fAtivo").value === "true";
  if (!login) { $("formMsg").textContent = "❌ Login é obrigatório."; return; }

  $("formMsg").textContent = "Salvando...";
  try {
    const resp = await rpc("rpc_admin_upsert_usuario", { p_admin_password: ADMIN_PASS, p_login: login, p_senha: senha, p_nome: nome, p_ativo: ativo });
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
    tbody.innerHTML = '<tr><td colspan="4"><small>Nenhum admin cadastrado ainda.</small></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(a => `
    <tr>
      <td>${esc(a.login)}</td>
      <td>${esc(a.nome)}</td>
      <td><span class="badge ${a.ativo ? '' : 'bloqueado'}">${a.ativo ? 'Ativo' : 'Bloqueado'}</span></td>
      <td>
        <button data-login="${esc(a.login)}" data-nome="${esc(a.nome)}" data-ativo="${a.ativo}" class="ghost admEditBtn" style="padding:4px 8px;font-size:11px">Editar</button>
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
  $("admFormMsg").textContent = "";
});

$("btnSalvarAdmin").addEventListener("click", async () => {
  const login = $("admLogin").value.trim();
  const senha = $("admSenha").value;
  const nome = $("admNome").value.trim();
  const ativo = $("admAtivo").value === "true";
  if (!login) { $("admFormMsg").textContent = "❌ Login é obrigatório."; return; }

  $("admFormMsg").textContent = "Salvando...";
  try {
    const resp = await rpc("rpc_admin_upsert_admin", { p_admin_password: ADMIN_PASS, p_login: login, p_senha: senha, p_nome: nome, p_ativo: ativo });
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
