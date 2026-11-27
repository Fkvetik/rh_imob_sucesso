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
  const pageUrl = `${BASE}/vagas/empresa/${alvo}`;
  const urlEnc = encodeURIComponent(pageUrl);
  const txtEnc = encodeURIComponent(`Vagas ${nomeEmpresa} — escolha a mais perto de você`);
  const waShare = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Vagas ${nomeEmpresa} — escolha a mais perto de você e candidate-se:\n${pageUrl}`)}`;

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
  .hero h1{color:#fff;font-size:clamp(26px,4.5vw,42px);font-weight:900;letter-spacing:-.03em;margin:0 0 10px;max-width:800px}
  .hero p{color:rgba(255,255,255,.78);font-size:16px;margin:0;max-width:680px}
  .hero-inner{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
  .hero-txt{flex:1;min-width:280px}
  .hero-img{flex:0 0 300px;max-width:300px}
  .hero-img img{width:100%;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.35);display:block}
  @media(max-width:720px){.hero-img{flex-basis:100%;max-width:100%}}
  .share{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:22px}
  .share-l{color:rgba(255,255,255,.6);font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-right:2px}
  .sb{width:42px;height:42px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:none;cursor:pointer;transition:transform .18s;box-shadow:0 2px 8px rgba(0,0,0,.25)}
  .sb:hover{transform:scale(1.12)}
  .sb-wa{background:#25d366;color:#fff}.sb-fb{background:#1877f2;color:#fff}.sb-x{background:#000;color:#fff}.sb-li{background:#0077b5;color:#fff}
  .sb-copy{background:rgba(255,255,255,.16);color:#fff;border:1.5px solid rgba(255,255,255,.32)}
  .emp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2b124d;color:#fff;padding:12px 22px;border-radius:30px;font-size:14px;font-weight:700;box-shadow:0 10px 30px rgba(43,18,77,.4);opacity:0;pointer-events:none;transition:opacity .25s;z-index:999}
  .emp-toast.show{opacity:1}
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
      <div class="share">
        <span class="share-l">Compartilhar</span>
        <a class="sb sb-wa" href="${waShare}" target="_blank" rel="noopener" title="WhatsApp"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.928l6.235-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg></a>
        <a class="sb sb-fb" href="https://www.facebook.com/sharer/sharer.php?u=${urlEnc}" target="_blank" rel="noopener" title="Facebook"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
        <a class="sb sb-x" href="https://twitter.com/intent/tweet?text=${txtEnc}&url=${urlEnc}" target="_blank" rel="noopener" title="X"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
        <a class="sb sb-li" href="https://www.linkedin.com/sharing/share-offsite/?url=${urlEnc}" target="_blank" rel="noopener" title="LinkedIn"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
        <button class="sb sb-copy" onclick="copiarEmp()" title="Copiar link"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button>
      </div>
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
<div class="emp-toast" id="emp-toast"></div>
<script>
  function copiarEmp(){
    var url='${pageUrl}';
    function done(){var t=document.getElementById('emp-toast');t.textContent='Link copiado!';t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2000);}
    try{ navigator.clipboard.writeText(url).then(done,function(){prompt('Copie o link:',url)}); }catch(e){ prompt('Copie o link:',url); }
  }
</script>
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
