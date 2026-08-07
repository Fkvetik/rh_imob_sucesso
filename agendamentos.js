const SUPABASE_URL = "https://lrejfhsomfxyaoshmpzz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y";

const $ = (id) => document.getElementById(id);
let ADMIN_PASS = sessionStorage.getItem("catho_admin_pass") || "";
let agendamentos = [];
let searchQuery = "";

async function rpc(name, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
    body: JSON.stringify(body || {})
  });
  const data = await r.json().catch(() => ({ ok:false, error:"Resposta inválida" }));
  if (!r.ok) throw new Error(data?.message || data?.error || ("HTTP " + r.status));
  return data;
}

function showApp() {
  $("loginCard").classList.add("hide");
  $("appArea").classList.remove("hide");
  loadAgendamentos();
}

$("btnEntrar").addEventListener("click", async () => {
  const pass = $("adminPass").value;
  if (!pass) { $("loginMsg").textContent = "Digite a senha."; return; }
  $("loginMsg").textContent = "Verificando...";
  try {
    const resp = await rpc("rpc_admin_list_agendamentos", { p_admin_password: pass });
    if (!resp.ok) { $("loginMsg").textContent = "❌ " + resp.error; return; }
    ADMIN_PASS = pass;
    sessionStorage.setItem("catho_admin_pass", pass);
    agendamentos = resp.agendamentos || [];
    render();
    showApp();
  } catch (e) {
    $("loginMsg").textContent = "❌ " + e.message;
  }
});

async function loadAgendamentos() {
  try {
    const resp = await rpc("rpc_admin_list_agendamentos", { p_admin_password: ADMIN_PASS });
    if (!resp.ok) { alert("Sessão expirou: " + resp.error); location.reload(); return; }
    agendamentos = resp.agendamentos || [];
    render();
  } catch (e) {
    alert("Falha ao carregar: " + e.message);
  }
}

$("btnRefresh").addEventListener("click", loadAgendamentos);
$("searchInput").addEventListener("input", (e) => { searchQuery = e.target.value.toLowerCase().trim(); render(); });

function filtered() {
  if (!searchQuery) return agendamentos;
  return agendamentos.filter(a =>
    (a.nome_candidato||"").toLowerCase().includes(searchQuery) ||
    (a.telefone||"").includes(searchQuery) ||
    (a.empresa||"").toLowerCase().includes(searchQuery) ||
    (a.nome_operador||"").toLowerCase().includes(searchQuery)
  );
}

function render() {
  const list = filtered();
  $("statTotal").textContent = `${list.length} agendamento(s)`;
  $("empty").classList.toggle("hide", list.length > 0);
  $("tbody").innerHTML = list.map(a => `
    <tr>
      <td>${esc(fmtData(a.data_agendamento))}</td>
      <td><b>${esc(a.nome_candidato||"—")}</b></td>
      <td>${esc(a.telefone||"—")}</td>
      <td>${esc(a.empresa||"—")}</td>
      <td>${esc(a.nome_operador||a.login||"—")}</td>
      <td><span class="badge">${esc(a.extensao||"—")}</span></td>
      <td><small>${esc(a.observacao||"")}</small></td>
    </tr>
  `).join("");
}

function fmtData(s){
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

if (ADMIN_PASS) {
  rpc("rpc_admin_list_agendamentos", { p_admin_password: ADMIN_PASS })
    .then(resp => { if (resp.ok) { agendamentos = resp.agendamentos || []; render(); showApp(); } })
    .catch(() => {});
}
