const SUPABASE_URL = "https://lrejfhsomfxyaoshmpzz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y";

const $ = (id) => document.getElementById(id);
let ADMIN_PASS = sessionStorage.getItem("catho_admin_pass") || "";
let agendamentos = [];
let searchQuery = "";
let dragId = null;
let editingId = null;

// Cores alinhadas à paleta validada (dataviz) — mesma ordem usada no gráfico de pizza.
const COLUMNS = [
  { id:"AGENDADO",   label:"📨 Agendado",   color:"#2a78d6" },
  { id:"CONFIRMADO", label:"✅ Confirmado", color:"#1baf7a" },
  { id:"REALIZADO",  label:"🎯 Realizado",  color:"#008300" },
  { id:"REAGENDADO", label:"🔁 Reagendado", color:"#eda100" },
  { id:"DESISTIU",   label:"🚫 Desistiu",   color:"#e34948" },
  { id:"CANCELADO",  label:"⛔ Cancelado",  color:"#999999" },
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

  renderCharts(d);
}

// ===== Gráficos (SVG puro, paleta validada em references/palette.md) =====
function showTooltip(evt, html) {
  const tip = $("chartTooltip");
  tip.innerHTML = html;
  tip.style.left = (evt.clientX + 12) + "px";
  tip.style.top = (evt.clientY + 12) + "px";
  tip.classList.add("show");
}
function moveTooltip(evt) {
  const tip = $("chartTooltip");
  tip.style.left = (evt.clientX + 12) + "px";
  tip.style.top = (evt.clientY + 12) + "px";
}
function hideTooltip() { $("chartTooltip").classList.remove("show"); }

function renderCharts(d) {
  $("charts").innerHTML = `
    <div class="chart-card" id="chartDonutCard"></div>
    <div class="chart-card" id="chartWeekCard"></div>
    <div class="chart-card" id="chart30dCard" style="flex-basis:100%"></div>
  `;
  renderDonutStatus(d.agendamentos_por_status || []);
  renderBarDiaSemana(d.por_dia_semana || []);
  renderBar30Dias(d.ultimos_30_dias || []);
}

// --- Donut: agendamentos por etapa (pizza pedida) ---
function renderDonutStatus(rows) {
  const card = $("chartDonutCard");
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (!total) { card.innerHTML = '<h4>Agendamentos por etapa</h4><div class="chart-empty">Sem dados ainda</div>'; return; }

  // segue a MESMA ordem/cor das colunas do Kanban — identidade consistente
  const data = COLUMNS.map(c => ({ ...c, total: (rows.find(r => r.status === c.id)?.total) || 0 })).filter(d => d.total > 0);

  const cx = 90, cy = 90, r = 70, rInner = 42;
  let angle = -90; // começa no topo
  const segs = data.map(d => {
    const frac = d.total / total;
    const startAngle = angle;
    const endAngle = angle + frac * 360;
    angle = endAngle;
    const path = donutArcPath(cx, cy, r, rInner, startAngle, endAngle);
    return { ...d, frac, path };
  });

  const svgSegs = segs.map(s => `
    <path class="donut-seg" d="${s.path}" fill="${s.color}" stroke="var(--surface-1)" stroke-width="2"
      data-label="${esc(s.label)}" data-total="${s.total}" data-pct="${(s.frac*100).toFixed(0)}"></path>
  `).join("");

  const legend = segs.map(s => `
    <div class="li"><span class="swatch" style="background:${s.color}"></span>${esc(s.label)} — <b>${s.total}</b> (${(s.frac*100).toFixed(0)}%)</div>
  `).join("");

  card.innerHTML = `
    <h4>Agendamentos por etapa (${total} total)</h4>
    <div style="display:flex;align-items:center;gap:14px">
      <svg width="180" height="180" viewBox="0 0 180 180">
        ${svgSegs}
        <text x="90" y="86" text-anchor="middle" font-size="20" font-weight="800" fill="var(--text-primary)">${total}</text>
        <text x="90" y="102" text-anchor="middle" font-size="10" fill="var(--text-muted)">agendamentos</text>
      </svg>
    </div>
    <div class="chart-legend">${legend}</div>
  `;

  card.querySelectorAll(".donut-seg").forEach(seg => {
    seg.addEventListener("mousemove", (e) => showTooltip(e, `<b>${seg.dataset.label}</b><br>${seg.dataset.total} (${seg.dataset.pct}%)`));
    seg.addEventListener("mouseleave", hideTooltip);
  });
}

function donutArcPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
  // segmento cheio (360°) vira um anel completo — evita o path degenerar
  if (endDeg - startDeg >= 359.99) endDeg = startDeg + 359.99;
  const toRad = deg => (deg * Math.PI) / 180;
  const p = (radius, deg) => [cx + radius * Math.cos(toRad(deg)), cy + radius * Math.sin(toRad(deg))];
  const [x1, y1] = p(rOuter, startDeg), [x2, y2] = p(rOuter, endDeg);
  const [x3, y3] = p(rInner, endDeg), [x4, y4] = p(rInner, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
}

// --- Barras: padrão por dia da semana ---
function renderBarDiaSemana(rows) {
  const card = $("chartWeekCard");
  const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const byDow = {};
  rows.forEach(r => byDow[r.dow] = r.total);
  const data = DIAS.map((label, i) => ({ label, total: byDow[i] || 0 }));
  const max = Math.max(1, ...data.map(d => d.total));

  if (!rows.length) { card.innerHTML = '<h4>Agendamentos por dia da semana</h4><div class="chart-empty">Sem dados ainda</div>'; return; }

  const w = 260, h = 140, padBottom = 20, barGap = 6;
  const barW = Math.min(24, (w / data.length) - barGap);
  const bars = data.map((d, i) => {
    const x = i * (w / data.length) + ((w / data.length) - barW) / 2;
    const barH = (d.total / max) * (h - padBottom - 10);
    const y = h - padBottom - barH;
    return `<rect class="bar-rect" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH,1).toFixed(1)}" rx="4" fill="var(--seq-blue-450)" data-label="${d.label}" data-total="${d.total}"></rect>
            <text x="${(x+barW/2).toFixed(1)}" y="${h-6}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${d.label}</text>`;
  }).join("");

  card.innerHTML = `
    <h4>Agendamentos por dia da semana</h4>
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1="${h-padBottom}" x2="${w}" y2="${h-padBottom}" stroke="var(--baseline)" stroke-width="1"/>
      ${bars}
    </svg>
  `;
  card.querySelectorAll(".bar-rect").forEach(bar => {
    bar.addEventListener("mousemove", (e) => showTooltip(e, `<b>${bar.dataset.label}</b><br>${bar.dataset.total} agendamento(s)`));
    bar.addEventListener("mouseleave", hideTooltip);
  });
}

// --- Barras: últimos 30 dias (tendência) ---
function renderBar30Dias(rows) {
  const card = $("chart30dCard");
  const byDay = {};
  rows.forEach(r => byDay[r.dia] = r.total);

  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ iso, label: d.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" }), total: byDay[iso] || 0 });
  }
  const max = Math.max(1, ...days.map(d => d.total));
  const hasData = days.some(d => d.total > 0);
  if (!hasData) { card.innerHTML = '<h4>Agendamentos — últimos 30 dias</h4><div class="chart-empty">Sem dados nesse período</div>'; return; }

  const w = 760, h = 150, padBottom = 22;
  const barGap = 2;
  const barW = Math.max(2, (w / days.length) - barGap);
  const bars = days.map((d, i) => {
    const x = i * (w / days.length);
    const barH = (d.total / max) * (h - padBottom - 10);
    const y = h - padBottom - barH;
    const showLabel = i % 5 === 0; // rótulo a cada 5 dias — evita poluir o eixo
    return `<rect class="bar-rect" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH,1).toFixed(1)}" rx="3" fill="var(--seq-blue-450)" data-label="${d.label}" data-total="${d.total}"></rect>
            ${showLabel ? `<text x="${(x+barW/2).toFixed(1)}" y="${h-6}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${d.label}</text>` : ""}`;
  }).join("");

  card.innerHTML = `
    <h4>Agendamentos — últimos 30 dias</h4>
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="0" y1="${h-padBottom}" x2="${w}" y2="${h-padBottom}" stroke="var(--baseline)" stroke-width="1"/>
      ${bars}
    </svg>
  `;
  card.querySelectorAll(".bar-rect").forEach(bar => {
    bar.addEventListener("mousemove", (e) => showTooltip(e, `<b>${bar.dataset.label}</b><br>${bar.dataset.total} agendamento(s)`));
    bar.addEventListener("mouseleave", hideTooltip);
  });
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
