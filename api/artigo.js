// Vercel Function — SSR de artigo de notícia com OG tags corretas
// Mapeado por vercel.json: /noticias/:slug → /api/artigo?slug=:slug

const SB  = 'https://tnzmxpoxvdlckmjwdala.supabase.co';
const KEY = 'sb_publishable_C_KCEs0Kd_l6NoDOFPmNOA_qBuyIxSv';
const BASE = 'https://www.rhimob.com.br';

export default async function handler(req, res) {
  const slug = (req.query.slug || '').replace(/[^a-z0-9-]/g, '');
  if (!slug) { res.redirect(302, '/noticias'); return; }

  let n = null;
  try {
    const r = await fetch(
      `${SB}/rest/v1/noticias?slug=eq.${slug}&ativo=eq.true&select=*&limit=1`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    const data = await r.json();
    if (Array.isArray(data) && data.length) n = data[0];
  } catch (_) {}

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!n) {
    res.status(404).send(notFoundHtml());
    return;
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.send(renderArticle(n, slug));
}

// ── HELPERS ──────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escJs(str) {
  return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function readingTime(html) {
  const words = (html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function catColor(c) {
  const map = { Mercado: '#7c3aed', Recrutamento: '#0369a1', 'Gestão': '#065f46', 'Legislação': '#92400e', 'RH IMOB': '#ff7a1a' };
  return map[c] || '#2b124d';
}

// ── FAQ ──────────────────────────────────────────────────────────
function renderFaq(items) {
  if (!items.length) return '';
  const rows = items.map(f => `
    <details class="faq-item">
      <summary class="faq-q">${esc(f.pergunta)}</summary>
      <div class="faq-a"><p>${esc(f.resposta).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>
    </details>`).join('');
  return `
    <section class="faq-section">
      <h2 class="faq-title">Perguntas frequentes</h2>
      <div class="faq-list">${rows}
      </div>
    </section>`;
}

// ── ARTICLE HTML ─────────────────────────────────────────────────
function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 1).replace(/\s+\S*$/, '') + '…';
}

function ogImageUrl(rawUrl) {
  if (!rawUrl) return null;
  // Serve via proxy próprio (rhimob.com.br/api/og-image).
  // Facebook/WhatsApp rejeita wsrv.nl (terceiro); confiam em imagens do mesmo domínio.
  // O proxy busca internamente do wsrv.nl e entrega JPEG ~150 KB.
  if (rawUrl.includes('supabase.co/storage/v1/object/public/')) {
    return `${BASE}/api/og-image?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

function renderArticle(n, slug) {
  const url     = `${BASE}/noticias/${slug}`;
  const rawImg  = n.imagem_url || `${BASE}/assets/og-rhimob.jpg`;
  const ogImg   = ogImageUrl(n.imagem_url) || `${BASE}/assets/og-rhimob.jpg`;
  const ogTitle = truncate(n.titulo, 60);
  const ogDesc  = truncate(n.resumo, 155);
  const pubDate = formatDate(n.publicado_em);
  const mins   = readingTime(n.corpo);

  const breadcrumbLD = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'RH IMOB', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Notícias', item: BASE + '/noticias' },
      { '@type': 'ListItem', position: 3, name: n.titulo, item: url },
    ],
  });

  const articleLD = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'NewsArticle',
    headline: n.titulo,
    description: n.resumo,
    datePublished: n.publicado_em,
    dateModified: n.atualizado_em || n.publicado_em,
    url,
    image: ogImg,
    author: { '@type': 'Organization', name: 'RH IMOB', url: BASE },
    publisher: { '@type': 'Organization', name: 'RH IMOB', url: BASE,
      logo: { '@type': 'ImageObject', url: `${BASE}/assets/rhimob-logo.jpg` } },
    articleSection: n.categoria,
    inLanguage: 'pt-BR',
    isAccessibleForFree: true,
  });

  // ── FAQ ──
  let faqItems = [];
  try {
    const raw = n.faq;
    faqItems = (Array.isArray(raw) ? raw : JSON.parse(raw || '[]'))
      .filter(f => f && f.pergunta && f.resposta);
  } catch (_) { faqItems = []; }

  const faqJsonLdStr = faqItems.length ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta }
    }))
  }).replace(/<\//g, '<\\/') : '';

  const waText = encodeURIComponent(`${n.titulo} — ${url}`);
  const liUrl  = encodeURIComponent(url);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "xluiu45itd");</script>
  <title>${esc(ogTitle)} | RH IMOB</title>
  <meta name="description" content="${esc(ogDesc)}" />
  <meta name="robots" content="index, follow" />
  <meta name="theme-color" content="#2b124d" />
  <link rel="canonical" href="${url}" />
  <link rel="icon" href="/favicon.ico?v=20260509anuncie" sizes="any" />
  <link rel="icon" href="/favicon.svg?v=20260509anuncie" type="image/svg+xml" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:site_name" content="RH IMOB" />
  <meta property="og:title" content="${esc(ogTitle)} | RH IMOB" />
  <meta property="og:description" content="${esc(ogDesc)}" />
  <meta property="og:image" content="${esc(ogImg)}" />
  <meta property="og:image:secure_url" content="${esc(ogImg)}" />
  <meta property="og:image:type" content="${n.imagem_url && n.imagem_url.includes('supabase.co/storage/v1/object/public/') ? 'image/jpeg' : /\.png$/i.test(rawImg) ? 'image/png' : /\.webp$/i.test(rawImg) ? 'image/webp' : 'image/jpeg'}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(ogTitle)}" />
  <meta property="og:url" content="${url}" />
  <meta property="article:published_time" content="${n.publicado_em}" />
  <meta property="article:section" content="${esc(n.categoria)}" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@rh_imob" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  <meta name="twitter:image" content="${esc(ogImg)}" />
  <!-- JSON-LD -->
  <script type="application/ld+json">${breadcrumbLD}</script>
  <script type="application/ld+json">${articleLD}</script>
  ${faqJsonLdStr ? `<script type="application/ld+json">${faqJsonLdStr}<\/script>` : ''}
  <!-- GA4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-NSJD4F675L"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-NSJD4F675L',{page_location:'${url}'});</script>
  <link rel="stylesheet" href="/styles.css?v=20260706news" />
  <style>
    .article-hero{background:linear-gradient(135deg,#1a0a30 0%,#3b1a6b 100%);padding:72px 0 56px;position:relative}
    .article-hero-img{position:absolute;inset:0;object-fit:cover;width:100%;height:100%;opacity:.18}
    .article-hero .container{position:relative}
    .article-kicker{color:#fb923c;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:6px}
    .article-kicker span{display:inline-block;width:28px;height:2px;background:#fb923c}
    .article-hero h1{color:#fff;font-size:clamp(24px,4.5vw,46px);max-width:800px;letter-spacing:-.04em;line-height:1.2;margin:0 0 16px;font-weight:900}
    .article-hero-meta{display:flex;align-items:center;gap:12px;color:rgba(255,255,255,.65);font-size:14px;flex-wrap:wrap}
    .article-hero-meta img{width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.3)}
    .cat-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;color:#fff;background:${catColor(n.categoria)};margin-left:8px}
    .article-share{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap;align-items:center}
    .share-btn{width:46px;height:46px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:none;cursor:pointer;transition:transform .18s,box-shadow .18s;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.25)}
    .share-btn:hover{transform:scale(1.13);box-shadow:0 4px 16px rgba(0,0,0,.35)}
    .share-wa{background:#25d366;color:#fff}
    .share-fb{background:#1877f2;color:#fff}
    .share-x{background:#000;color:#fff}
    .share-li{background:#0077b5;color:#fff}
    .share-copy{background:rgba(255,255,255,.18);color:#fff;border:1.5px solid rgba(255,255,255,.35)!important}
    .share-status{background:linear-gradient(135deg,#25d366,#0d9e4e);color:#fff;width:auto!important;padding:0 18px;border-radius:28px;font-size:12px;font-weight:800;letter-spacing:.05em;gap:7px}
    .share-status:disabled{opacity:.6;cursor:wait}
    .article-wrap{max-width:760px;margin:0 auto;padding:56px 20px 72px}
    .article-body h2{font-size:24px;font-weight:900;letter-spacing:-.04em;color:#2b124d;margin:40px 0 14px}
    .article-body h3{font-size:18px;font-weight:800;color:#3b1a6b;margin:28px 0 10px}
    .article-body p{font-size:16px;line-height:1.75;color:#333;margin-bottom:18px}
    .article-body ul,ol{padding-left:22px;margin-bottom:18px}
    .article-body li{font-size:16px;line-height:1.7;color:#333;margin-bottom:8px}
    .article-body strong{color:#2b124d}
    .article-body a{color:#7c3aed}
    .article-callout{background:#f3f0ff;border-left:4px solid #7c3aed;border-radius:0 12px 12px 0;padding:20px 24px;margin:28px 0}
    .article-callout p{margin:0;font-size:15px;color:#3b1a6b;font-weight:600}
    .article-cta{background:linear-gradient(135deg,#2b124d,#5b21b6);border-radius:20px;padding:40px;text-align:center;margin-top:48px}
    .article-cta h3{color:#fff;font-size:22px;letter-spacing:-.03em;margin-bottom:10px}
    .article-cta p{color:rgba(255,255,255,.72);margin-bottom:20px;font-size:15px}
    .article-related{margin-top:56px;padding-top:40px;border-top:1px solid #e8e4f2}
    .article-related h2{font-size:20px;font-weight:900;letter-spacing:-.04em;margin-bottom:24px;color:#2b124d}
    .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
    .related-card{background:#fff;border:1px solid #e8e4f2;border-radius:14px;padding:20px;text-decoration:none;color:inherit;display:block;transition:box-shadow .2s}
    .related-card:hover{box-shadow:0 8px 24px rgba(43,18,77,.1)}
    .related-card-tag{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#ff7a1a;margin-bottom:8px;display:block}
    .related-card h3{font-size:15px;font-weight:700;line-height:1.4;color:#2b124d}
    /* COMMENTS */
    .comments-section{max-width:760px;margin:0 auto;padding:0 20px 72px}
    .comments-title{font-size:22px;font-weight:900;letter-spacing:-.04em;color:#2b124d;border-top:1px solid #e8e4f2;padding-top:40px;margin:0 0 24px}
    .comment-item{padding:20px 0;border-bottom:1px solid #e8e4f2}
    .comment-item:last-child{border-bottom:none}
    .comment-meta{display:flex;align-items:center;gap:10px;margin-bottom:8px}
    .comment-avatar{width:36px;height:36px;border-radius:50%;background:#2b124d;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex-shrink:0}
    .comment-author{font-size:14px;font-weight:700;color:#2b124d}
    .comment-date{font-size:12px;color:#aaa}
    .comment-text{font-size:15px;line-height:1.7;color:#444;margin:0}
    .comment-form{background:#f3f0ff;border-radius:16px;padding:28px;margin-top:28px}
    .comment-form h3{font-size:17px;font-weight:900;letter-spacing:-.03em;color:#2b124d;margin:0 0 18px}
    .cf-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    @media(max-width:580px){.cf-row{grid-template-columns:1fr}}
    .cf-group{margin-bottom:14px}
    .cf-group label{display:block;font-size:13px;font-weight:700;color:#555;margin-bottom:5px}
    .cf-group input,.cf-group textarea{width:100%;padding:11px 14px;border:1.5px solid #e0dce8;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border .18s;background:#fff;box-sizing:border-box}
    .cf-group input:focus,.cf-group textarea:focus{border-color:#2b124d}
    .cf-group textarea{resize:vertical;min-height:100px}
    .cf-submit{padding:12px 28px;background:#2b124d;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .18s}
    .cf-submit:hover{opacity:.88}
    .cf-submit:disabled{opacity:.5;cursor:not-allowed}
    .cf-note{font-size:12px;color:#888;margin-top:10px}
    .cf-success{background:#dcfce7;border-radius:10px;padding:14px 18px;color:#166534;font-size:14px;font-weight:700;margin-top:14px;display:none}
    .comments-empty{color:#aaa;font-size:14px;padding:8px 0}
    /* FAQ */
    .faq-section{max-width:760px;margin:0 auto 0;padding:40px 20px 0}
    .faq-title{font-size:22px;font-weight:900;letter-spacing:-.04em;color:#2b124d;margin:0 0 20px;padding-bottom:16px;border-top:1px solid #e8e4f2;padding-top:40px}
    .faq-list{display:flex;flex-direction:column;gap:10px}
    .faq-item{border:1.5px solid #e8e4f2;border-radius:14px;overflow:hidden;transition:border .2s}
    .faq-item[open]{border-color:#7c3aed}
    .faq-q{padding:18px 22px;font-size:15px;font-weight:700;color:#2b124d;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;user-select:none}
    .faq-q::-webkit-details-marker{display:none}
    .faq-q::after{content:'+';font-size:20px;font-weight:400;color:#7c3aed;flex-shrink:0;line-height:1;transition:transform .2s}
    .faq-item[open] .faq-q::after{transform:rotate(45deg)}
    .faq-a{padding:0 22px 18px;font-size:15px;line-height:1.75;color:#444}
    .faq-a p{margin:0 0 12px}
    .faq-a p:last-child{margin:0}
  </style>
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/"><img src="/assets/rhimob-logo.jpg" alt="" class="brand-mark" /><span><strong>RH IMOB</strong><small>Recrutamento imobiliário</small></span></a>
      <nav class="main-nav">
        <a href="/">Contratar</a>
        <a href="/plataformas">Plataformas</a>
        <a href="/vagas">Vagas</a>
        <a href="/carreira">Carreira</a>
      </nav>
      <a class="btn btn-cta btn-header" href="/#proposta">Solicitar proposta</a>
    </div>
  </header>

  <main>
    <section class="article-hero">
      ${n.imagem_url ? `<img class="article-hero-img" src="${esc(n.imagem_url)}" alt="${esc(n.titulo)}" />` : ''}
      <div class="container">
        <div class="article-kicker"><span></span> <a href="/noticias" style="color:inherit;text-decoration:none">Notícias</a> · ${esc(n.categoria)}</div>
        <h1>${esc(n.titulo)}</h1>
        <div class="article-hero-meta">
          <img src="/assets/mariana-v2.jpg" alt="RH IMOB" />
          <span>RH IMOB · ${pubDate} · ${mins} min de leitura</span>
          <span class="cat-badge">${esc(n.categoria)}</span>
        </div>
        <div class="article-share">
          <a class="share-btn share-wa" href="https://api.whatsapp.com/send?text=${waText}" title="WhatsApp" target="_blank" rel="noopener">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.928l6.235-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
          </a>
          <a class="share-btn share-fb" href="https://www.facebook.com/sharer/sharer.php?u=${liUrl}" title="Facebook" target="_blank" rel="noopener">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
          <a class="share-btn share-x" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(n.titulo)}&url=${liUrl}" title="X (Twitter)" target="_blank" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a class="share-btn share-li" href="https://www.linkedin.com/sharing/share-offsite/?url=${liUrl}" title="LinkedIn" target="_blank" rel="noopener">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <button class="share-btn share-status" id="btn-status" onclick="compartilharStatus(this)" title="Baixar arte para Status / Story / Instagram">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-4.5-6.5l-2 2.5-1.5-1.8L7 16h10l-3.5-3.5z"/></svg>
            Baixar arte
          </button>
          <button class="share-btn share-copy" title="Copiar link" onclick="navigator.clipboard.writeText('${url}').then(()=>{this.innerHTML='<svg width=18 height=18 viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z\\'/></svg>'});setTimeout(()=>{this.innerHTML='<svg width=18 height=18 viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z\\'/></svg>'},2200)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
        </div>
      </div>
    </section>

    <div class="article-wrap">
      <div class="article-body">${n.corpo}</div>
    </div>

    ${renderFaq(faqItems)}

    <div class="article-wrap" style="padding-top:0">
      <div class="article-cta">
        <h3>Precisa contratar corretores?</h3>
        <p>52 mil profissionais mapeados · Setup em 7 dias · 100% online</p>
        <a class="btn btn-cta" href="/#proposta">Solicitar proposta gratuita →</a>
      </div>
      <div class="article-related" id="related"></div>
    </div>
  </main>

  <!-- COMMENTS -->
  <section class="comments-section" id="comments-section">
    <h2 class="comments-title" id="comments-heading">Comentários</h2>
    <div id="comments-list"></div>
    <div class="comment-form">
      <h3>Deixe seu comentário</h3>
      <form id="comment-form" novalidate>
        <div class="cf-row">
          <div class="cf-group">
            <label for="c-nome">Nome *</label>
            <input type="text" id="c-nome" placeholder="Seu nome" maxlength="80" required />
          </div>
          <div class="cf-group">
            <label for="c-email">E-mail <span style="font-weight:400;color:#aaa">(não publicado)</span></label>
            <input type="email" id="c-email" placeholder="seu@email.com" />
          </div>
        </div>
        <div class="cf-group">
          <label for="c-texto">Comentário * <span id="c-count" style="font-weight:400;color:#aaa;font-size:12px">0/600</span></label>
          <textarea id="c-texto" rows="4" maxlength="600" placeholder="Sua opinião sobre a notícia..." required oninput="document.getElementById('c-count').textContent=this.value.length+'/600'"></textarea>
        </div>
        <button class="cf-submit" type="submit" id="c-submit">Enviar comentário →</button>
        <p class="cf-note">Comentários passam por moderação antes de serem publicados.</p>
        <div class="cf-success" id="c-success">✅ Comentário enviado! Será publicado após moderação.</div>
      </form>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <a class="brand footer-brand" href="/"><img src="/assets/rhimob-logo.jpg" alt="" class="brand-mark" /><span><strong>RH IMOB</strong><small>Recrutamento imobiliário</small></span></a>
        <p>Recrutamento imobiliário com tecnologia, inteligência e operação especializada.</p>
      </div>
      <div>
        <h3>Conteúdo</h3>
        <a href="/noticias">Notícias</a><a href="/blog">Blog</a>
        <a href="/salario-corretor-imoveis">Salário Corretor</a>
        <a href="/contrato-corretor-autonomo">Contrato Autônomo</a>
      </div>
      <div>
        <h3>Empresa</h3>
        <a href="/">Contratar</a><a href="/vagas">Vagas</a><a href="/carreira">Carreira</a>
        <a href="https://www.instagram.com/rh_imob/" target="_blank" rel="noopener">@rh_imob</a>
        <a href="https://www.facebook.com/recursoshumanosimob/" target="_blank" rel="noopener">Facebook</a>
        <a href="https://www.linkedin.com/in/marianarhimob/" target="_blank" rel="noopener">LinkedIn</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© 2026 RH IMOB · Recrutamento imobiliário especializado</span>
      <a href="/politica.html">Política de privacidade</a>
    </div>
  </footer>

  <script src="/assets/share-art.js"></script>
  <script>
    function __artToast(m){var t=document.getElementById('art-toast');if(!t){t=document.createElement('div');t.id='art-toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2b124d;color:#fff;padding:13px 24px;border-radius:30px;font-size:14px;font-weight:700;box-shadow:0 10px 30px rgba(43,18,77,.4);opacity:0;transition:opacity .25s;z-index:9999;pointer-events:none';document.body.appendChild(t);}t.textContent=m;t.style.opacity='1';setTimeout(function(){t.style.opacity='0'},2200);}
    window.__artToast=__artToast;
    function compartilharStatus(btn){
      gerarArteRHIMOB({
        kicker:'📰 NOTÍCIA · ${escJs(n.categoria)}'.toUpperCase(),
        title:'${escJs(n.titulo)}',
        sub:'${escJs(truncate(n.resumo || '', 120))}',
        ctaText:'Leia a matéria completa',
        ctaColor:'#ff7a1a',
        url:'${escJs(url)}',
        filename:'noticia-rhimob.png'
      },btn);
    }
    /* legado (não usado) */
    async function __legacyStatus(btn) {
      const OG_URL  = '${escJs(ogImg)}';
      const TITULO  = '${escJs(n.titulo)}';
      const ART_URL = '${escJs(url)}';
      const W = 1080, H = 1920, PHOTO_H = 820, PX = 88;

      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg> Gerando…';

      try {
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        /* fundo degradê roxo */
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#1a0a30'); bg.addColorStop(1, '#2b124d');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

        /* foto do artigo (cover, topo) */
        await drawCover(ctx, OG_URL, 0, 0, W, PHOTO_H);

        /* degradê sobre a foto (fundo → roxo) */
        const fade = ctx.createLinearGradient(0, PHOTO_H - 320, 0, PHOTO_H);
        fade.addColorStop(0, 'rgba(26,10,48,0)');
        fade.addColorStop(1, 'rgba(26,10,48,1)');
        ctx.fillStyle = fade; ctx.fillRect(0, PHOTO_H - 320, W, 320);

        /* kicker laranja */
        ctx.fillStyle = '#ff7a1a';
        ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
        ctx.fillText('NOTÍCIA · RH IMOB', PX, PHOTO_H + 64);
        ctx.fillRect(PX, PHOTO_H + 76, 72, 5);

        /* título (branco, grande, até 5 linhas) */
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 60px system-ui, -apple-system, sans-serif';
        drawWrapped(ctx, TITULO, PX, PHOTO_H + 160, W - PX * 2, 76, 5);

        /* linha separadora */
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(PX, 1680); ctx.lineTo(W - PX, 1680); ctx.stroke();

        /* URL */
        ctx.fillStyle = 'rgba(255,122,26,.8)';
        ctx.font = '27px system-ui, -apple-system, sans-serif';
        ctx.fillText('rhimob.com.br/noticias', PX, 1738);

        /* marca RH IMOB rodapé */
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
        ctx.fillText('RH IMOB', PX, 1840);
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.font = '27px system-ui, -apple-system, sans-serif';
        ctx.fillText('Recrutamento Imobiliário', PX, 1885);

        /* exportar: salva na galeria + mostra guia */
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.93));
        const file = new File([blob], 'rhimob-noticia.jpg', { type: 'image/jpeg' });
        const objUrl = URL.createObjectURL(blob);

        /* tenta Web Share (só arquivo — sem text, que confunde o WhatsApp) */
        let sharedViaApi = false;
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
            sharedViaApi = true;
          } catch(e) {
            if (e?.name === 'AbortError') { URL.revokeObjectURL(objUrl); return; }
          }
        }

        /* se Web Share não funcionou ou não disponível: download direto */
        if (!sharedViaApi) {
          const a = document.createElement('a');
          a.href = objUrl; a.download = 'rhimob-status.jpg';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }

        /* sempre mostra o guia — WhatsApp Status precisa de passos manuais */
        showStatusGuia(objUrl, ART_URL);

      } catch(e) {
        if (e?.name !== 'AbortError') alert('Não foi possível gerar a imagem. Tente novamente.');
      } finally {
        btn.disabled = false; btn.innerHTML = prev;
      }
    }

    function showStatusGuia(imgUrl, artUrl) {
      const id = 'status-guia-modal';
      if (document.getElementById(id)) return;
      const modal = document.createElement('div');
      modal.id = id;
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,4,24,.88);display:flex;align-items:flex-end;justify-content:center;padding:0 0 env(safe-area-inset-bottom)';
      modal.innerHTML = \`
        <div style="background:#1a0a30;border-radius:24px 24px 0 0;width:100%;max-width:520px;padding:32px 28px 36px;box-shadow:0 -8px 40px rgba(0,0,0,.6)">
          <div style="width:40px;height:4px;background:rgba(255,255,255,.2);border-radius:4px;margin:0 auto 24px"></div>
          <p style="color:#ff7a1a;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin:0 0 8px">📲 Imagem pronta!</p>
          <p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 24px;line-height:1.3">Como postar no Status do WhatsApp</p>
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:28px">
            \${['Abra o WhatsApp', 'Toque na aba <strong>Status</strong>', 'Toque no ícone <strong>+</strong> (câmera ou lápis)', 'Escolha a imagem salva na galeria', 'Publique 🚀'].map((s,i) => \`
              <div style="display:flex;align-items:center;gap:14px">
                <span style="width:28px;height:28px;border-radius:50%;background:#ff7a1a;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">\${i+1}</span>
                <span style="color:rgba(255,255,255,.85);font-size:14px">\${s}</span>
              </div>
            \`).join('')}
          </div>
          <div style="display:flex;gap:10px">
            <a href="whatsapp://" style="flex:1;background:#25d366;color:#fff;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:800;text-align:center;text-decoration:none;display:block">Abrir WhatsApp</a>
            <button onclick="document.getElementById('status-guia-modal').remove()" style="flex:1;background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">Fechar</button>
          </div>
        </div>
      \`;
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    }

    function drawCover(ctx, src, dx, dy, dw, dh) {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
          const sw = dw / scale, sh = dh / scale;
          const sx = (img.naturalWidth  - sw) / 2;
          const sy = (img.naturalHeight - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
          resolve();
        };
        img.onerror = resolve;
        img.src = src;
      });
    }

    function drawWrapped(ctx, text, x, y, maxW, lineH, maxLines) {
      const words = text.split(' ');
      let line = '', count = 0;
      for (let i = 0; i < words.length; i++) {
        const test = line + words[i] + ' ';
        if (ctx.measureText(test).width > maxW && line) {
          if (count >= maxLines - 1) { ctx.fillText(line.trimEnd() + '…', x, y); return; }
          ctx.fillText(line.trimEnd(), x, y);
          line = words[i] + ' '; y += lineH; count++;
        } else { line = test; }
      }
      if (line.trim()) ctx.fillText(line.trimEnd(), x, y);
    }
    /* ────────────────────────────────────────────────────────────── */
  </script>

  <script>
    const SB_URL = 'https://tnzmxpoxvdlckmjwdala.supabase.co';
    const SB_KEY = 'sb_publishable_C_KCEs0Kd_l6NoDOFPmNOA_qBuyIxSv';
    const SLUG   = '${slug}';

    // Related articles
    (async () => {
      try {
        const r = await fetch(
          SB_URL + '/rest/v1/noticias?ativo=eq.true&slug=neq.' + SLUG + '&categoria=eq.${esc(n.categoria)}&order=publicado_em.desc&limit=3&select=titulo,slug,categoria',
          { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
        );
        const data = await r.json();
        if (!Array.isArray(data) || !data.length) return;
        document.getElementById('related').innerHTML =
          '<h2>Mais sobre ${esc(n.categoria)}</h2><div class="related-grid">' +
          data.map(x => '<a class="related-card" href="/noticias/' + x.slug + '"><span class="related-card-tag">' + x.categoria + '</span><h3>' + x.titulo + '</h3></a>').join('') +
          '</div>';
      } catch(_) {}
    })();

    // Comments
    function relTime(iso) {
      const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
      if (d === 0) return 'hoje'; if (d === 1) return 'ontem';
      if (d < 7) return 'há ' + d + ' dias';
      return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
    }
    function escH(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    (async () => {
      try {
        const r = await fetch(
          SB_URL + '/rest/v1/comentarios?noticia_slug=eq.' + SLUG + '&aprovado=eq.true&order=criado_em.asc',
          { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
        );
        const data = await r.json();
        const heading = document.getElementById('comments-heading');
        const list    = document.getElementById('comments-list');
        if (Array.isArray(data) && data.length) {
          heading.textContent = data.length + ' Comentário' + (data.length > 1 ? 's' : '');
          list.innerHTML = data.map(c =>
            '<div class="comment-item"><div class="comment-meta"><div class="comment-avatar">' + escH(c.nome[0].toUpperCase()) + '</div>' +
            '<div><div class="comment-author">' + escH(c.nome) + '</div><div class="comment-date">' + relTime(c.criado_em) + '</div></div></div>' +
            '<p class="comment-text">' + escH(c.texto).replace(/\\n/g,'<br>') + '</p></div>'
          ).join('');
        } else {
          list.innerHTML = '<p class="comments-empty">Seja o primeiro a comentar esta notícia.</p>';
        }
      } catch(_) {}
    })();

    document.getElementById('comment-form').addEventListener('submit', async e => {
      e.preventDefault();
      const nome  = document.getElementById('c-nome').value.trim();
      const email = document.getElementById('c-email').value.trim();
      const texto = document.getElementById('c-texto').value.trim();
      if (!nome || !texto) return;
      const btn = document.getElementById('c-submit');
      btn.disabled = true; btn.textContent = 'Enviando...';
      try {
        await fetch(SB_URL + '/rest/v1/comentarios', {
          method: 'POST',
          headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ noticia_slug: SLUG, nome, email, texto })
        });
        document.getElementById('c-success').style.display = 'block';
        e.target.reset();
        document.getElementById('c-count').textContent = '0/600';
      } catch(_) { alert('Erro ao enviar. Tente novamente.'); }
      finally { btn.disabled = false; btn.textContent = 'Enviar comentário →'; }
    });
  </script>
</body>
</html>`;
}

// ── 404 ──────────────────────────────────────────────────────────
function notFoundHtml() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Notícia não encontrada | RH IMOB</title><meta name="robots" content="noindex"/>
<link rel="stylesheet" href="/styles.css?v=20260706news"/>
</head><body>
<header class="site-header"><div class="container header-inner">
<a class="brand" href="/"><img src="/assets/rhimob-logo.jpg" alt="" class="brand-mark"/><span><strong>RH IMOB</strong><small>Recrutamento imobiliário</small></span></a>
</div></header>
<main style="text-align:center;padding:120px 20px">
<h1 style="color:#2b124d;font-size:32px;margin-bottom:12px">Notícia não encontrada</h1>
<p style="color:#888;margin-bottom:32px">O artigo não existe, foi removido ou ainda não foi publicado.</p>
<a href="/noticias" style="display:inline-block;background:#2b124d;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700">← Ver todas as notícias</a>
</main></body></html>`;
}
