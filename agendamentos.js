const SUPABASE_URL = "https://lrejfhsomfxyaoshmpzz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y";

const $ = (id) => document.getElementById(id);
let ADMIN_PASS = sessionStorage.getItem("catho_admin_pass") || "";
let agendamentos = [];
let searchQuery = "";
let operadorFiltro = "";
let dragId = null;
let editingId = null;

// Status considerados "em aberto" — um AGENDADO com data passada e ninguém
// confirmou/cancelou é o caso que precisa de atenção (atrasado).
const STATUS_ABERTOS = ["AGENDADO"];

$("tabBtnKanban").addEventListener("click", () => switchTab("Kanban"));
$("tabBtnVisaoGeral").addEventListener("click", () => switchTab("VisaoGeral"));
function switchTab(tab) {
  $("tabBtnKanban").classList.toggle("active", tab === "Kanban");
  $("tabBtnVisaoGeral").classList.toggle("active", tab === "VisaoGeral");
  $("tabKanban").classList.toggle("active", tab === "Kanban");
  $("tabVisaoGeral").classList.toggle("active", tab === "VisaoGeral");
}
switchTab("Kanban");

// O Chrome às vezes restaura o texto digitado antes (mesmo com o campo readonly
// e autocomplete=off) — limpa de novo em todo carregamento, incluindo quando a
// página volta do cache do navegador (botão voltar).
function forceClearSearch() {
  const el = document.getElementById("searchInput");
  if (el && el.hasAttribute("readonly")) el.value = "";
}
forceClearSearch();
window.addEventListener("pageshow", forceClearSearch);

// Colunas do Kanban agora são dados (tabela kanban_colunas) — qualquer admin
// pode adicionar/renomear/reordenar/remover pelo botão "⚙️ Colunas".
let COLUMNS = [];

async function loadColunas() {
  try {
    const resp = await rpc("rpc_admin_list_colunas", { p_admin_password: ADMIN_PASS });
    if (resp.ok) COLUMNS = (resp.colunas || []).map(c => ({ id: c.id, label: c.label, color: c.cor }));
  } catch (e) { /* mantém o que já tinha carregado */ }
}

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
    await loadColunas();
    renderBoard();
    showApp();
  } catch (e) {
    $("loginMsg").textContent = "❌ " + e.message;
  }
});

async function loadAll() {
  await Promise.all([loadAgendamentos(), loadDashboard(), loadColunas().then(renderBoard)]);
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
// Campo começa "readonly" (bloqueia autofill do navegador) e só libera pra digitar
// no primeiro clique/foco — nesse momento também garante que está vazio de verdade.
$("searchInput").addEventListener("focus", (e) => {
  if (e.target.hasAttribute("readonly")) {
    e.target.removeAttribute("readonly");
    e.target.value = "";
  }
}, { once: true });
$("searchInput").addEventListener("input", (e) => { searchQuery = e.target.value.toLowerCase().trim(); renderBoard(); });
$("filtroOperador").addEventListener("change", (e) => { operadorFiltro = e.target.value; renderBoard(); });

function renderFiltroOperador() {
  const sel = $("filtroOperador");
  const atual = sel.value;
  const ops = [...new Set(agendamentos.map(a => a.login).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todos os operadores</option>' + ops.map(login => {
    const nome = agendamentos.find(a => a.login === login)?.nome_operador || login;
    return `<option value="${esc(login)}">${esc(nome)}</option>`;
  }).join("");
  if (ops.includes(atual)) sel.value = atual;
}

function isAtrasado(a) {
  if (!STATUS_ABERTOS.includes(a.status || "AGENDADO")) return false;
  if (!a.data_agendamento) return false;
  const d = new Date(a.data_agendamento);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

function filtered() {
  let list = agendamentos;
  if (operadorFiltro) list = list.filter(a => a.login === operadorFiltro);
  if (!searchQuery) return list;
  return list.filter(a =>
    (a.nome_candidato||"").toLowerCase().includes(searchQuery) ||
    (a.telefone||"").includes(searchQuery) ||
    (a.empresa||"").toLowerCase().includes(searchQuery) ||
    (a.nome_operador||"").toLowerCase().includes(searchQuery) ||
    (a.login||"").toLowerCase().includes(searchQuery)
  );
}

// ===== Exportar CSV =====
function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
$("btnExportCsv").addEventListener("click", () => {
  const rows = filtered();
  const header = ["Nome candidato","Telefone","Empresa","Etapa","Data agendamento","Operador","Entrevistador","Atrasado"];
  const body = rows.map(a => [
    a.nome_candidato||"", a.telefone||"", a.empresa||"",
    (COLUMNS.find(c => c.id === a.status)?.label) || a.status || "",
    fmtData(a.data_agendamento), a.nome_operador||a.login||"", a.entrevistador||"",
    isAtrasado(a) ? "SIM" : "NAO"
  ].map(csvEscape).join(";"));
  const csv = "﻿" + [header.join(";"), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agendamentos_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

// ===== Dashboard =====
function renderDashboard(d) {
  const opStats = (d.leads_por_operador||[]).map(o => `<li><span>${esc(o.login)}</span><span>${o.total} (${o.enviados} enviados)</span></li>`).join("");
  const agStats = (d.agendamentos_por_operador||[]).map(o => `<li><span>${esc(o.nome_operador||o.login)}</span><span>${o.total} (${o.confirmados} confirmados+)</span></li>`).join("") || '<li style="color:#aaa">Nenhum ainda</li>';
  const entrevistadores = (d.entrevistadores||[]).slice(0,8).map(e => `<li><span>${esc(e.entrevistador)}</span><span>${e.total}</span></li>`).join("") || '<li style="color:#aaa">Nenhum ainda</li>';
  const porStatus = {};
  (d.agendamentos_por_status||[]).forEach(s => porStatus[s.status] = s.total);

  $("dashboard").innerHTML = `
    <div class="stat"><div class="num">${d.leads_total||0}</div><div class="label">Leads coletados (total)</div></div>
    <div class="stat"><div class="num">${d.leads_enviados||0}</div><div class="label">Disparos enviados</div></div>
    <div class="stat"><div class="num">${agendamentos.length}</div><div class="label">Agendamentos (total)</div></div>
    <div class="stat"><div class="num">${porStatus.CONFIRMADO||0}</div><div class="label">Confirmados</div></div>
    <div class="stat wide"><div class="label" style="margin-bottom:4px">Leads por operador</div><ul>${opStats || '<li style="color:#aaa">Sem dados</li>'}</ul></div>
    <div class="stat wide"><div class="label" style="margin-bottom:4px">Agendamentos por operador (produção individual)</div><ul>${agStats}</ul></div>
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
    return `<rect class="bar-rect" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH,1).toFixed(1)}" rx="3" fill="var(--seq-blue-450)" data-label="${d.label}" data-total="${d.total}" data-iso="${d.iso}"></rect>
            ${showLabel ? `<text x="${(x+barW/2).toFixed(1)}" y="${h-6}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${d.label}</text>` : ""}`;
  }).join("");

  card.innerHTML = `
    <h4>Agendamentos — últimos 30 dias <small style="font-weight:400;color:var(--text-muted)">(clique num dia pra ver quem está agendado)</small></h4>
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="0" y1="${h-padBottom}" x2="${w}" y2="${h-padBottom}" stroke="var(--baseline)" stroke-width="1"/>
      ${bars}
    </svg>
  `;
  card.querySelectorAll(".bar-rect").forEach(bar => {
    bar.addEventListener("mousemove", (e) => showTooltip(e, `<b>${bar.dataset.label}</b><br>${bar.dataset.total} agendamento(s)`));
    bar.addEventListener("mouseleave", hideTooltip);
    bar.addEventListener("click", () => openDayModal(bar.dataset.iso, bar.dataset.label));
  });
}

// ===== Kanban =====
function renderBoard() {
  renderFiltroOperador();
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
    el.addEventListener("click", (e) => { if (e.target.closest(".wa-stop")) return; openEditModal(parseInt(el.dataset.id, 10)); });
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

// Link universal — abre o app do WhatsApp se tiver instalado, senão o Web/Desktop.
function waLink(phone) {
  const digits = String(phone||"").replace(/\D+/g,"");
  if (!digits) return "";
  return `https://wa.me/${digits.startsWith("55") ? digits : "55"+digits}`;
}

function renderCard(a) {
  const reag = a.vezes_reagendado > 0 ? `<span class="badge2">🔁 ${a.vezes_reagendado}x reagendado</span>` : "";
  const atrasado = isAtrasado(a);
  const badgeAtrasado = atrasado ? `<span class="badge-atrasado">⚠️ Atrasado</span>` : "";
  const wa = waLink(a.telefone);
  return `
    <div class="agcard${atrasado ? " atrasado" : ""}" draggable="true" data-id="${a.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
        <div class="nome">${esc(a.nome_candidato||"—")}</div>
        ${wa ? `<a href="${wa}" target="_blank" class="wa-btn-sm wa-stop" title="Abrir WhatsApp">💬</a>` : ""}
      </div>
      <div class="sub">${esc(a.empresa||"—")}</div>
      <div class="sub">${esc(fmtData(a.data_agendamento))}</div>
      <div class="sub">👤 ${esc(a.nome_operador||a.login||"—")}</div>
      ${reag}${badgeAtrasado}
    </div>`;
}

// ===== Modal "agendamentos do dia" (clique numa barra do gráfico de 30 dias) =====
function openDayModal(iso, label) {
  if (!iso) return
  const doDia = agendamentos.filter(a => {
    if (!a.data_agendamento) return false
    const d = new Date(a.data_agendamento)
    if (isNaN(d.getTime())) return false
    const dIso = d.toISOString().slice(0, 10)
    return dIso === iso
  })

  $("dayModalTitle").textContent = `Agendamentos de ${label || iso}`
  $("dayModalList").innerHTML = doDia.length
    ? doDia.map(a => {
        const wa = waLink(a.telefone)
        return `
        <div class="day-item">
          <div class="info">
            <div class="nome">${esc(a.nome_candidato||"—")}</div>
            <div class="sub">${esc(a.telefone||"—")} • ${esc(a.empresa||"—")} • ${esc(fmtData(a.data_agendamento))}</div>
          </div>
          ${wa ? `<a href="${wa}" target="_blank" class="wa-btn-sm" title="Abrir WhatsApp">💬</a>` : ""}
        </div>`
      }).join("")
    : '<div class="chart-empty">Nenhum agendamento nesse dia</div>'

  $("dayModal").classList.add("open")
}
$("btnFecharDay").addEventListener("click", () => $("dayModal").classList.remove("open"))
$("dayModal").addEventListener("click", (e) => { if (e.target.id === "dayModal") $("dayModal").classList.remove("open") })

// ===== Modal de edição =====
function openEditModal(id) {
  const a = agendamentos.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  $("mNomeCandidato").textContent = a.nome_candidato || "Agendamento";
  $("mSubInfo").textContent = `${a.telefone||"—"} • ${a.empresa||"—"} • operador: ${a.nome_operador||a.login||"—"}`;
  const wa = waLink(a.telefone);
  $("mWaLink").href = wa || "#";
  $("mWaLink").style.pointerEvents = wa ? "" : "none";
  $("mWaLink").style.opacity = wa ? "" : ".4";
  $("mStatus").innerHTML = COLUMNS.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("");
  $("mStatus").value = a.status || (COLUMNS[0]?.id || "AGENDADO");
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

// ===== Gerenciar colunas do Kanban =====
let colunasEditando = [];
let colunasRemovidas = [];
let dragColIdx = null;

$("btnColunas").addEventListener("click", () => {
  colunasEditando = COLUMNS.map(c => ({ ...c }));
  colunasRemovidas = [];
  $("colunasMsg").textContent = "";
  renderColunasList();
  $("colunasModal").classList.add("open");
});
$("btnFecharColunas").addEventListener("click", () => $("colunasModal").classList.remove("open"));
$("colunasModal").addEventListener("click", (e) => { if (e.target.id === "colunasModal") $("colunasModal").classList.remove("open"); });

function renderColunasList() {
  $("colunasList").innerHTML = colunasEditando.map((c, i) => `
    <div class="col-row" draggable="true" data-i="${i}">
      <span class="col-drag-handle">⠿</span>
      <input type="text" data-i="${i}" class="colLabelInput" value="${esc(c.label)}" placeholder="Nome da coluna">
      <input type="color" data-i="${i}" class="colColorInput" value="${normalizeHex(c.color)}">
      ${colunasEditando.length > 1 ? `<button class="rm-col-btn" data-i="${i}">🗑</button>` : '<span style="width:36px"></span>'}
    </div>
  `).join("");

  $("colunasList").querySelectorAll(".colLabelInput").forEach(inp => {
    inp.addEventListener("input", () => { colunasEditando[parseInt(inp.dataset.i,10)].label = inp.value; });
  });
  $("colunasList").querySelectorAll(".colColorInput").forEach(inp => {
    inp.addEventListener("input", () => { colunasEditando[parseInt(inp.dataset.i,10)].color = inp.value; });
  });
  $("colunasList").querySelectorAll(".rm-col-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.i, 10);
      const removida = colunasEditando.splice(i, 1)[0];
      if (removida && !String(removida.id).startsWith("_novo_")) colunasRemovidas.push(removida.id);
      renderColunasList();
    });
  });

  $("colunasList").querySelectorAll(".col-row").forEach(row => {
    row.addEventListener("dragstart", () => { dragColIdx = parseInt(row.dataset.i, 10); });
    row.addEventListener("dragover", (e) => { e.preventDefault(); row.classList.add("drag-over"); });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const targetI = parseInt(row.dataset.i, 10);
      if (dragColIdx === null || dragColIdx === targetI) return;
      const moved = colunasEditando.splice(dragColIdx, 1)[0];
      colunasEditando.splice(targetI, 0, moved);
      dragColIdx = null;
      renderColunasList();
    });
  });
}

function normalizeHex(c) {
  if (!c) return "#999999";
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#999999";
}

$("btnAddColuna").addEventListener("click", () => {
  const label = prompt("Nome da nova coluna:", "Nova etapa");
  if (!label || !label.trim()) return;
  colunasEditando.push({ id: "_novo_" + Date.now(), label: label.trim(), color: "#95a5a6" });
  renderColunasList();
});

$("btnSalvarColunas").addEventListener("click", async () => {
  if (!colunasEditando.length) { $("colunasMsg").textContent = "❌ Precisa ter pelo menos 1 coluna."; return; }
  $("colunasMsg").textContent = "Salvando...";
  try {
    // remove as colunas marcadas (backend recusa se ainda tiver agendamento usando)
    for (const id of colunasRemovidas) {
      const resp = await rpc("rpc_admin_delete_coluna", { p_admin_password: ADMIN_PASS, p_id: id });
      if (!resp.ok) { $("colunasMsg").textContent = "❌ " + resp.error; return; }
    }
    // salva ordem + label + cor de cada coluna (cria as novas automaticamente)
    for (let i = 0; i < colunasEditando.length; i++) {
      const c = colunasEditando[i];
      const idFinal = String(c.id).startsWith("_novo_") ? c.label : c.id;
      const resp = await rpc("rpc_admin_upsert_coluna", { p_admin_password: ADMIN_PASS, p_id: idFinal, p_label: c.label, p_cor: c.color, p_ordem: i+1 });
      if (!resp.ok) { $("colunasMsg").textContent = "❌ " + resp.error; return; }
    }
    $("colunasMsg").textContent = "✅ Colunas salvas.";
    await loadColunas();
    renderBoard();
    setTimeout(() => $("colunasModal").classList.remove("open"), 500);
  } catch (e) {
    $("colunasMsg").textContent = "❌ " + e.message;
  }
});

function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

if (ADMIN_PASS) {
  rpc("rpc_admin_list_agendamentos", { p_admin_password: ADMIN_PASS })
    .then(async resp => {
      if (!resp.ok) return;
      agendamentos = resp.agendamentos || [];
      await loadColunas();
      renderBoard();
      showApp();
      loadDashboard();
    })
    .catch(() => {});
}
