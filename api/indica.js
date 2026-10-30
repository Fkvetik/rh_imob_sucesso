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

// Soluções, números e preços: os mesmos das páginas da extensão
// (/extensao-recrutadora), das plataformas (/plataformas) e da operação.
const SOLUCOES = [
  { id: 'Extensão Recrutadora', icone: '🧩', titulo: 'Extensão Recrutadora', selo: 'Comece por aqui',
    texto: 'Para quem tem equipe de recrutamento e quer ganhar tempo.',
    itens: ['Coleta candidatos sozinha a partir do seu filtro', 'Painel Kanban com o histórico de cada um', 'Primeira mensagem no WhatsApp, o dia inteiro, com intervalo seguro'],
    preco: 'R$ 999', per: '/mês · 2 logins', obs: 'R$ 799/mês no plano anual · sem fidelidade no mensal' },
  { id: 'Plataformas de profissionais', icone: '🏠', titulo: 'Plataformas Corretores e Novos Talentos',
    texto: 'Para quem quer uma lista qualificada para abordar.',
    itens: ['80 mil+ corretores com CRECI ativo', '90 mil+ novos talentos em 180+ cidades', 'Filtro por cidade e perfil, funil e mensagens prontas'],
    preco: 'R$ 249', per: '/mês', obs: 'Novos Talentos a partir de R$ 249 · Corretores a partir de R$ 499 · sem fidelidade' },
  { id: 'Operação RH IMOB', icone: '🤝', titulo: 'Operação RH IMOB',
    texto: 'Para quem quer que alguém faça tudo.',
    itens: ['A equipe da RH IMOB faz a abordagem', 'Triagem dos interessados', 'Candidatos entregues em entrevista online'],
    preco: 'R$ 1.999', per: '/mês', obs: 'a partir de' }
];

const PERGUNTAS = [
  ['Tem fidelidade?', 'Nos planos mensais, não: dá para cancelar quando quiser, sem multa. O mês já pago não é reembolsado.'],
  ['Quem instala e configura?', 'A RH IMOB instala a extensão com a sua equipe e configura os filtros de busca e as mensagens de abordagem.'],
  ['Quantos acessos vêm na extensão?', 'Todos os planos da extensão incluem 2 logins, cada recrutadora com o seu, e o gestor acompanha os números de cada uma.'],
  ['Funciona na minha cidade?', 'O banco de novos talentos cobre mais de 180 cidades. Na conversa a gente confere quantos profissionais tem na sua região.'],
  ['Preciso ter Catho?', 'A extensão coleta candidatos da Catho com a assinatura da sua empresa. Se ainda não tiver, a RH IMOB disponibiliza o acesso à parte.']
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
  const avatar = foto ? `<img src="${esc(foto)}" alt="">` : `<span class="ini">${primeiro.slice(0, 1)}</span>`;
  const titulo = `Precisa de corretores na sua equipe? · indicação de ${k.nome}`;
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} | RH IMOB</title>
<meta name="robots" content="noindex, follow">
<meta name="description" content="A RH IMOB encontra, aborda e entrega corretores e novos talentos para imobiliárias e construtoras. Indicação de ${esc(k.nome)}.">
<meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="Recrutamento para o mercado imobiliário: ferramenta, bancos de profissionais ou a nossa equipe fazendo por você.">
<meta property="og:image" content="${BASE}/assets/og-rhimob.jpg?v=20260524">
<link rel="icon" href="/favicon.ico">
<style>
  :root{--roxo:#33165f;--roxo2:#5b2a9e;--lar:#ff7a1a;--txt:#24123f;--muted:#6b6280;--bg:#f7f4fb;--line:#e6def2;--verde:#11692f}
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--txt);background:var(--bg);line-height:1.55;padding-bottom:76px}
  img{max-width:100%;display:block}
  .wrap{max-width:1000px;margin:0 auto;padding:0 16px}
  header{background:var(--roxo);color:#fff}
  .topo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px}
  .marca{display:flex;align-items:center;gap:10px;font-weight:800}
  .marca img{width:34px;height:34px;border-radius:50%}
  .topo a.cta-mini{color:#fff;font-weight:800;font-size:14px;text-decoration:none;border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:6px 12px}
  .hero{background:radial-gradient(circle at 85% 10%,rgba(255,122,26,.25),transparent 45%),linear-gradient(160deg,var(--roxo),var(--roxo2));color:#fff;padding:30px 0 40px}
  .por{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.13);border-radius:999px;padding:6px 16px 6px 6px;font-size:14px}
  .por img,.por .ini{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#fff;color:var(--roxo);display:grid;place-items:center;font-weight:800}
  h1{font-size:clamp(28px,6vw,44px);line-height:1.12;margin:18px 0 12px;max-width:760px}
  h1 em{font-style:normal;color:var(--lar)}
  .hero p{margin:0;opacity:.92;font-size:17px;max-width:640px}
  .btn{display:inline-block;border:0;border-radius:12px;padding:14px 22px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;text-decoration:none}
  .btn-lar{background:var(--lar);color:#fff;box-shadow:0 8px 20px rgba(255,122,26,.35)}
  .hero .btn{margin-top:22px}
  .numeros{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:28px;max-width:640px}
  .numeros div{background:rgba(255,255,255,.1);border-radius:14px;padding:12px}
  .numeros b{display:block;font-size:clamp(20px,5vw,28px);line-height:1.1}
  .numeros span{font-size:12.5px;opacity:.85}
  section.bloco{padding:34px 0 6px}
  h2{font-size:clamp(22px,4.5vw,30px);line-height:1.2;margin:0 0 6px;color:var(--roxo)}
  .sub{color:var(--muted);margin:0 0 18px;font-size:16px}
  .dor{background:#fff;border:1px solid var(--line);border-left:5px solid var(--lar);border-radius:14px;padding:16px 18px;font-size:16px}
  .dor b{color:var(--roxo)}
  .telas{display:grid;grid-template-columns:1fr 1.2fr;gap:16px;align-items:start}
  .tela{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px;margin:0}
  .tela img{border-radius:10px;margin:0 auto}
  .tela.bolha img{max-height:520px;width:auto}
  .tela figcaption{font-size:14px;color:#3f3556;margin-top:10px}
  .tela figcaption b{color:var(--roxo)}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;display:flex;flex-direction:column;position:relative}
  .card.dest{border:2px solid var(--lar);box-shadow:0 12px 30px rgba(51,22,95,.12)}
  .selo{position:absolute;top:-11px;left:18px;background:var(--lar);color:#fff;font-size:12px;font-weight:800;border-radius:999px;padding:3px 10px}
  .card .ic{font-size:30px}
  .card h3{margin:6px 0 2px;font-size:18px;color:var(--roxo)}
  .card .para{font-size:14px;color:var(--muted);margin:0 0 10px}
  .card ul{list-style:none;padding:0;margin:0 0 14px;flex:1}
  .card li{font-size:14.5px;padding:4px 0 4px 24px;position:relative}
  .card li:before{content:"✓";position:absolute;left:0;color:var(--verde);font-weight:900}
  .preco{font-size:13px;color:var(--muted)}
  .preco b{font-size:26px;color:var(--txt)}
  .preco small{display:block;font-size:12px;margin:2px 0 12px}
  .card button{background:#fff;border:2px solid var(--roxo);color:var(--roxo);border-radius:10px;padding:11px;font:inherit;font-weight:800;cursor:pointer}
  .card.dest button,.card button.on{background:var(--roxo);color:#fff}
  .passos{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;counter-reset:p}
  .passo{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px}
  .passo:before{counter-increment:p;content:counter(p);display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--lar);color:#fff;font-weight:900;margin-bottom:8px}
  .passo b{display:block;color:var(--roxo);margin-bottom:2px}
  .passo span{font-size:14.5px;color:#3f3556}
  details{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:8px}
  summary{font-weight:800;cursor:pointer;color:var(--roxo)}
  details p{margin:8px 0 0;font-size:15px;color:#3f3556}
  .contato{display:grid;grid-template-columns:1fr 1.1fr;gap:20px;align-items:start}
  .quem{background:linear-gradient(160deg,var(--roxo),var(--roxo2));color:#fff;border-radius:18px;padding:22px}
  .quem .ft{width:72px;height:72px;border-radius:50%;overflow:hidden;background:#fff;color:var(--roxo);display:grid;place-items:center;font-size:30px;font-weight:900;margin-bottom:12px}
  .quem .ft img{width:100%;height:100%;object-fit:cover}
  .quem h3{margin:0 0 4px;font-size:20px}
  .quem p{margin:0;opacity:.9;font-size:15px}
  form{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px}
  label{display:block;font-weight:700;font-size:14px;margin:12px 0 4px}
  label:first-child{margin-top:0}
  input,select{width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:#fff}
  form .btn{width:100%;margin-top:16px;background:#25D366;color:#fff}
  .nota{font-size:12px;color:var(--muted);margin-top:10px}
  .erro{color:#b91c1c;font-weight:700;font-size:14px;margin-top:10px;min-height:1em}
  .fixo{position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid var(--line);display:flex;justify-content:center;z-index:5;transition:transform .2s}
  .fixo a{width:100%;max-width:480px;text-align:center;background:#25D366;color:#fff}
  .fixo.some{transform:translateY(110%)}
  footer{text-align:center;color:var(--muted);font-size:13px;padding:26px 0 10px}
  footer a{color:var(--roxo2)}
  @media (max-width:760px){
    .telas,.cards,.passos,.contato{grid-template-columns:1fr}
    .card.dest{order:-1}
    .tela.bolha img{max-height:460px}
  }
</style>
</head>
<body>
<header><div class="wrap topo"><span class="marca"><img src="/assets/rhimob-logo.jpg" alt="">RH IMOB</span><a class="cta-mini" href="#contato">Falar com ${primeiro}</a></div></header>

<section class="hero"><div class="wrap">
  <div class="por">${avatar}<span>Indicação de <b>${esc(k.nome)}</b>${k.cidade ? ' · ' + esc(k.cidade) : ''}</span></div>
  <h1>Precisa de corretores na sua equipe? <em>A gente encontra, aborda e entrega.</em></h1>
  <p>A RH IMOB é especializada em recrutamento para o mercado imobiliário. Você escolhe: usa a nossa ferramenta, acessa os nossos bancos de profissionais ou deixa a nossa equipe fazer por você.</p>
  <a class="btn btn-lar" href="#contato">Quero conhecer</a>
  <div class="numeros">
    <div><b>80 mil+</b><span>corretores com CRECI mapeados</span></div>
    <div><b>90 mil+</b><span>novos talentos</span></div>
    <div><b>180+</b><span>cidades na base</span></div>
  </div>
</div></section>

<main class="wrap">
  <section class="bloco">
    <div class="dor">Recrutar corretor toma o dia inteiro: procurar currículo, mandar mensagem um por um, cobrar resposta, marcar entrevista… <b>A RH IMOB automatiza essa parte, ou faz ela inteira por você.</b></div>
  </section>

  <section class="bloco">
    <h2>Veja funcionando</h2>
    <p class="sub">Telas reais da ferramenta que a sua equipe usa.</p>
    <div class="telas">
      <figure class="tela bolha"><img src="/assets/extensao-bolha-whatsapp.png" alt="Bolha da RH IMOB ao lado de uma conversa no WhatsApp" loading="lazy" width="844" height="1800">
        <figcaption><b>A bolha no WhatsApp.</b> Ao lado de cada conversa: quem é o contato, a etapa do funil, respostas prontas e agendamento da entrevista, em um clique. (Contato de exemplo.)</figcaption></figure>
      <figure class="tela"><img src="/assets/extensao-kanban-crm.jpg" alt="Painel Kanban com os candidatos por etapa" loading="lazy" width="1200" height="1200">
        <figcaption><b>O painel Kanban.</b> Cada candidato numa etapa (novo, contatado, agendado), com o histórico de tudo. O gestor acompanha os números de cada recrutadora.</figcaption></figure>
    </div>
  </section>

  <section class="bloco">
    <h2>Escolha como quer contratar</h2>
    <p class="sub">Três jeitos de resolver. Na conversa, ${primeiro} e a RH IMOB te ajudam a escolher.</p>
    <div class="cards">
      ${SOLUCOES.map((s, i) => `<div class="card${i === 0 ? ' dest' : ''}">${s.selo ? `<span class="selo">${esc(s.selo)}</span>` : ''}<div class="ic">${s.icone}</div><h3>${esc(s.titulo)}</h3><p class="para">${esc(s.texto)}</p>
        <ul>${s.itens.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="preco">${s.obs === 'a partir de' ? 'a partir de ' : ''}<b>${esc(s.preco)}</b>${esc(s.per)}<small>${s.obs === 'a partir de' ? '&nbsp;' : esc(s.obs)}</small></div>
        <button type="button" data-plano="${esc(s.id)}">Tenho interesse</button></div>`).join('')}
    </div>
  </section>

  <section class="bloco">
    <h2>Como funciona</h2>
    <p class="sub">Do primeiro contato aos candidatos chegando.</p>
    <div class="passos">
      <div class="passo"><b>Você fala com ${primeiro}</b><span>Conta como recruta hoje e o que precisa. A conversa com a RH IMOB é marcada junto.</span></div>
      <div class="passo"><b>A RH IMOB configura</b><span>Instala e configura com a sua equipe: filtros, região e mensagens de abordagem.</span></div>
      <div class="passo"><b>Os candidatos chegam</b><span>A sua equipe só entra na hora de conversar com quem já demonstrou interesse.</span></div>
    </div>
  </section>

  <section class="bloco">
    <h2>Perguntas rápidas</h2>
    <p class="sub">&nbsp;</p>
    ${PERGUNTAS.map(([p, r]) => `<details><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('')}
  </section>

  <section class="bloco" id="contato">
    <div class="contato">
      <div class="quem">
        <div class="ft">${foto ? `<img src="${esc(foto)}" alt="">` : primeiro.slice(0, 1)}</div>
        <h3>Fale com ${primeiro}</h3>
        <p>${esc(k.nome)} faz parte da Rede de Parceiros da RH IMOB${k.cidade ? ' em ' + esc(k.cidade) : ''}. Preencha e o WhatsApp abre com os seus dados para marcar a conversa.</p>
      </div>
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
    </div>
  </section>
</main>
<footer>RH IMOB · Recrutamento imobiliário · <a href="${BASE}/">rhimob.com.br</a></footer>
<div class="fixo" id="fixo"><a class="btn" href="#contato">💬 Falar com ${primeiro}</a></div>
<script>
(function(){
  var C = ${js(cidade)}, N = ${js(nome)}, TEL = ${js(String(k.telefone || '').replace(/\D/g, ''))}, PRIMEIRO = ${js(String(k.nome || '').trim().split(/\s+/)[0])};
  var $ = function(id){ return document.getElementById(id); };
  // O botão fixo some quando o formulário está na tela.
  if (window.IntersectionObserver) new IntersectionObserver(function(e){ $('fixo').classList.toggle('some', e[0].isIntersecting); }).observe($('contato'));
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
