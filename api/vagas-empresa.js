// Vercel Function — página de vagas de UMA empresa (link para enviar).
// /vagas/empresa/:empresa → lista só as vagas ATIVAS cujo responsavel_empresa
// corresponde ao slug. Assim cada empresa (EMCCAMP, Engelux…) tem seu próprio
// link com as vagas dela, e o candidato escolhe a região mais perto de casa.
// Mapeado em vercel.json: /vagas/empresa/:empresa → /api/vagas-empresa?empresa=:empresa

const SB   = 'https://pufxvskozfdvfscqnays.supabase.co';
const KEY  = 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj';
const BASE = 'https://www.rhimob.com.br';

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
// Mesma prévia de WhatsApp das vagas: imagens do storage passam pelo /api/og-image
// (recorte 1200x630). Sem imagem, cai no OG padrão do site.
function ogImageUrl(rawUrl){
  if (!rawUrl) return null;
  if (rawUrl.includes('supabase.co/storage/v1/object/public/')) return `${BASE}/api/og-image?url=${encodeURIComponent(rawUrl)}&c=2`;
  return rawUrl;
}
// Escolhe a imagem da empresa: a da vaga de maior prioridade que tiver imagem.
function imagemDaEmpresa(vagas){
  const comImg = vagas.filter(v => v.imagem_og || v.imagem_url)
    .sort((a,b) => (a.prioridade==null?999:a.prioridade) - (b.prioridade==null?999:b.prioridade));
  const v = comImg[0];
  return v ? (v.imagem_og || v.imagem_url) : null;
}
function slug(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

export default async function handler(req, res) {
  const alvo = slug(req.query.empresa || '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!alvo) { res.redirect(302, '/vagas'); return; }

  let vagas = [];
  try {
    const sel = 'vaga_id,titulo,localidade,cidade,estado_uf,modalidade,remuneracao,resumo,selo,categoria,responsavel_empresa,responsavel_nome,imagem_url,imagem_og,prioridade';
    const r = await fetch(`${SB}/rest/v1/site_vagas_publicas?status=eq.ATIVA&select=${sel}&order=prioridade.asc,updated_at.desc`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    const data = await r.json();
    if (Array.isArray(data)) vagas = data.filter(v => slug(v.responsavel_empresa) === alvo);
  } catch (_) {}

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');

  if (!vagas.length) {
    res.status(404).send(semVagas(req.query.empresa || ''));
    return;
  }

  const nomeEmpresa = vagas[0].responsavel_empresa || req.query.empresa;
  res.send(render(nomeEmpresa, alvo, vagas));
}

function card(v) {
  const url = `${BASE}/vaga/${v.vaga_id}`;
  const local = v.localidade || [v.cidade, v.estado_uf].filter(Boolean).join('/') || 'Consultar';
  const tags = [
    local ? `<span class="t">📍 ${esc(local)}</span>` : '',
    v.modalidade ? `<span class="t">💼 ${esc(v.modalidade)}</span>` : '',
    v.remuneracao ? `<span class="t pay">💰 ${esc(v.remuneracao)}</span>` : '',
  ].join('');
  return `<a class="card" href="${url}">
    ${v.selo ? `<span class="selo">${esc(v.selo)}</span>` : ''}
    <h3>${esc(v.titulo || 'Vaga')}</h3>
    ${v.resumo ? `<p>${esc(v.resumo)}</p>` : ''}
    <div class="tags">${tags}</div>
    <span class="go">Ver vaga e candidatar-se →</span>
  </a>`;
}

function render(nomeEmpresa, alvo, vagas) {
  // agrupa por zona/região (localidade), pra ficar fácil achar o mais perto
  const grupos = {};
  for (const v of vagas) {
    const g = (v.localidade || 'Outras regiões').split('·').pop().trim() || 'Outras regiões';
    (grupos[g] = grupos[g] || []).push(v);
  }
  const secoes = Object.keys(grupos).map(g =>
    `<section class="grp"><h2>${esc(g)}</h2><div class="grid">${grupos[g].map(card).join('')}</div></section>`
  ).join('');
  const titulo = `Vagas ${esc(nomeEmpresa)} — RH IMOB`;
  const total = vagas.length;
  const rawImg = imagemDaEmpresa(vagas);
  const ogImg = ogImageUrl(rawImg) || `${BASE}/assets/og-vaga.jpg`;

  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${titulo}</title>
<meta name="description" content="Vagas de corretor(a) de imóveis na ${esc(nomeEmpresa)}. Escolha o plantão mais perto de você e candidate-se pelo WhatsApp."/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="${BASE}/vagas/empresa/${alvo}"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<meta property="og:title" content="Vagas ${esc(nomeEmpresa)}"/>
<meta property="og:description" content="Escolha a vaga mais perto de você e candidate-se pelo WhatsApp."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${BASE}/vagas/empresa/${alvo}"/>
<meta property="og:image" content="${esc(ogImg)}"/>
<meta property="og:image:secure_url" content="${esc(ogImg)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="${esc(ogImg)}"/>
<link rel="stylesheet" href="/styles.css?v=20260713evolucao"/>
<style>
  .hero{background:linear-gradient(135deg,#1a0a30,#3b1a6b);color:#fff;padding:54px 0 40px}
  .hero .kick{color:#fb923c;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px}
  .hero h1{font-size:clamp(26px,4.5vw,42px);font-weight:900;letter-spacing:-.03em;margin:0 0 10px;max-width:800px}
  .hero p{color:rgba(255,255,255,.78);font-size:16px;margin:0;max-width:680px}
  .hero-inner{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
  .hero-txt{flex:1;min-width:280px}
  .hero-img{flex:0 0 300px;max-width:300px}
  .hero-img img{width:100%;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.35);display:block}
  @media(max-width:720px){.hero-img{flex-basis:100%;max-width:100%}}
  .wrap{max-width:1000px;margin:0 auto;padding:40px 20px 60px}
  .grp{margin-bottom:34px}
  .grp h2{font-size:18px;font-weight:900;color:#2b124d;margin:0 0 14px;display:flex;align-items:center;gap:10px}
  .grp h2::before{content:'';width:20px;height:3px;background:#ff7a1a;border-radius:3px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
  .card{display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid #e8e0ff;border-radius:16px;padding:20px;text-decoration:none;color:inherit;transition:transform .15s,box-shadow .15s;position:relative}
  .card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(43,18,77,.14);border-color:#7c3aed}
  .card .selo{position:absolute;top:14px;right:14px;background:#f0e9ff;color:#7c3aed;font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:20px}
  .card h3{font-size:16px;font-weight:800;color:#2b124d;margin:0;padding-right:70px;line-height:1.3}
  .card p{font-size:13.5px;color:#555;margin:0;line-height:1.55}
  .card .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
  .card .t{font-size:11.5px;font-weight:700;background:#faf7ff;border:1px solid #ece6fb;color:#4b3a6b;border-radius:20px;padding:4px 10px}
  .card .t.pay{background:#eafff1;border-color:#c6f0d6;color:#0a7d2c}
  .card .go{margin-top:auto;font-size:13px;font-weight:800;color:#ff7a1a}
  .back{display:inline-block;margin-top:10px;color:#c4b5fd;font-weight:700;font-size:13.5px;text-decoration:none}
</style></head><body>
<header class="site-header"><div class="container header-inner">
  <a class="brand" href="/"><img src="/assets/rhimob-logo.jpg" alt="" class="brand-mark"/><span><strong>RH IMOB</strong><small>Recrutamento imobiliário</small></span></a>
  <nav class="main-nav"><a href="/">Contratar</a><a href="/plataformas">Plataformas</a><a href="/vagas">Vagas</a><a href="/carreira">Carreira</a></nav>
  <a class="btn btn-cta btn-header" href="/vagas">Todas as vagas</a>
</div></header>
<main>
  <section class="hero"><div class="container hero-inner">
    <div class="hero-txt">
      <div class="kick">Vagas · ${esc(nomeEmpresa)}</div>
      <h1>Seja corretor(a) nos empreendimentos da ${esc(nomeEmpresa)}</h1>
      <p>${total} oportunidade${total>1?'s':''} abertas em São Paulo. Escolha o plantão mais perto de você e candidate-se pelo WhatsApp — a proposta é a mesma em todas.</p>
    </div>
    ${rawImg ? `<div class="hero-img"><img src="${esc(rawImg)}" alt="${esc(nomeEmpresa)}" loading="eager"/></div>` : ''}
  </div></section>
  <div class="wrap">
    ${secoes}
    <a class="back" href="/vagas" style="color:#7c3aed">← Ver todas as vagas da RH IMOB</a>
  </div>
</main>
<footer class="site-footer"><div class="container footer-bottom">
  <span>© 2026 RH IMOB · Recrutamento imobiliário especializado</span>
  <a href="/politica.html">Política de privacidade</a>
</div></footer>
</body></html>`;
}

function semVagas(nome) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sem vagas abertas | RH IMOB</title><meta name="robots" content="noindex"/>
<link rel="stylesheet" href="/styles.css?v=20260713evolucao"/>
<style>body{display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;font-family:Inter,sans-serif;background:#faf8ff}
.nf{max-width:440px;padding:40px}.nf h1{font-size:24px;color:#2b124d;margin:0 0 12px}.nf p{color:#6f6283;margin:0 0 24px}
.nf a{display:inline-block;background:#2b124d;color:#fff;padding:13px 26px;border-radius:12px;text-decoration:none;font-weight:700}</style>
</head><body><div class="nf"><h1>Nenhuma vaga aberta${nome?` para ${esc(nome)}`:''}</h1><p>No momento não há vagas ativas aqui. Veja todas as oportunidades abertas.</p><a href="/vagas">Ver vagas abertas →</a></div></body></html>`;
}
