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
// Etapas em que a entrevista ainda não tem desfecho: se a data passou, está atrasado.
// (Antes só "Agendado" contava — um Confirmado ou Reagendado com a data vencida ficava sem aviso.)
const STATUS_ABERTOS = ["AGENDADO", "CONFIRMADO", "REAGENDADO", "PRESENCIAL"];

// Caminho de cada agendamento: as etapas por onde ele já passou, tiradas do
// histórico (SQL AGEND_1). Quem agendou presencial continua contando como
// "agendou presencial" mesmo depois de virar Contratado ou Desistiu.
let JORNADA = {};        // id do agendamento -> { etapas:[...], presencial_em }
let temJornada = false;  // o banco já tem a consulta do caminho?
function passouPor(a, etapa) {
  if (String(a.status || "AGENDADO").toUpperCase() === etapa) return true;
  const j = JORNADA[a.id];
  return !!(j && (j.etapas || []).includes(etapa));
}

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
  iniciarAutoRefresh();
}

// Antes só carregava uma vez no login — quem ficava com a aba aberta nunca
// via um agendamento novo (WhatsApp/extensão) sem dar F5 na mão. Reforça a
// cada 45s, mas nunca no meio de um drag (perderia a carta arrastada) nem
// com o modal de edição aberto (sobrescreveria o que a pessoa está digitando).
let AUTO_REFRESH_TIMER = null;
function iniciarAutoRefresh() {
  if (AUTO_REFRESH_TIMER) return;
  AUTO_REFRESH_TIMER = setInterval(() => {
    if (dragId != null) return;
    if ($("editModal")?.classList.contains("open")) return;
    loadAll();
  }, 45000);
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
    const [resp, taxa, ritmo, jornada] = await Promise.all([
      rpc("rpc_admin_dashboard", { p_admin_password: ADMIN_PASS }),
      // Taxa de resposta por operador — se a consulta não existir/falhar, o
      // resto do painel aparece do mesmo jeito.
      rpc("rpc_admin_taxa_resposta", { p_admin_password: ADMIN_PASS }).catch(() => null),
      // Ritmo semana a semana (SQL DASH_2) — sem ele, fica só a faixa de períodos.
      rpc("rpc_admin_ritmo_semanal", { p_admin_password: ADMIN_PASS }).catch(() => null),
      // Caminho de cada agendamento (SQL AGEND_1) — sem ele, vale só a etapa atual.
      rpc("rpc_admin_jornada_agendamentos", { p_admin_password: ADMIN_PASS }).catch(() => null)
    ]);
    if (!resp.ok) return;
    resp.taxa_resposta = (taxa && taxa.ok) ? taxa : null;
    resp.ritmo_semanal = (ritmo && ritmo.ok) ? ritmo : null;
    if (jornada && jornada.ok) {
      const antes = JSON.stringify(JORNADA);
      JORNADA = {}; (jornada.itens || []).forEach(i => { JORNADA[i.id] = i; });
      temJornada = true;
      if (antes !== JSON.stringify(JORNADA)) renderBoard(); // selo "agendou presencial" nos cartões
    }
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
  _ultimoDash = d;
  const porStatus = {};
  (d.agendamentos_por_status||[]).forEach(s => porStatus[s.status] = s.total);

  // Funil simples com os números que já existem — dá pra ver de cara quantas
  // pessoas foram abordadas em relação ao total coletado, e quanto disso virou
  // agendamento, sem precisar de nenhuma consulta nova.
  const pct = (parte, total) => total > 0 ? Math.round((parte / total) * 100) : 0;
  // Abordados inclui leads que depois foram excluídos; o total "ativo" não.
  // Comparar os dois dava mais de 100%. Com o total bruto (todos os leads
  // já coletados, inclusive excluídos) a conta fecha.
  const temBruto = d.leads_total_bruto != null;
  const baseColetados = temBruto ? d.leads_total_bruto : (d.leads_total || 0);

  // Taxa de resposta: dos abordados, quantos responderam e tiveram retorno
  // do operador (detectado sozinho pela extensão na conversa do WhatsApp) ou
  // avançaram para agendado/contratado. O resto é "sem resposta".
  const tr = d.taxa_resposta;
  const trG = tr && tr.geral;
  // Funil: abordados -> responderam -> receberam a proposta -> agendaram.
  // "Pararam na proposta" = receberam a apresentação da empresa e não
  // agendaram. Sem prazo: fica valendo até a operação ser reiniciada.
  const temFunil = !!(trG && trG.total && trG.total.proposta != null); // banco já com o FUNIL_1
  const nn = (o, k) => Number(o && o[k]) || 0;
  const semResp = o => Math.max(0, nn(o, "abordados") - nn(o, "responderam"));
  const fmtDia = s => { if (!s) return ""; const dt = new Date(s); return isNaN(dt) ? "" : dt.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit" }); };
  // Soma várias contagens (atual + anteriores) e refaz os percentuais.
  const somaFunil = lista => {
    const s = {};
    ["abordados","responderam","proposta","agendaram","pararam_na_proposta"].forEach(k => { s[k] = lista.reduce((a, f) => a + nn(f, k), 0); });
    s.taxa_pct = s.abordados ? Math.round(1000 * s.responderam / s.abordados) / 10 : 0;
    return s;
  };
  // Tabela do funil: uma linha por período/contagem, uma coluna por etapa.
  // (Antes era uma frase corrida por linha, que quebrava toda torta.)
  const funilTabela = (linhas, extras) => { extras = extras || []; return `
      <table class="funil-tab">
        <thead><tr><th></th>${extras.map(e => `<th>${e.th}</th>`).join("")}<th>Abordados</th><th>Responderam</th>${temFunil ? "<th>Proposta</th>" : ""}<th>Agendaram</th>${temFunil ? '<th class="parou">Pararam na proposta</th>' : ""}<th class="apagado">Sem resposta</th></tr></thead>
        <tbody>${linhas.filter(l => l && l.o).map(l => `
          <tr class="${l.cls || ""}">
            <td class="rot">${l.rot}${l.sub ? `<small>${l.sub}</small>` : ""}</td>
            ${extras.map(e => `<td>${l.extra && l.extra[e.k] != null ? l.extra[e.k] : '<span class="apagado">—</span>'}</td>`).join("")}
            <td>${nn(l.o,"abordados")}</td>
            <td><b>${nn(l.o,"responderam")}</b> <small>${nn(l.o,"taxa_pct")}%</small></td>
            ${temFunil ? `<td><b>${nn(l.o,"proposta")}</b></td>` : ""}
            <td><b>${temFunil ? nn(l.o,"agendaram") : nn(l.o,"agendados")}</b></td>
            ${temFunil ? `<td class="parou"><b>${nn(l.o,"pararam_na_proposta")}</b></td>` : ""}
            <td class="apagado">${semResp(l.o)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`; };
  // ── Por operador: UMA tabela com tudo o que antes ficava em quatro cartões
  // (funil por operador, leads por operador, agendamentos por operador).
  // Contagens anteriores viram linhas logo abaixo do operador.
  const chave = s => String(s || "").trim().toLowerCase();
  const coletadosDe = {}, agDe = {};
  (d.leads_por_operador||[]).forEach(o => { coletadosDe[chave(o.login)] = o.total; });
  (d.agendamentos_por_operador||[]).forEach(o => { agDe[chave(o.login)] = `<b>${o.total}</b> <small>${o.confirmados} confirm.+</small>`; });
  const ops = tr ? (tr.operadores||[]) : [];
  const temCiclos = ops.some(o => (o.ciclos||[]).length);
  const linhasOps = [];
  ops.forEach(o => {
    const x = o.total || {}, ciclos = o.ciclos || [], k = chave(o.login);
    linhasOps.push({ rot: esc(o.nome_operador||o.login), sub: o.desde ? "contagem atual, desde " + fmtDia(o.desde) : (ciclos.length ? "contagem atual" : ""), o: x, cls: "atual",
      extra: { coletados: coletadosDe[k], ag: agDe[k] } });
    if (ciclos.length) linhasOps.push({ rot: "↳ Operação inteira", sub: "atual + " + ciclos.length + " anterior" + (ciclos.length > 1 ? "es" : ""), o: somaFunil([x].concat(ciclos.map(c => c.numeros || {}))), cls: "total" });
    ciclos.forEach(c => linhasOps.push({ rot: "↳ " + (fmtDia(c.inicio) || "início") + " a " + fmtDia(c.fim), sub: c.nota ? esc(c.nota) : "contagem anterior", o: c.numeros || {}, cls: "antiga" }));
  });
  // Com um operador só e sem contagens anteriores, a tabela repete o Total do
  // funil: fica recolhida. O operador abre se quiser (e a escolha é lembrada).
  const abrirOps = _opsAberto != null ? _opsAberto : (ops.length > 1 || temCiclos);
  const extrasOps = [{ th: "Leads coletados", k: "coletados" }, { th: "Agendamentos", k: "ag" }];

  const abordados = tr ? nn(trG.total, "abordados") : (d.leads_enviados || 0);

  // Desfecho dos agendamentos — contado nos MESMOS cartões do Kanban, para as
  // duas abas dizerem a mesma coisa.
  const stDe = a => String(a.status || "AGENDADO").toUpperCase();
  const qtd = lista => agendamentos.filter(a => lista.includes(stDe(a))).length;
  const agAbertos = qtd(["AGENDADO", "CONFIRMADO", "REAGENDADO", "PRESENCIAL"]);
  const agFeitos = qtd(["REALIZADO", "CONTRATADO"]);
  const agContratados = qtd(["CONTRATADO"]);
  const agPerdidos = qtd(["DESISTIU", "CANCELADO"]);
  const agAtrasados = agendamentos.filter(isAtrasado).length;
  const desfechoTxt = `${agAbertos} em aberto · ${agFeitos} realizada${agFeitos === 1 ? "" : "s"}${agContratados ? ` (${agContratados} contratado${agContratados === 1 ? "" : "s"})` : ""} · ${agPerdidos} desistência${agPerdidos === 1 ? "" : "s"}/cancelamento${agPerdidos === 1 ? "" : "s"}`;

  // ── Depois de agendar: o caminho do candidato (online → presencial →
  // contratado) e quantos cartões há em cada coluna do Kanban agora.
  const fezOnline = agendamentos.filter(a => ["REALIZADO", "PRESENCIAL", "CONTRATADO"].some(e => passouPor(a, e))).length;
  const marcouPresencial = agendamentos.filter(a => passouPor(a, "PRESENCIAL")).length;
  const temColPresencial = COLUMNS.some(c => c.id === "PRESENCIAL");
  // O que aconteceu com quem agendou a presencial. Quem desistiu ou cancelou
  // DEPOIS de marcar continua contando: passou pela online e chegou a marcar,
  // então é um candidato com potencial que vale retomar.
  const dosPresenciais = agendamentos.filter(a => passouPor(a, "PRESENCIAL"));
  const presAgora = dosPresenciais.filter(a => stDe(a) === "PRESENCIAL").length;
  const presContratados = dosPresenciais.filter(a => stDe(a) === "CONTRATADO").length;
  const presPerdidos = dosPresenciais.filter(a => ["DESISTIU", "CANCELADO"].includes(stDe(a)));
  const presSub = !temColPresencial ? "etapa ainda não criada no Kanban"
    : !marcouPresencial ? "ninguém ainda"
    : `${presAgora} com a presencial marcada · ${presContratados} contratado${presContratados === 1 ? "" : "s"} · <span class="parou-txt">${presPerdidos.length} desistiu/cancelou depois</span>`;
  const presPerdidosHtml = !presPerdidos.length ? "" : `
      <div class="nota-pres"><b>Agendaram a presencial e saíram depois (${presPerdidos.length}):</b> ${presPerdidos.map(a => `${esc(a.nome_candidato || "—")} <small>(${stDe(a) === "DESISTIU" ? "desistiu" : "cancelou"})</small>`).join(", ")}. Passaram pela entrevista online e chegaram a marcar a presencial: são os candidatos com mais potencial para retomar.</div>`;
  const cx = (rot, num, sub, cls) => `<div class="etapa ${cls || ""}"><span>${rot}</span><b>${num}</b><small>${sub}</small></div>`;
  const st2 = (parte, total) => `<div class="seta"><i>${pct(parte, total)}%</i>→</div>`;
  const porColuna = COLUMNS.map(c => `<span class="chip-col" style="border-color:${esc(c.color || "#ccc")}"><i style="background:${esc(c.color || "#ccc")}"></i>${esc(c.label)} <b>${agendamentos.filter(a => stDe(a) === c.id).length}</b></span>`).join("");
  const jornadaHtml = !agendamentos.length ? "" : `
    <div class="stat full">
      <div class="label">Depois de agendar <small>— o caminho do candidato: entrevista online, presencial e contratação (empresa inteira)</small></div>
      <div class="etapas">
        ${cx("Agendaram", agendamentos.length, `${agPerdidos} desistiram ou cancelaram`)}
        ${st2(fezOnline, agendamentos.length)}
        ${cx("Fizeram a entrevista online", fezOnline, "primeira entrevista, realizada")}
        ${st2(marcouPresencial, fezOnline)}
        ${cx("Agendaram presencial", marcouPresencial, presSub)}
        <div class="seta">→</div>
        ${cx("Contratados", agContratados, `${pct(agContratados, fezOnline)}% de quem fez a online · ${pct(agContratados, agendamentos.length)}% dos agendados`, "fim")}
      </div>
      ${presPerdidosHtml}
      ${temColPresencial && !temJornada ? '<div class="nota-dif">O histórico das etapas não carregou: a contagem de presencial está considerando só quem está nessa etapa agora.</div>' : ""}
      <div class="label" style="margin-top:12px">Agora em cada etapa <small>— os mesmos números das colunas do Kanban</small></div>
      <div class="chips-col">${porColuna}</div>
    </div>`;

  // ── Ritmo semana a semana, desde a primeira abordagem da empresa. Serve
  // para operações longas: no dia 28, 60 ou 120 o histórico inteiro continua
  // visível. Com mais de um operador, mostra a parte de cada um.
  const rs = d.ritmo_semanal, semanas = (rs && rs.semanas) || [];
  const diaMes = s => { const p = String(s || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : ""; };
  const nomeOp = {};
  ops.forEach(o => { nomeOp[chave(o.login)] = o.nome_operador || o.login; });
  const opsRitmo = [...new Set(semanas.flatMap(s => Object.keys(s.operadores || {})))];
  const colsOp = opsRitmo.length > 1 && opsRitmo.length <= 6 ? opsRitmo : [];
  const maxSem = Math.max(1, ...semanas.map(s => s.abordados || 0));
  let acum = 0;
  const linhasSem = semanas.map((s, i) => {
    acum += s.abordados || 0;
    const atual = i === semanas.length - 1;
    return `<tr class="${atual ? "atual" : ""}">
        <td class="rot">Semana ${s.semana}<small>${diaMes(s.inicio)} a ${diaMes(s.fim)}${atual ? " · em andamento" : ""}</small></td>
        <td><b>${s.abordados || 0}</b></td>
        <td class="barra"><span style="width:${Math.round(100 * (s.abordados || 0) / maxSem)}%"></span></td>
        ${colsOp.map(l => `<td>${(s.operadores || {})[l] || 0}</td>`).join("")}
        <td class="apagado">${acum}</td>
      </tr>`;
  }).reverse().join(""); // a semana atual em cima
  const ritmoSemanalHtml = !semanas.length ? "" : `
      <div class="ritmo-sem">
        <table class="funil-tab">
          <thead><tr><th></th><th>Abordados</th><th></th>${colsOp.map(l => `<th>${esc(nomeOp[chave(l)] || l)}</th>`).join("")}<th class="apagado">Acumulado</th></tr></thead>
          <tbody>${linhasSem}</tbody>
        </table>
      </div>`;
  // ── Etapas do funil: por onde o lead passou e onde parou. Cada caixa é uma
  // etapa; a seta mostra quantos % avançaram; embaixo, quantos pararam ali.
  // Com mais de um operador, dá para olhar o funil da empresa inteira ou de
  // um operador só (botões "Ver"). Os cartões do topo são sempre da empresa.
  const opSel = ops.length > 1 ? ops.find(o => chave(o.login) === _opVisao) : null;
  const fonte = opSel ? { hoje: null, d7: opSel.d7, d30: opSel.d30, total: opSel.total } : trG;
  const quem = opSel ? esc(opSel.nome_operador || opSel.login) : (ops.length > 1 ? "empresa inteira" : "operação inteira");
  const verHtml = ops.length < 2 ? "" : `
    <div class="ver-op">
      <span>Ver:</span>
      <button data-op="" class="${opSel ? "" : "on"}">Empresa inteira</button>
      ${ops.map(o => `<button data-op="${esc(chave(o.login))}" class="${opSel === o ? "on" : ""}">${esc(o.nome_operador || o.login)}</button>`).join("")}
    </div>`;
  const fT = fonte && fonte.total;
  const etapasHtml = !fT ? "" : (() => {
    const ab = nn(fT,"abordados"), re = nn(fT,"responderam"), pr = nn(fT,"proposta");
    const ag = temFunil ? nn(fT,"agendaram") : nn(fT,"agendados");
    const parouProp = temFunil ? nn(fT,"pararam_na_proposta") : 0;
    const caixa = (rot, num, parou, parouTxt, cls) => `
        <div class="etapa ${cls || ""}">
          <span>${rot}</span><b>${num}</b>
          ${parouTxt ? `<small class="${parou > 0 ? "parou" : ""}">${parou} ${parouTxt}</small>` : `<small class="fim">${fimTxt}</small>`}
        </div>`;
    // Na visão da empresa, o desfecho vem do Kanban; na de um operador, dos cartões dele.
    const doOp = opSel ? agendamentos.filter(a => chave(a.login) === chave(opSel.login)) : agendamentos;
    const q2 = lista => doOp.filter(a => lista.includes(stDe(a))).length;
    const fimTxt = `${q2(["AGENDADO","CONFIRMADO","REAGENDADO","PRESENCIAL"])} em aberto · ${q2(["REALIZADO","CONTRATADO"])} realizadas · ${q2(["DESISTIU","CANCELADO"])} perdidos`;
    const seta = (parte, total) => `<div class="seta"><i>${pct(parte, total)}%</i>→</div>`;
    return `
    <div class="stat full">
      <div class="label">Etapas do funil <small>— por onde os leads passaram e onde pararam (${quem})</small></div>
      <div class="etapas">
        ${caixa("Abordados", ab, Math.max(0, ab - re), "não responderam")}
        ${seta(re, ab)}
        ${caixa("Responderam", re, temFunil ? Math.max(0, re - pr) : Math.max(0, re - ag), temFunil ? "pararam antes da proposta" : "não agendaram")}
        ${temFunil ? seta(pr, re) + caixa("Receberam a proposta", pr, parouProp, "pararam na proposta") + seta(ag, pr) : seta(ag, re)}
        ${caixa("Agendaram", ag, 0, "", "fim")}
      </div>
    </div>`;
  })();

  const titulo = (txt, sub) => `<div class="dash-sec">${txt}${sub ? ` <small>${sub}</small>` : ""}</div>`;

  $("dashboard").innerHTML = `
    ${titulo("Funil", "da coleta ao agendamento")}
    <div class="dash-kpis">
    <div class="stat"><div class="num">${baseColetados}</div><div class="label">Leads coletados${temBruto ? " (incluindo excluídos)" : ""}</div><div class="sub">${Math.min(100, pct(abordados, baseColetados))}% já abordados</div></div>
    ${tr ? `<div class="stat"><div class="num">${nn(trG.total,"taxa_pct")}%</div><div class="label">Taxa de resposta</div><div class="sub">${nn(trG.total,"responderam")} de ${abordados} abordados</div></div>` : `<div class="stat"><div class="num">${abordados}</div><div class="label">Pessoas abordadas</div></div>`}
    <div class="stat"><div class="num">${agendamentos.length}</div><div class="label">Agendamentos</div><div class="sub">${desfechoTxt}</div>${agAtrasados ? `<div class="sub" style="color:#c0392b">⚠ ${agAtrasados} com a data vencida e sem desfecho</div>` : ""}</div>
    </div>
    ${verHtml}
    ${etapasHtml}
    ${jornadaHtml}
    <div class="stat full">
      <div class="label">Ritmo da operação <small>— pessoas abordadas em cada período${d.operacao_dias ? ` · hoje é o dia ${d.operacao_dias} da operação` : ""}</small></div>
      <div class="ritmo">
        <div><b>${d.abordados_hoje||0}</b><span>Hoje</span></div>
        <div><b>${d.abordados_7d||0}</b><span>Últimos 7 dias</span></div>
        <div><b>${d.abordados_15d||0}</b><span>Últimos 15 dias</span></div>
        <div><b>${d.abordados_21d||0}</b><span>Últimos 21 dias</span></div>
        <div class="tot"><b>${abordados}</b><span>Operação inteira</span></div>
      </div>
      ${ritmoSemanalHtml}
      ${semanas.length && abordados !== acum ? `<div class="nota-dif">As semanas somam ${acum}: são as pessoas que receberam a mensagem do disparo. O funil conta ${abordados} porque inclui ${Math.abs(abordados - acum)} lead${Math.abs(abordados - acum) === 1 ? "" : "s"} que entr${Math.abs(abordados - acum) === 1 ? "ou" : "aram"} no funil sem passar pelo disparo (respondeu, recebeu a proposta ou foi agendado direto).</div>` : ""}
    </div>
    ${!tr ? "" : `
    <div class="stat full">
      <div class="label">Funil por período <small>— ${quem} · conta os leads pela data em que foram abordados</small></div>
      ${funilTabela([{ rot: "Hoje", o: fonte.hoje }, { rot: "Últimos 7 dias", o: fonte.d7 }, { rot: "Últimos 30 dias", o: fonte.d30 }, { rot: "Total", o: fonte.total, cls: "total" }])}
    </div>
    <details class="stat full dash-ops" id="dashOps" ${abrirOps ? "open" : ""}>
      <summary><span class="label">Por operador <small>— ${ops.length} operador${ops.length === 1 ? "" : "es"}${temCiclos ? ", com as contagens anteriores" : ""}${ops.length === 1 && !temCiclos ? " (mesmos números do Total acima; clique para abrir)" : ""}</small></span></summary>
      ${linhasOps.length ? funilTabela(linhasOps, extrasOps) : '<div style="color:#aaa;font-size:12px;margin-top:6px">Sem dados</div>'}
    </details>`}
  `;
  const det = $("dashOps");
  if (det) det.addEventListener("toggle", () => { _opsAberto = det.open; });
  document.querySelectorAll("#dashboard .ver-op button").forEach(b => b.addEventListener("click", () => {
    _opVisao = b.dataset.op || "";
    if (_ultimoDash) renderDashboard(_ultimoDash);
  }));

  renderCharts(d);
}
let _opVisao = "";      // "" = empresa inteira; senão, o login do operador escolhido em "Ver"
let _ultimoDash = null; // últimos dados recebidos, para redesenhar ao trocar de operador
let _opsAberto = null; // null = decide sozinho; depois do primeiro clique, respeita o operador

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
  const entrevistadores = (d.entrevistadores||[]).slice(0,8).map(e => `<li><span>${esc(e.entrevistador)}</span><span>${e.total}</span></li>`).join("") || '<li style="color:#aaa">Nenhum ainda</li>';
  const comEntrev = (d.entrevistadores||[]).reduce((s, e) => s + (Number(e.total) || 0), 0);
  const notaEntrev = agendamentos.length > comEntrev ? `<div class="nota-dif">Só conta cartão com o campo "entrevistador" preenchido: ${comEntrev} de ${agendamentos.length} agendamentos.</div>` : "";
  $("charts").innerHTML = `
    <div class="dash-sec">Agendamentos <small>em que etapa estão e quando acontecem</small></div>
    <div class="chart-card" id="chartDonutCard"></div>
    <div class="chart-card" id="chart30dCard" style="flex:2 1 480px"></div>
    <div class="chart-card" style="flex:0 1 240px;min-width:200px"><h4>Entrevistas por entrevistador</h4><ul class="lista-simples">${entrevistadores}</ul>${notaEntrev}</div>
    <div class="dash-sec">Melhores dias da semana <small>para abordar e para marcar entrevista</small></div>
    <div class="chart-card" id="chartWeekAbordCard"></div>
    <div class="chart-card" id="chartWeekCard"></div>
  `;
  renderDonutStatus(d.agendamentos_por_status || []);
  renderBar30Dias(d.ultimos_30_dias || []);
  // Só aparece depois que o banco passa a mandar esse dado (SQL DASH_1).
  if (d.abordagens_por_dia_semana) renderBarDiaSemana(d.abordagens_por_dia_semana, "chartWeekAbordCard", "Abordagens (dia em que a mensagem saiu)", "abordagem(ns)");
  else $("chartWeekAbordCard").remove();
  renderBarDiaSemana(d.por_dia_semana || [], "chartWeekCard", "Entrevistas marcadas por dia da semana (todas, inclusive canceladas)", "agendamento(s)");
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
function renderBarDiaSemana(rows, cardId, titulo, unidade) {
  const card = $(cardId);
  const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const byDow = {};
  rows.forEach(r => byDow[r.dow] = r.total);
  const data = DIAS.map((label, i) => ({ label, total: byDow[i] || 0 }));
  const max = Math.max(1, ...data.map(d => d.total));

  if (!rows.length) { card.innerHTML = '<h4>' + titulo + '</h4><div class="chart-empty">Sem dados ainda</div>'; return; }

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
    <h4>${titulo}</h4>
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1="${h-padBottom}" x2="${w}" y2="${h-padBottom}" stroke="var(--baseline)" stroke-width="1"/>
      ${bars}
    </svg>
  `;
  card.querySelectorAll(".bar-rect").forEach(bar => {
    bar.addEventListener("mousemove", (e) => showTooltip(e, `<b>${bar.dataset.label}</b><br>${bar.dataset.total} ${unidade}`));
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
  const reag = (a.vezes_reagendado > 0 ? `<span class="badge2">🔁 ${a.vezes_reagendado}x reagendado</span>` : "")
    + (String(a.status || "").toUpperCase() !== "PRESENCIAL" && passouPor(a, "PRESENCIAL") ? `<span class="badge2 presencial">🏢 agendou presencial</span>` : "");
  const atrasado = isAtrasado(a);
  const badgeAtrasado = atrasado ? `<span class="badge-atrasado">⚠️ Atrasado</span>` : "";
  const wa = waLink(a.telefone);
  const linkReuniaoUrl = normalizeUrl(a.link_reuniao);
  const meetIcon = linkReuniaoUrl
    ? `<a href="${esc(linkReuniaoUrl)}" target="_blank" class="wa-btn-sm wa-stop" title="Abrir link da reunião">🔗</a>`
    : "";
  const meetBtn = linkReuniaoUrl
    ? `<a href="${esc(linkReuniaoUrl)}" target="_blank" class="btn-participar" style="display:block;text-align:center;margin-top:6px;padding:6px;border-radius:6px;background:#0b3b6f;color:#fff;font-size:12px;font-weight:700;text-decoration:none" onclick="event.stopPropagation()">🎥 Participar da reunião</a>`
    : "";
  const obs = a.observacao
    ? `<div class="sub" style="font-style:italic">📝 ${esc(a.observacao)}</div>`
    : "";
  return `
    <div class="agcard${atrasado ? " atrasado" : ""}" draggable="true" data-id="${a.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
        <div class="nome">${esc(a.nome_candidato||"—")}</div>
        <div style="display:flex;gap:4px">${meetIcon}${wa ? `<a href="${wa}" target="_blank" class="wa-btn-sm wa-stop" title="Abrir WhatsApp">💬</a>` : ""}</div>
      </div>
      <div class="empresa-badge" style="display:inline-block;margin:2px 0;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;background:${empresaColor(a.empresa)}">${esc(a.empresa||"—")}</div>
      <div class="sub">${esc(fmtData(a.data_agendamento))}</div>
      <div class="sub">👤 ${esc(a.nome_operador||a.login||"—")}</div>
      ${meetBtn}
      ${obs}
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
  $("mObsAgendamento").textContent = a.observacao || "— nenhuma observação registrada no agendamento —";
  $("mLinkReuniao").value = a.link_reuniao || "";
  $("mMotivo").value = "";
  $("mHistorico").innerHTML = "Carregando...";
  $("editModal").classList.add("open");

  rpc("rpc_admin_historico_agendamento", { p_admin_password: ADMIN_PASS, p_id: id })
    .then(resp => {
      if (!resp.ok) { $("mHistorico").innerHTML = '<small style="color:#aaa">Sem histórico</small>'; return; }
      const h = resp.historico || [];
      $("mHistorico").innerHTML = h.length
        ? h.map(x => {
            const nome = s => { const c = COLUMNS.find(c => c.id === s); return c ? c.label : (s || "—"); };
            return `<div class="hist-item">${esc(nome(x.status_anterior))} → <b>${esc(nome(x.status_novo))}</b>${x.data_agendamento ? " · entrevista em " + esc(fmtData(x.data_agendamento)) : ""}${x.motivo ? " — " + esc(x.motivo) : ""}<br>${new Date(x.criado_em).toLocaleString("pt-BR")}${x.autor ? " · por " + esc(x.autor) : ""}</div>`;
          }).join("")
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
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday:"short" }).replace(".", "");
  const resto = d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
  return `${diaSemana}, ${resto}`;
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
    p_autor: "Admin",
    p_link_reuniao: $("mLinkReuniao").value.trim() || null
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

// Cor estável por empresa (mesmo hash simples usado no kanban da extensão),
// pra identificar rápido qual vaga é cada card ao rolar a lista.
const EMPRESA_COLORS = ['#3498db','#e74c3c','#2ecc71','#9b59b6','#f39c12','#1abc9c','#e67e22','#2980b9','#8e44ad','#16a085'];
function empresaColor(nome) {
  const s = String(nome || "—");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return EMPRESA_COLORS[Math.abs(h) % EMPRESA_COLORS.length];
}

// Se o link foi salvo sem protocolo (ex: "meet.google.com/xxx"), o navegador
// trata como caminho relativo do próprio site em vez de abrir o destino real.
function normalizeUrl(url) {
  const v = String(url || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : "https://" + v;
}

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
