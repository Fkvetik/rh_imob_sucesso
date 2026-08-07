const SUPABASE_URL = "https://lrejfhsomfxyaoshmpzz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y";

const $ = (id) => document.getElementById(id);
let ADMIN_PASS = sessionStorage.getItem("catho_admin_pass") || "";
let agendamentos = [];
let searchQuery = "";
let dragId = null;
let editingId = null;

const COLUMNS = [
  { id:"AGENDADO",   label:"📨 Agendado",   color:"#3498db" },
  { id:"CONFIRMADO", label:"✅ Confirmado", color:"#25D366" },
  { id:"REALIZADO",  label:"🎯 Realizado",  color:"#8e44ad" },
  { id:"REAGENDADO", label:"🔁 Reagendado", color:"#f39c12" },
  { id:"DESISTIU",   label:"🚫 Desistiu",   color:"#e74c3c" },
  { id:"CANCELADO",  label:"⛔ Cancelado",  color:"#999" },
];

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
  $("loginArea").classList.add("hide");
  $("appArea").classList.remove("hide");
  loadAll();
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
    renderBoard();
    showApp();
  } catch (e) {
    $("loginMsg").textContent = "❌ " + e.message;
  }
});

async function loadAll() {
  await Promise.all([loadAgendamentos(), loadDashboard()]);
}

async function loadAgendamentos() {
  try {
    const resp = await rpc("rpc_admin_list_agendamentos", { p_admin_password: ADMIN_PASS });
    if (!resp.ok) { alert("Sessão expirou: " + resp.error); location.reload(); return; }
    agendamentos = resp.agendamentos || [];
    renderBoard();
  } catch (e) {
    alert("Falha ao carregar agendamentos: " + e.message);
  }
}

async function loadDashboard() {
  try {
    const resp = await rpc("rpc_admin_dashboard", { p_admin_password: ADMIN_PASS });
    if (!resp.ok) return;
    renderDashboard(resp);
  } catch (e) { /* silencioso — dashboard é complementar */ }
}

$("btnRefresh").addEventListener("click", loadAll);
$("searchInput").addEventListener("input", (e) => { searchQuery = e.target.value.toLowerCase().trim(); renderBoard(); });

function filtered() {
  if (!searchQuery) return agendamentos;
  return agendamentos.filter(a =>
    (a.nome_candidato||"").toLowerCase().includes(searchQuery) ||
    (a.telefone||"").includes(searchQuery) ||
    (a.empresa||"").toLowerCase().includes(searchQuery) ||
    (a.nome_operador||"").toLowerCase().includes(searchQuery)
  );
}

// ===== Dashboard =====
function renderDashboard(d) {
  const opStats = (d.leads_por_operador||[]).map(o => `<li><span>${esc(o.login)}</span><span>${o.total} (${o.enviados} enviados)</span></li>`).join("");
  const entrevistadores = (d.entrevistadores||[]).slice(0,8).map(e => `<li><span>${esc(e.entrevistador)}</span><span>${e.total}</span></li>`).join("") || '<li style="color:#aaa">Nenhum ainda</li>';
  const porStatus = {};
  (d.agendamentos_por_status||[]).forEach(s => porStatus[s.status] = s.total);

  $("dashboard").innerHTML = `
    <div class="stat"><div class="num">${d.leads_total||0}</div><div class="label">Leads coletados (total)</div></div>
    <div class="stat"><div class="num">${d.leads_enviados||0}</div><div class="label">Disparos enviados</div></div>
    <div class="stat"><div class="num">${agendamentos.length}</div><div class="label">Agendamentos (total)</div></div>
    <div class="stat"><div class="num">${porStatus.CONFIRMADO||0}</div><div class="label">Confirmados</div></div>
    <div class="stat wide"><div class="label" style="margin-bottom:4px">Leads por operador</div><ul>${opStats || '<li style="color:#aaa">Sem dados</li>'}</ul></div>
    <div class="stat wide"><div class="label" style="margin-bottom:4px">Entrevistas por entrevistador</div><ul>${entrevistadores}</ul></div>
  `;
}

// ===== Kanban =====
function renderBoard() {
  const list = filtered();
  $("board").innerHTML = COLUMNS.map(col => {
    const colItems = list.filter(a => (a.status||"AGENDADO") === col.id);
    const cards = colItems.length === 0
      ? `<div class="empty-col">Vazio</div>`
      : colItems.map(renderCard).join("");
    return `
      <div class="column" style="--col-color:${col.color}">
        <div class="col-header"><span>${col.label}</span><span class="col-count">${colItems.length}</span></div>
        <div class="col-body" data-drop-col="${col.id}">${cards}</div>
      </div>`;
  }).join("");

  document.querySelectorAll(".agcard").forEach(el => {
    el.addEventListener("click", () => openEditModal(parseInt(el.dataset.id, 10)));
    el.addEventListener("dragstart", () => { dragId = parseInt(el.dataset.id, 10); el.classList.add("dragging"); });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
  });
  document.querySelectorAll(".col-body").forEach(col => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      if (!dragId) return;
      const novoStatus = col.dataset.dropCol;
      const a = agendamentos.find(x => x.id === dragId);
      if (!a || a.status === novoStatus) return;
      updateAgendamento(dragId, { p_status: novoStatus, p_autor: "Kanban" }, () => { a.status = novoStatus; renderBoard(); });
    });
  });
}

function renderCard(a) {
  const reag = a.vezes_reagendado > 0 ? `<span class="badge2">🔁 ${a.vezes_reagendado}x reagendado</span>` : "";
  return `
    <div class="agcard" draggable="true" data-id="${a.id}">
      <div class="nome">${esc(a.nome_candidato||"—")}</div>
      <div class="sub">${esc(a.empresa||"—")}</div>
      <div class="sub">${esc(fmtData(a.data_agendamento))}</div>
      <div class="sub">👤 ${esc(a.nome_operador||a.login||"—")}</div>
      ${reag}
    </div>`;
}

// ===== Modal de edição =====
function openEditModal(id) {
  const a = agendamentos.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  $("mNomeCandidato").textContent = a.nome_candidato || "Agendamento";
  $("mSubInfo").textContent = `${a.telefone||"—"} • ${a.empresa||"—"} • operador: ${a.nome_operador||a.login||"—"}`;
  $("mStatus").value = a.status || "AGENDADO";
  $("mData").value = toDatetimeLocal(a.data_agendamento);
  $("mOnline").value = a.entrevista_online === true ? "true" : a.entrevista_online === false ? "false" : "";
  $("mEntrevistador").value = a.entrevistador || "";
  $("mObsEntrevista").value = a.obs_entrevista || "";
  $("mMotivo").value = "";
  $("mHistorico").innerHTML = "Carregando...";
  $("editModal").classList.add("open");

  rpc("rpc_admin_historico_agendamento", { p_admin_password: ADMIN_PASS, p_id: id })
    .then(resp => {
      if (!resp.ok) { $("mHistorico").innerHTML = '<small style="color:#aaa">Sem histórico</small>'; return; }
      const h = resp.historico || [];
      $("mHistorico").innerHTML = h.length
        ? h.map(x => `<div class="hist-item">${esc(x.status_anterior||"—")} → <b>${esc(x.status_novo)}</b>${x.motivo ? " — "+esc(x.motivo) : ""}<br>${new Date(x.criado_em).toLocaleString("pt-BR")}</div>`).join("")
        : '<small style="color:#aaa">Sem mudanças registradas ainda</small>';
    })
    .catch(() => { $("mHistorico").innerHTML = '<small style="color:#aaa">Sem histórico</small>'; });
}

function toDatetimeLocal(s) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtData(s){
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

$("mCancelar").addEventListener("click", () => { $("editModal").classList.remove("open"); editingId = null; });
$("editModal").addEventListener("click", (e) => { if (e.target.id === "editModal") { $("editModal").classList.remove("open"); editingId = null; } });

$("mSalvar").addEventListener("click", () => {
  if (!editingId) return;
  const online = $("mOnline").value;
  updateAgendamento(editingId, {
    p_status: $("mStatus").value,
    p_data_agendamento: $("mData").value || null,
    p_entrevista_online: online === "" ? null : online === "true",
    p_entrevistador: $("mEntrevistador").value.trim() || null,
    p_obs_entrevista: $("mObsEntrevista").value.trim() || null,
    p_motivo: $("mMotivo").value.trim() || null,
    p_autor: "Admin"
  }, () => {
    $("editModal").classList.remove("open");
    editingId = null;
    loadAll();
  });
});

function updateAgendamento(id, fields, onOk) {
  rpc("rpc_admin_update_agendamento", { p_admin_password: ADMIN_PASS, p_id: id, ...fields })
    .then(resp => {
      if (!resp.ok) { alert("❌ " + resp.error); return; }
      onOk && onOk();
    })
    .catch(e => alert("❌ " + e.message));
}

function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

if (ADMIN_PASS) {
  rpc("rpc_admin_list_agendamentos", { p_admin_password: ADMIN_PASS })
    .then(resp => { if (resp.ok) { agendamentos = resp.agendamentos || []; renderBoard(); showApp(); loadDashboard(); } })
    .catch(() => {});
}
