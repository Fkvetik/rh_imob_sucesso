// Vercel Function — site da construtora parceira (rede de vendas RH IMOB)
// vercel.json: /parceiro/:slug → /api/parceiro-site?slug=:slug
// Dados: rede_parceiros + rede_imoveis no Coletor (SQL REDE_3), via rpc_parceiro_publico.
// Aqui o contato é da própria construtora: WhatsApp da empresa no topo e o do
// responsável em cada empreendimento. (Nos sites dos corretores, é o do corretor.)
import { COLETOR } from './_ext-comum.js';

const BASE = 'https://www.rhimob.com.br';
const RH_WA = '5511953973268'; // RH IMOB (Fernando): quem quer ser parceiro fala aqui

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function urlOk(u) { return /^https:\/\//i.test(String(u || '')) ? u : ''; }
const WA_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12 0C5.37 0 0 5.37 0 12c0 2.12.56 4.12 1.53 5.85L.06 23.93l6.24-1.64A11.94 11.94 0 0012 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg>';
const FINALIDADE = { VENDA: 'Venda', LOCACAO: 'Locação' };
const TIPO_IMOVEL = { APARTAMENTO: 'Apartamento', CASA: 'Casa', SOBRADO: 'Sobrado', COBERTURA: 'Cobertura', TERRENO: 'Terreno',
  SALA: 'Sala comercial', LOJA: 'Loja', GALPAO: 'Galpão', CHACARA: 'Chácara', OUTRO: 'Imóvel' };
const ZONA = { NORTE: 'Zona Norte', SUL: 'Zona Sul', LESTE: 'Zona Leste', OESTE: 'Zona Oeste', CENTRO: 'Centro' };

function naoEncontrado() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada | RH IMOB</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f4fb;color:#2b124d;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}a{color:#6d28d9;font-weight:700}</style></head>
<body><div><h1 style="font-size:22px">Esta página não está disponível</h1><p><a href="${BASE}/">Conhecer a RH IMOB</a></p></div></body></html>`;
}

function render(p, itens, url) {
  const waEmpresa = String(p.whatsapp || (itens.find(i => i.wa) || {}).wa || '').replace(/\D/g, '');
  const cidades = [...new Set(itens.map(i => i.cidade))];
  const titulo = `${p.nome} — lançamentos${cidades.length ? ' em ' + (cidades.length > 2 ? cidades.slice(0, 2).join(', ') + ' e região' : cidades.join(' e ')) : ''}`;
  const desc = (p.sobre ? String(p.sobre).replace(/\s+/g, ' ') + ' ' : '') + `Empreendimentos da ${p.nome} na rede de vendas RH IMOB.`;
  const capa = urlOk(p.capa_url), logo = urlOk(p.logo_url);
  const ogImg = capa || logo || (itens[0] && urlOk((itens[0].fotos || [])[0])) || '';
  const fichas = itens.map(a => {
    const specs = [a.dorm ? `${a.dorm} dorm` : '', a.suites ? `${a.suites} suíte${a.suites > 1 ? 's' : ''}` : '',
      a.vagas ? `${a.vagas} vaga${a.vagas > 1 ? 's' : ''}` : '', a.area ? `${Number(a.area).toLocaleString('pt-BR')} m²` : '', a.bairro || ''].filter(Boolean).join(' · ');
    const preco = a.preco ? 'R$ ' + Number(a.preco).toLocaleString('pt-BR') + (a.finalidade === 'LOCACAO' ? '/mês' : '') : 'Sob consulta';
    const tel = String(a.wa || waEmpresa || '').replace(/\D/g, '');
    const nomeImovel = a.titulo || TIPO_IMOVEL[a.tipo] || 'empreendimento';
    return {
      titulo: a.titulo || TIPO_IMOVEL[a.tipo] || 'Empreendimento', fin: FINALIDADE[a.finalidade] || '', tipo: TIPO_IMOVEL[a.tipo] || '', preco, specs,
      desc: a.descricao || '', local: [a.cidade, (a.zonas || []).map(z => ZONA[z]).filter(Boolean).join(', ')].filter(Boolean).join(' — '),
      wa: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Olá${a.resp ? ', ' + String(a.resp).split(' ')[0] : ''}! Vi o ${nomeImovel} no site da ${p.nome} (RH IMOB) e quero mais informações.`)}` : '',
      rid: a.id
    };
  });
  const dados = JSON.stringify(itens.map((a, k) => ({ t: fichas[k].titulo, f: (a.fotos || []).filter(urlOk), l: Array.isArray(a.legendas) ? a.legendas : [],
    fin: fichas[k].fin, tipo: fichas[k].tipo, preco: fichas[k].preco, specs: fichas[k].specs, desc: fichas[k].desc, wa: fichas[k].wa, rid: fichas[k].rid })))
    .replace(/</g, '\\u003c');
  const waTopo = waEmpresa ? `https://wa.me/${waEmpresa}?text=${encodeURIComponent(`Olá! Vi o site da ${p.nome} na RH IMOB e quero conhecer os empreendimentos.`)}` : '';
  // Em cada cidade, se houver empreendimentos com zona, o visitante filtra por região.
  // Sem zona = cidade toda: aparece em qualquer região.
  const filtrosDe = (c) => {
    const zs = Object.keys(ZONA).filter(z => itens.some(a => a.cidade === c && (a.zonas || []).includes(z)));
    return zs.length ? `<div class="filtros" role="group" aria-label="Filtrar por região"><button type="button" class="on" data-f="">Todas</button>${zs.map(z => `<button type="button" data-f="${z}">${ZONA[z]}</button>`).join('')}</div>` : '';
  };
  const porCidade = cidades.map(c => `
  <section><h2>📍 ${esc(c)}</h2>${filtrosDe(c)}<div class="albuns">${itens.map((a, i) => a.cidade !== c ? '' : `
    <button class="album rd" type="button" data-album="${i}" data-zonas="${esc((a.zonas || []).join(' '))}">
      <div class="img"><img src="${esc((a.fotos || [])[0])}" alt="${esc(fichas[i].titulo)}" loading="lazy">${fichas[i].fin ? `<span class="fin">${esc(fichas[i].fin)}</span>` : ''}</div>
      <div class="info"><span class="preco">${esc(fichas[i].preco)}</span><strong>${esc(fichas[i].titulo)}</strong>
        ${fichas[i].specs ? `<span class="specs">${esc(fichas[i].specs)}</span>` : ''}
        <small>${esc(fichas[i].local)}</small></div>
    </button>`).join('')}</div><div class="vazio rdVazio" style="display:none">Nenhum empreendimento nesta região por enquanto.</div></section>`).join('');
  const iniciais = String(p.nome || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  const ld = { '@context': 'https://schema.org', '@type': 'Organization', name: p.nome, url, description: desc.slice(0, 300),
    ...(waEmpresa ? { telephone: '+' + waEmpresa } : {}), ...(logo || ogImg ? { logo: logo || ogImg } : {}),
    areaServed: cidades.map(c => ({ '@type': 'City', name: c })) };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc.slice(0, 160))}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc.slice(0, 200))}">
${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">` : ''}
<meta name="theme-color" content="#2b124d">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>
  :root{--roxo:#2b124d;--roxo2:#5b21b6;--lilas:#f4eefb;--txt:#1f1530;--muted:#6b5e7e;--line:#e9e1f3;--bg:#fbf9fd}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--txt);background:var(--bg);line-height:1.55}
  header.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:#fff;border-bottom:1px solid var(--line)}
  .marca{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit}
  .marca img{width:34px;height:34px;border-radius:50%}
  .marca span{font-size:12px;color:var(--muted);line-height:1.2}
  .marca strong{display:block;color:var(--roxo);font-size:14px}
  .selo{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--roxo2);background:var(--lilas);border-radius:999px;padding:6px 10px;white-space:nowrap}
  .capa{position:relative;height:240px;overflow:hidden;background:radial-gradient(120% 140% at 100% 0%,#f97316 0%,rgba(249,115,22,0) 45%),linear-gradient(135deg,#1c0a36 0%,#3b1872 55%,#6d28d9 100%)}
  .capa img{width:100%;height:100%;object-fit:cover;display:block}
  @media(min-width:760px){.capa{height:320px}}
  .perfil{max-width:960px;margin:-56px auto 0;padding:0 18px;position:relative;z-index:1}
  .cartao{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 18px 40px -24px rgba(43,18,77,.35);display:flex;gap:18px;align-items:center;flex-wrap:wrap}
  .logo{width:92px;height:92px;border-radius:18px;flex-shrink:0;border:4px solid #fff;box-shadow:0 6px 16px rgba(43,18,77,.25);background:var(--roxo2);color:#fff;display:grid;place-items:center;font-size:28px;font-weight:800;overflow:hidden;margin-top:-48px}
  .logo img{width:100%;height:100%;object-fit:contain;background:#fff}
  .quem{flex:1;min-width:200px}
  .quem h1{margin:0;font-size:24px;line-height:1.2;color:var(--roxo)}
  .quem p{margin:4px 0 0;color:var(--muted);font-size:14px}
  .btn{display:inline-flex;align-items:center;gap:8px;border-radius:12px;padding:12px 18px;font-weight:800;font-size:15px;text-decoration:none;border:0;cursor:pointer}
  .btn svg{width:18px;height:18px}
  .btn-wa{background:#16a34a;color:#fff}
  .btn-sec{background:var(--lilas);color:var(--roxo2)}
  main{max-width:960px;margin:0 auto;padding:8px 18px 40px}
  section{margin-top:28px}
  h2{font-size:18px;color:var(--roxo);margin:0 0 12px}
  .bio{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;white-space:pre-line;color:#3a2d4d}
  .albuns{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
  .album{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;cursor:pointer;padding:0;text-align:left;font:inherit;color:inherit}
  .album:hover{box-shadow:0 12px 28px -18px rgba(43,18,77,.45)}
  .album .img{aspect-ratio:4/3;background:var(--lilas);overflow:hidden;position:relative}
  .album img{width:100%;height:100%;object-fit:cover;display:block}
  .album .fin{position:absolute;left:10px;top:10px;background:var(--roxo);color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:4px 10px}
  .album .info{padding:10px 12px}
  .album .preco{display:block;font-size:17px;font-weight:800;color:var(--roxo2);margin-bottom:2px}
  .album strong{display:block;font-size:14px}
  .album .specs{display:block;font-size:12.5px;color:#3a2d4d;margin:2px 0}
  .album small{color:var(--muted);font-size:12px}
  .filtros{display:flex;gap:8px;overflow-x:auto;padding:2px 18px 12px;margin:0 -18px;scrollbar-width:none}
  .filtros::-webkit-scrollbar{display:none}
  .filtros button{flex-shrink:0;border:1px solid var(--line);background:#fff;color:var(--roxo2);font:inherit;font-size:13px;font-weight:700;border-radius:999px;padding:8px 14px;cursor:pointer}
  .filtros button.on{background:var(--roxo2);border-color:var(--roxo2);color:#fff}
  .album.fora{display:none}
  .vazio{background:#fff;border:1px dashed var(--line);border-radius:16px;padding:22px;text-align:center;color:var(--muted)}
  footer{border-top:1px solid var(--line);background:#fff;padding:22px 18px;text-align:center}
  footer p{margin:0;font-size:12px;color:var(--muted)}
  footer p a{color:var(--roxo2);font-weight:700;text-decoration:none}
  .parceria{max-width:520px;margin:0 auto 16px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:var(--bg);display:flex;flex-direction:column;align-items:center;gap:6px}
  .parceria strong{color:var(--roxo);font-size:14px}
  .parceria span{font-size:13px;color:var(--muted)}
  .fixo{position:fixed;right:16px;bottom:16px;z-index:5;box-shadow:0 12px 28px -8px rgba(22,163,74,.6);border-radius:999px}
  @media(min-width:760px){.fixo{display:none}}
  .lb{position:fixed;inset:0;background:rgba(14,6,26,.94);display:none;flex-direction:column;z-index:20}
  .lb.aberto{display:flex}
  .lb-top{display:flex;justify-content:space-between;align-items:center;color:#fff;padding:12px 16px;font-size:14px}
  .lb-top button{background:none;border:0;color:#fff;font-size:28px;cursor:pointer;line-height:1}
  .lb-img{flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-height:0;padding:0 8px}
  .lb-img img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
  .lb-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.14);border:0;color:#fff;width:44px;height:44px;border-radius:50%;font-size:22px;cursor:pointer}
  .lb-nav.ant{left:10px}.lb-nav.prox{right:10px}
  .lb-leg{color:#fff;text-align:center;font-size:14px;padding:6px 16px 0}
  .lb-info{max-height:34vh;overflow:auto;padding:8px 16px 0;color:#fff;max-width:760px;width:100%;margin:0 auto}
  .lb-info .btn{width:100%;justify-content:center;margin:8px 0 2px}
  .lb-ficha .tags{display:flex;gap:6px;margin-bottom:6px}
  .lb-ficha .tags b{font-size:11px;background:rgba(255,255,255,.16);border-radius:999px;padding:3px 9px}
  .lb-ficha .p{font-size:20px;font-weight:800}
  .lb-ficha .s{font-size:13px;opacity:.9;margin-top:2px}
  .lb-ficha .d{font-size:13px;opacity:.85;margin-top:6px;white-space:pre-line}
  .lb-thumbs{display:flex;gap:6px;overflow-x:auto;padding:10px 12px 14px}
  .lb-thumbs img{width:64px;height:48px;object-fit:cover;border-radius:6px;opacity:.55;cursor:pointer;flex-shrink:0}
  .lb-thumbs img.on{opacity:1;outline:2px solid #fff}
</style>
</head>
<body>
<header class="top">
  <a class="marca" href="${BASE}/" target="_blank" rel="noopener"><img src="/assets/rhimob-logo.jpg" alt="RH IMOB"><span><strong>RH IMOB</strong>Rede de vendas</span></a>
  <span class="selo">Construtora parceira</span>
</header>
<div class="capa">${capa ? `<img src="${esc(capa)}" alt="">` : ''}</div>
<div class="perfil"><div class="cartao">
  <div class="logo">${logo ? `<img src="${esc(logo)}" alt="${esc(p.nome)}">` : esc(iniciais)}</div>
  <div class="quem"><h1>${esc(p.nome)}</h1><p>${itens.length} empreendimento${itens.length === 1 ? '' : 's'}${cidades.length ? ' · ' + esc(cidades.join(', ')) : ''}</p></div>
  ${waTopo ? `<a class="btn btn-wa" data-onde="PERFIL" href="${esc(waTopo)}" target="_blank" rel="noopener">${WA_SVG} Fale com a ${esc(p.nome)}</a>` : ''}
</div></div>
<main>
  ${p.sobre ? `<section><h2>Sobre</h2><div class="bio">${esc(p.sobre)}</div></section>` : ''}
  ${porCidade || '<section><div class="vazio">Em breve, os empreendimentos aparecem aqui.</div></section>'}
</main>
<footer>
  <div class="parceria"><strong>É construtora ou incorporadora?</strong><span>Coloque seus lançamentos na rede de corretores parceiros da RH IMOB.</span>
    <a class="btn btn-sec" href="https://wa.me/${RH_WA}?text=${encodeURIComponent('Olá! Vi o site de uma construtora parceira na RH IMOB e quero colocar meus lançamentos na rede.')}" target="_blank" rel="noopener">${WA_SVG} Quero ser parceiro</a></div>
  <p>Site em parceria com a <a href="${BASE}/" target="_blank" rel="noopener">RH IMOB</a> · tecnologia para conectar o mercado imobiliário</p>
</footer>
${waTopo ? `<a class="btn btn-wa fixo" data-onde="PERFIL" href="${esc(waTopo)}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">${WA_SVG} WhatsApp</a>` : ''}
<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Fotos do empreendimento">
  <div class="lb-top"><span id="lbTitulo"></span><button type="button" id="lbFechar" aria-label="Fechar">×</button></div>
  <div class="lb-img"><button class="lb-nav ant" type="button" id="lbAnt" aria-label="Anterior">‹</button><img id="lbFoto" alt=""><button class="lb-nav prox" type="button" id="lbProx" aria-label="Próxima">›</button></div>
  <div class="lb-leg" id="lbLeg"></div>
  <div class="lb-info" id="lbInfo"></div>
  <div class="lb-thumbs" id="lbThumbs"></div>
</div>
<script>
(function(){
  var A = ${dados}, lb = document.getElementById('lb'), foto = document.getElementById('lbFoto'), thumbs = document.getElementById('lbThumbs'),
      tit = document.getElementById('lbTitulo'), leg = document.getElementById('lbLeg'), info = document.getElementById('lbInfo'), al = null, i = 0, x0 = null;
  function txt(s){ var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function mostra(n){ if(!al) return; i = (n + al.f.length) % al.f.length; foto.src = al.f[i];
    tit.textContent = (al.t || 'Empreendimento') + ' · ' + (i + 1) + '/' + al.f.length;
    leg.textContent = al.l[i] || ''; leg.style.display = al.l[i] ? '' : 'none';
    [].forEach.call(thumbs.children, function(t, k){ t.className = k === i ? 'on' : ''; }); }
  function abre(n){ al = A[n]; if(!al || !al.f.length) return; thumbs.innerHTML = '';
    var tags = [al.fin, al.tipo].filter(Boolean).map(function(t){ return '<b>' + txt(t) + '</b>'; }).join('');
    info.innerHTML = '<div class="lb-ficha">' + (tags ? '<div class="tags">' + tags + '</div>' : '') + '<div class="p">' + txt(al.preco) + '</div>' +
      (al.specs ? '<div class="s">' + txt(al.specs) + '</div>' : '') + (al.desc ? '<div class="d">' + txt(al.desc) + '</div>' : '') + '</div>' +
      (al.wa ? '<a class="btn btn-wa" target="_blank" rel="noopener" data-onde="REDE" data-rede="' + al.rid + '" href="' + al.wa + '">Tenho interesse neste empreendimento</a>' : '');
    al.f.forEach(function(u, k){ var t = document.createElement('img'); t.src = u; t.alt = ''; t.loading = 'lazy'; t.onclick = function(){ mostra(k); }; thumbs.appendChild(t); });
    lb.classList.add('aberto'); document.body.style.overflow = 'hidden'; mostra(0); }
  function fecha(){ lb.classList.remove('aberto'); document.body.style.overflow = ''; }
  document.querySelectorAll('[data-album]').forEach(function(b){ b.onclick = function(){ abre(+b.getAttribute('data-album')); }; });
  document.getElementById('lbFechar').onclick = fecha;
  document.getElementById('lbAnt').onclick = function(){ mostra(i - 1); };
  document.getElementById('lbProx').onclick = function(){ mostra(i + 1); };
  document.addEventListener('keydown', function(e){ if(!lb.classList.contains('aberto')) return;
    if(e.key === 'Escape') fecha(); if(e.key === 'ArrowLeft') mostra(i - 1); if(e.key === 'ArrowRight') mostra(i + 1); });
  foto.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; }, { passive: true });
  foto.addEventListener('touchend', function(e){ if(x0 === null) return; var d = e.changedTouches[0].clientX - x0; if(Math.abs(d) > 40) mostra(i + (d < 0 ? 1 : -1)); x0 = null; });
  // Filtro por região dentro de cada cidade (sem zona = cidade toda, aparece sempre).
  [].forEach.call(document.querySelectorAll('section'), function(sec){
    var fb = sec.querySelectorAll('.filtros [data-f]');
    [].forEach.call(fb, function(b){ b.onclick = function(){
      [].forEach.call(fb, function(x){ x.classList.toggle('on', x === b); });
      var z = b.getAttribute('data-f'), n = 0;
      [].forEach.call(sec.querySelectorAll('.rd'), function(el){
        var zs = el.getAttribute('data-zonas').split(' ').filter(Boolean), ok = !z || !zs.length || zs.indexOf(z) >= 0;
        el.classList.toggle('fora', !ok); if (ok) n++;
      });
      sec.querySelector('.rdVazio').style.display = n ? 'none' : '';
    }; });
  });
  // Cada clique no WhatsApp: conta no admin e aparece no /painel → Leads (/api/site-clique).
  var sid = ''; try { sid = sessionStorage.getItem('rh_sid') || Math.random().toString(36).slice(2, 12); sessionStorage.setItem('rh_sid', sid); } catch (e) {}
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[data-onde]'); if(!a) return;
    try { fetch('/api/site-clique', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parceiro: ${JSON.stringify(p.slug)}, onde: a.getAttribute('data-onde'), rede: a.getAttribute('data-rede') || null, sid: sid, pagina: location.href.split('?')[0] }) }).catch(function(){}); } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!slug) { res.status(404).send(naoEncontrado()); return; }
  let d = null;
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_parceiro_publico`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug })
    });
    d = await r.json();
  } catch (_) {}
  if (!d || !d.ok || !d.parceiro) { res.setHeader('Cache-Control', 'no-store'); res.status(404).send(naoEncontrado()); return; }
  const itens = (Array.isArray(d.itens) ? d.itens : []).filter(a => a && Array.isArray(a.fotos) && a.fotos.length);
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).send(render(d.parceiro, itens, `${BASE}/parceiro/${d.parceiro.slug}`));
}
