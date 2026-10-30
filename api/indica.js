// Vercel Function — página de indicação de negócio de cada corretor da rede
// vercel.json: /indica/:cidade/:nome → /api/indica?cidade=:cidade&nome=:nome
//
// GET: a página apresenta as soluções da RH IMOB "indicado por <corretor>".
// POST { c, n, nome, empresa, whatsapp, plano }: o formulário. Grava a
// indicação no Coletor (SQL INDICA_1), avisa o corretor no painel e no
// celular; a página então abre o WhatsApp do corretor com os dados.
// Sem formulário preenchido não há botão de WhatsApp: é o que garante o
// controle de quem indicou.
import { cors, send, lerCorpo, COLETOR } from './_ext-comum.js';
import { enviarPendentes } from './_push.js';

const BASE = 'https://www.rhimob.com.br';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Valor dentro do <script> da página: JSON sem deixar fechar a tag.
const js = v => JSON.stringify(v).replace(/</g, '\\u003c');
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
const limpa = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

const rpc = (nome, corpo) => fetch(`${COLETOR.url}/rest/v1/rpc/${nome}`, {
  method: 'POST',
  headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo)
}).then(r => r.json()).catch(() => null);

// Soluções e preços: os mesmos das páginas da extensão, das plataformas e da operação.
const SOLUCOES = [
  { id: 'Extensão Recrutadora', icone: '🧩', titulo: 'Extensão Recrutadora',
    texto: 'Uma extensão de Chrome que coleta candidatos, organiza tudo num painel Kanban e faz a primeira abordagem pelo WhatsApp, o dia inteiro, sozinha.',
    preco: '2 logins por R$ 999/mês · R$ 799/mês no plano anual' },
  { id: 'Plataformas de profissionais', icone: '🏠', titulo: 'Plataformas Corretores e Novos Talentos',
    texto: 'Acesso ao banco de corretores com CRECI ativo e ao banco de novos talentos, com filtro por cidade e perfil, funil e mensagens prontas.',
    preco: 'Novos Talentos a partir de R$ 249/mês · Corretores a partir de R$ 499/mês' },
  { id: 'Operação RH IMOB', icone: '🤝', titulo: 'Operação RH IMOB',
    texto: 'A equipe da RH IMOB faz a abordagem e a triagem por você e entrega os candidatos em entrevista online.',
    preco: 'A partir de R$ 1.999/mês' }
];

function naoEncontrado() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link não encontrado | RH IMOB</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f4fb;color:#2b124d;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}a{color:#6d28d9;font-weight:700}</style></head>
<body><div><h1 style="font-size:22px">Este link de indicação não está disponível</h1><p><a href="${BASE}/">Conhecer a RH IMOB</a></p></div></body></html>`;
}

function render(k, cidade, nome) {
  const primeiro = esc(String(k.nome || '').trim().split(/\s+/)[0]);
  const url = `${BASE}/indica/${cidade}/${nome}`;
  const foto = /^https:\/\//i.test(k.foto_url || '') ? k.foto_url : '';
  const titulo = `Soluções de RH para o mercado imobiliário · indicação de ${k.nome}`;
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} | RH IMOB</title>
<meta name="robots" content="noindex, follow">
<meta name="description" content="Recrutamento de corretores, ferramentas e bancos de profissionais para imobiliárias e construtoras. Indicação de ${esc(k.nome)}.">
<meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="Recrutamento, ferramentas e bancos de profissionais para imobiliárias e construtoras.">
<meta property="og:image" content="${BASE}/assets/og-rhimob.jpg?v=20260524">
<link rel="icon" href="/favicon.ico">
<style>
  :root{--roxo:#33165f;--roxo2:#5b2a9e;--lar:#ff7a1a;--txt:#24123f;--muted:#6b6280;--bg:#f7f4fb;--line:#e6def2}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--txt);background:var(--bg);line-height:1.55}
  .wrap{max-width:860px;margin:0 auto;padding:0 16px}
  header{background:var(--roxo);color:#fff}
  .topo{display:flex;align-items:center;gap:10px;padding:14px 0}
  .topo img{width:36px;height:36px;border-radius:50%}
  .topo b{font-size:16px}
  .hero{background:linear-gradient(160deg,var(--roxo),var(--roxo2));color:#fff;padding:28px 0 36px}
  .por{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.12);border-radius:999px;padding:6px 14px 6px 6px;font-size:14px}
  .por img,.por .ini{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#fff;color:var(--roxo);display:grid;place-items:center;font-weight:800}
  h1{font-size:30px;line-height:1.2;margin:16px 0 8px}
  .hero p{margin:0;opacity:.9;font-size:16px;max-width:640px}
  .btn{display:inline-block;border:0;border-radius:12px;padding:13px 20px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;text-decoration:none}
  .btn-lar{background:var(--lar);color:#fff}
  .hero .btn{margin-top:18px}
  h2{font-size:22px;margin:30px 0 4px;color:var(--roxo)}
  .sub{color:var(--muted);margin:0 0 14px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
  .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column}
  .card .ic{font-size:28px}
  .card h3{margin:6px 0;font-size:17px;color:var(--roxo)}
  .card p{margin:0 0 10px;font-size:14px;color:#3f3556;flex:1}
  .card .preco{font-size:13px;font-weight:700;color:#11692f;margin-bottom:12px}
  .card button{background:#fff;border:2px solid var(--roxo);color:var(--roxo);border-radius:10px;padding:9px;font:inherit;font-weight:800;cursor:pointer}
  .card button.on{background:var(--roxo);color:#fff}
  form{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;margin:14px 0 30px}
  label{display:block;font-weight:700;font-size:14px;margin:12px 0 4px}
  input,select{width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:#fff}
  form .btn{width:100%;margin-top:16px;background:#25D366;color:#fff}
  .nota{font-size:12px;color:var(--muted);margin-top:10px}
  .erro{color:#b91c1c;font-weight:700;font-size:14px;margin-top:10px;min-height:1em}
  footer{text-align:center;color:var(--muted);font-size:13px;padding:10px 0 30px}
  footer a{color:var(--roxo2)}
</style>
</head>
<body>
<header><div class="wrap topo"><img src="/assets/rhimob-logo.jpg" alt="RH IMOB"><b>RH IMOB</b></div></header>
<section class="hero"><div class="wrap">
  <div class="por">${foto ? `<img src="${esc(foto)}" alt="">` : `<span class="ini">${primeiro.slice(0, 1)}</span>`}<span>Indicação de <b>${esc(k.nome)}</b>${k.cidade ? ' · ' + esc(k.cidade) : ''}</span></div>
  <h1>Recrutamento e ferramentas de RH para imobiliárias e construtoras</h1>
  <p>A RH IMOB é especializada no mercado imobiliário: encontra corretores e novos talentos para a sua equipe, com ferramenta própria ou com a nossa equipe fazendo por você.</p>
  <a class="btn btn-lar" href="#contato">Quero conhecer</a>
</div></section>
<main class="wrap">
  <h2>Soluções</h2>
  <p class="sub">Escolha o que faz sentido para a sua operação. A gente explica tudo numa conversa rápida.</p>
  <div class="cards">
    ${SOLUCOES.map(s => `<div class="card"><div class="ic">${s.icone}</div><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p><div class="preco">${esc(s.preco)}</div><button type="button" data-plano="${esc(s.id)}">Tenho interesse</button></div>`).join('')}
  </div>

  <h2 id="contato">Fale com ${primeiro}</h2>
  <p class="sub">Preencha e o WhatsApp abre com os seus dados para ${primeiro} marcar a conversa com a RH IMOB.</p>
  <form id="f" novalidate>
    <label for="fNome">Seu nome</label><input id="fNome" autocomplete="name" maxlength="80" required>
    <label for="fEmp">Empresa</label><input id="fEmp" autocomplete="organization" maxlength="120" placeholder="Imobiliária, construtora…">
    <label for="fWpp">Seu WhatsApp</label><input id="fWpp" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(11) 99999-9999" required>
    <label for="fPlano">Interesse</label>
    <select id="fPlano"><option value="">Ainda não sei, quero entender</option>${SOLUCOES.map(s => `<option>${esc(s.id)}</option>`).join('')}</select>
    <button class="btn" type="submit" id="fBtn">💬 Falar com ${primeiro} no WhatsApp</button>
    <div class="erro" id="fErro"></div>
    <div class="nota">Seus dados vão para ${primeiro} e para a RH IMOB, só para este contato.</div>
  </form>
</main>
<footer>RH IMOB · <a href="${BASE}/">rhimob.com.br</a></footer>
<script>
(function(){
  var C = ${js(cidade)}, N = ${js(nome)}, TEL = ${js(String(k.telefone || '').replace(/\D/g, ''))}, PRIMEIRO = ${js(String(k.nome || '').trim().split(/\s+/)[0])};
  var $ = function(id){ return document.getElementById(id); };
  document.querySelectorAll('[data-plano]').forEach(function(b){
    b.addEventListener('click', function(){
      $('fPlano').value = b.getAttribute('data-plano');
      document.querySelectorAll('[data-plano]').forEach(function(x){ x.classList.toggle('on', x === b); });
      $('contato').scrollIntoView({ behavior: 'smooth' });
      setTimeout(function(){ $('fNome').focus({ preventScroll: true }); }, 500);
    });
  });
  $('fWpp').addEventListener('input', function(){
    var d = this.value.replace(/\\D/g, '').slice(0, 11);
    this.value = d.length > 6 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(-4) : d.length > 2 ? '(' + d.slice(0, 2) + ') ' + d.slice(2) : d;
  });
  $('f').addEventListener('submit', function(e){
    e.preventDefault();
    var nome = $('fNome').value.trim(), emp = $('fEmp').value.trim(), wpp = $('fWpp').value.trim(), plano = $('fPlano').value;
    var dig = wpp.replace(/\\D/g, '');
    if (!nome) { $('fErro').textContent = 'Preencha o seu nome.'; $('fNome').focus(); return; }
    if (dig.length < 10) { $('fErro').textContent = 'Preencha o seu WhatsApp com DDD.'; $('fWpp').focus(); return; }
    $('fErro').textContent = '';
    var btn = $('fBtn'); btn.disabled = true; btn.textContent = 'Abrindo o WhatsApp…';
    var msg = 'Olá, ' + PRIMEIRO + '! Vim pela sua indicação e quero conhecer as soluções de RH da RH IMOB.\\n\\n' +
      'Nome: ' + nome + (emp ? '\\nEmpresa: ' + emp : '') + '\\nWhatsApp: ' + wpp + (plano ? '\\nInteresse: ' + plano : '');
    var ir = function(){ location.href = 'https://api.whatsapp.com/send?phone=' + TEL + '&text=' + encodeURIComponent(msg); };
    var feito = false, segue = function(){ if (!feito) { feito = true; ir(); } };
    fetch('/api/indica', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: C, n: N, nome: nome, empresa: emp, whatsapp: wpp, plano: plano }) })
      .then(segue, segue);
    setTimeout(segue, 2500);
    if (window.gtag) gtag('event', 'indica_lead', { corretor: N });
  });
})();
</script>
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method === 'POST' || req.method === 'OPTIONS') {
    if (cors(req, res)) return;
    const b = await lerCorpo(req);
    const c = slug(b.c), n = slug(b.n);
    if (!c || !n) return send(res, 400, { ok: false });
    const r = await rpc('rpc_indica_registrar', {
      p_cidade: c, p_nome: n, p_lead_nome: limpa(b.nome, 80), p_empresa: limpa(b.empresa, 120),
      p_whatsapp: limpa(b.whatsapp, 20), p_plano: limpa(b.plano, 80) || null
    });
    if (r && r.ok) await enviarPendentes().catch(() => {});
    return send(res, 200, { ok: !!(r && r.ok) });
  }

  const cidade = slug(req.query.cidade), nome = slug(req.query.nome);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!cidade || !nome) { res.status(404).send(naoEncontrado()); return; }
  const d = await rpc('rpc_indica_publico', { p_cidade: cidade, p_nome: nome });
  if (!d || !d.ok || !d.corretor) { res.setHeader('Cache-Control', 'no-store'); res.status(404).send(naoEncontrado()); return; }
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
  res.status(200).send(render(d.corretor, cidade, nome));
}
