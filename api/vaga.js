// Vercel Function — SSR de vaga individual com OG tags corretas
// Mapeado por vercel.json: /vaga/:slug → /api/vaga?slug=:slug
// Tabela: site_vagas_publicas (projeto pufxvskozfdvfscqnays)

const SB   = 'https://pufxvskozfdvfscqnays.supabase.co';
const KEY  = 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj';
const BASE = 'https://www.rhimob.com.br';
const FALLBACK_WA = '5511953973268';

export default async function handler(req, res) {
  const slug = (req.query.slug || '').replace(/[^a-z0-9-]/g, '');
  if (!slug) { res.redirect(302, '/vagas'); return; }

  let v = null;
  try {
    const r = await fetch(
      `${SB}/rest/v1/site_vagas_publicas?vaga_id=eq.${slug}&status=eq.ATIVA&select=*&limit=1`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    const data = await r.json();
    if (Array.isArray(data) && data.length) v = data[0];
  } catch (_) {}

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!v) {
    res.status(404).send(notFoundHtml());
    return;
  }

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
  res.send(renderVaga(v, slug));
}

// ── HELPERS ──────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escJs(str) {
  return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}
function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 1).replace(/\s+\S*$/, '') + '…';
}
function splitList(value) {
  return String(value || '').split(/\n|\r|\|/).map(s => s.trim()).filter(Boolean);
}
function ogImageUrl(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.includes('supabase.co/storage/v1/object/public/')) {
    return `${BASE}/api/og-image?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}
function liList(items) {
  return items.map(i => `<li>${esc(i)}</li>`).join('');
}

function renderVaga(v, slug) {
  const url      = `${BASE}/vaga/${slug}`;
  const titulo   = v.titulo || 'Vaga RH IMOB';
  const cidadeUf = [v.cidade, v.estado_uf].filter(Boolean).join('/');
  const local    = v.localidade || cidadeUf || 'Consultar região';
  const modal    = v.modalidade || '';
  const remun    = v.remuneracao || '';
  const categoria= v.categoria || 'Vaga';
  const respWa   = (v.responsavel_whatsapp || FALLBACK_WA).replace(/\D/g, '') || FALLBACK_WA;
  const respNome = v.responsavel_nome || 'Mariana';

  const destaques  = splitList(v.destaques);
  const atividades = splitList(v.detalhes || v.atividades);
  const requisitos = splitList(v.requisitos);

  const ogImg   = ogImageUrl(v.imagem_url) || `${BASE}/assets/og-vaga.jpg`;
  const ogTitle = truncate(titulo, 65);
  const ogDescParts = [local, modal, remun].filter(Boolean).join(' · ');
  const ogDesc  = truncate(v.resumo ? `${ogDescParts} — ${v.resumo}` : ogDescParts, 155);

  // Mensagem de candidatura no WhatsApp
  const waMsg = encodeURIComponent(
    `Olá, ${respNome}! Vim pelo site da RH IMOB e tenho interesse na vaga: ${titulo}${local ? ' (' + local + ')' : ''}.\n${url}`
  );
  const waCandidatar = `https://api.whatsapp.com/send?phone=${respWa}&text=${waMsg}`;

  // Compartilhamento
  const shareUrlEnc = encodeURIComponent(url);
  const shareTextEnc = encodeURIComponent(`Vaga: ${titulo} — ${local}`);
  const waShare = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${titulo} — ${local}\n${url}`)}`;

  // JSON-LD JobPosting
  const datePosted = (v.updated_at || v.created_at || '').slice(0, 10);
  // Sem coluna de prazo no banco — usa uma janela rolante de 60 dias a partir da
  // publicação. Vagas encerradas já saem do ar (status != ATIVA -> 404), então
  // isso só evita o aviso do Search Console de "validThrough não encontrado".
  const validThrough = (() => {
    const base = datePosted ? new Date(`${datePosted}T00:00:00Z`) : new Date();
    base.setUTCDate(base.getUTCDate() + 60);
    return base.toISOString().slice(0, 10);
  })();
  const jobLD = JSON.stringify({
    '@context': 'https://schema.org/', '@type': 'JobPosting',
    title: titulo,
    description: [v.resumo, ...atividades, ...requisitos].filter(Boolean).join('. '),
    datePosted,
    validThrough,
    employmentType: /clt/i.test(modal) ? 'FULL_TIME' : /pj|autôn|autonom/i.test(modal) ? 'CONTRACTOR' : 'OTHER',
    hiringOrganization: { '@type': 'Organization', name: 'RH IMOB', sameAs: BASE },
    jobLocation: { '@type': 'Place', address: {
      '@type': 'PostalAddress', addressLocality: v.cidade || local, addressRegion: v.estado_uf || 'SP', addressCountry: 'BR' } },
    url,
    directApply: true,
  }).replace(/<\//g, '<\\/');

  const breadcrumbLD = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'RH IMOB', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Vagas', item: BASE + '/vagas' },
      { '@type': 'ListItem', position: 3, name: titulo, item: url },
    ],
  });

  const ogType = v.imagem_url && v.imagem_url.includes('supabase.co/storage/v1/object/public/')
    ? 'image/jpeg' : /\.png$/i.test(v.imagem_url || '') ? 'image/png' : 'image/jpeg';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "xluiu45itd");</script>
  <title>${esc(ogTitle)} | Vaga RH IMOB</title>
  <meta name="description" content="${esc(ogDesc)}" />
  <meta name="robots" content="index, follow" />
  <meta name="theme-color" content="#2b124d" />
  <link rel="canonical" href="${url}" />
  <link rel="icon" href="/favicon.ico?v=20260509anuncie" sizes="any" />
  <link rel="icon" href="/favicon.svg?v=20260509anuncie" type="image/svg+xml" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png" />
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:site_name" content="RH IMOB" />
  <meta property="og:title" content="${esc(ogTitle)} — Vaga" />
  <meta property="og:description" content="${esc(ogDesc)}" />
  <meta property="og:image" content="${esc(ogImg)}" />
  <meta property="og:image:secure_url" content="${esc(ogImg)}" />
  <meta property="og:image:type" content="${ogType}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(ogTitle)}" />
  <meta property="og:url" content="${url}" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@rh_imob" />
  <meta name="twitter:title" content="${esc(ogTitle)} — Vaga" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  <meta name="twitter:image" content="${esc(ogImg)}" />
  <!-- JSON-LD -->
  <script type="application/ld+json">${breadcrumbLD}</script>
  <script type="application/ld+json">${jobLD}</script>
  <!-- GA4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-NSJD4F675L"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-NSJD4F675L',{page_location:'${url}'});</script>
  <link rel="stylesheet" href="/styles.css?v=20260713evolucao" />
  <style>
    .vg-hero{background:linear-gradient(135deg,#1a0a30 0%,#3b1a6b 100%);padding:64px 0 48px;position:relative;overflow:hidden}
    .vg-kicker{color:#fb923c;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .vg-kicker span{display:inline-block;width:28px;height:2px;background:#fb923c}
    .vg-hero h1{color:#fff;font-size:clamp(26px,4.5vw,44px);max-width:760px;letter-spacing:-.03em;line-height:1.15;margin:0 0 18px;font-weight:900}
    .vg-tags{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
    .vg-tag{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:30px;padding:8px 16px;font-size:13px;font-weight:700}
    .vg-tag.vg-tag-pay{background:rgba(31,185,120,.16);border-color:rgba(31,185,120,.4);color:#a7f3d0}
    .vg-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:8px}
    .vg-apply{background:#25d366;color:#fff;font-weight:800;font-size:16px;padding:15px 28px;border-radius:14px;text-decoration:none;display:inline-flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(37,211,102,.35)}
    .vg-apply:hover{background:#1ebe5d}
    .vg-share{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:22px}
    .vg-share-label{color:rgba(255,255,255,.6);font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-right:2px}
    .sbtn{width:44px;height:44px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:none;cursor:pointer;transition:transform .18s,box-shadow .18s;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.25)}
    .sbtn:hover{transform:scale(1.12)}
    .sbtn-wa{background:#25d366;color:#fff}.sbtn-fb{background:#1877f2;color:#fff}
    .sbtn-x{background:#000;color:#fff}.sbtn-li{background:#0077b5;color:#fff}
    .sbtn-copy{background:rgba(255,255,255,.16);color:#fff;border:1.5px solid rgba(255,255,255,.32)!important}
    .sbtn-art{background:linear-gradient(135deg,#ff7a1a,#ff9d4d);color:#fff;width:auto!important;padding:0 18px;border-radius:26px;font-size:12px;font-weight:800;gap:7px;letter-spacing:.03em}
    .sbtn-art:disabled{opacity:.6;cursor:wait}
    .vg-wrap{max-width:760px;margin:0 auto;padding:48px 20px 32px}
    .vg-block{margin-bottom:34px}
    .vg-block h2{font-size:20px;font-weight:900;letter-spacing:-.03em;color:#2b124d;margin:0 0 14px;display:flex;align-items:center;gap:10px}
    .vg-block h2::before{content:'';width:20px;height:3px;background:#ff7a1a;border-radius:3px}
    .vg-block p{font-size:16px;line-height:1.75;color:#333;margin:0 0 14px}
    .vg-block ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:11px}
    .vg-block li{font-size:15.5px;line-height:1.6;color:#333;padding-left:30px;position:relative}
    .vg-block li::before{content:'';position:absolute;left:0;top:7px;width:16px;height:16px;border-radius:50%;background:#f0e9ff;border:1.5px solid #7c3aed}
    .vg-block li::after{content:'✓';position:absolute;left:3.5px;top:4px;font-size:11px;font-weight:900;color:#7c3aed}
    .vg-resp{display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,#faf7ff,#f3eeff);border:1px solid #e8e0ff;border-radius:18px;padding:22px 24px;margin-top:8px}
    .vg-resp-av{width:56px;height:56px;border-radius:50%;background:url('/assets/mariana-v3.jpg') center/cover;flex-shrink:0;border:2px solid #fff;box-shadow:0 4px 12px rgba(43,18,77,.18)}
    .vg-resp strong{display:block;font-size:16px;color:#2b124d;font-weight:800}
    .vg-resp span{font-size:13px;color:#6f6283}
    .vg-cta{background:linear-gradient(135deg,#2b124d,#5b21b6);border-radius:20px;padding:40px 32px;text-align:center;margin:40px 0}
    .vg-cta h3{color:#fff;font-size:22px;letter-spacing:-.03em;margin:0 0 10px}
    .vg-cta p{color:rgba(255,255,255,.72);margin:0 0 22px;font-size:15px}
    .vg-back{display:inline-flex;align-items:center;gap:7px;color:#7c3aed;font-weight:700;font-size:14px;text-decoration:none;margin-bottom:8px}
    .vg-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2b124d;color:#fff;padding:13px 24px;border-radius:30px;font-size:14px;font-weight:700;box-shadow:0 10px 30px rgba(43,18,77,.4);opacity:0;pointer-events:none;transition:opacity .25s;z-index:999}
    .vg-toast.show{opacity:1}
    .vg-form-alt{margin-top:14px}
    .vg-form-toggle{all:unset;cursor:pointer;font-size:13.5px;font-weight:700;color:#c4b5fd;text-decoration:underline}
    .vg-form-toggle:hover{color:#fff}
    .vg-form{display:none;flex-direction:column;gap:10px;margin-top:14px;max-width:380px}
    .vg-form.open{display:flex}
    .vg-form label{font-size:12.5px;font-weight:700;color:rgba(255,255,255,.7)}
    .vg-form input,.vg-form textarea{width:100%;box-sizing:border-box;margin-top:5px;padding:11px 13px;border:1.5px solid rgba(255,255,255,.2);border-radius:10px;font-size:14px;font-family:inherit;background:rgba(255,255,255,.06);color:#fff;outline:none}
    .vg-form input::placeholder,.vg-form textarea::placeholder{color:rgba(255,255,255,.4)}
    .vg-form input:focus,.vg-form textarea:focus{border-color:#7c3aed}
    .vg-form textarea{resize:vertical;min-height:56px}
    .vg-form button{margin-top:2px}
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
      <a class="btn btn-cta btn-header" href="/vagas">Ver todas as vagas</a>
    </div>
  </header>

  <main>
    <section class="vg-hero">
      <div class="container">
        <div class="vg-kicker"><span></span> <a href="/vagas" style="color:inherit;text-decoration:none">Vagas</a> · ${esc(categoria)}</div>
        <h1>${esc(titulo)}</h1>
        <div class="vg-tags">
          ${local ? `<span class="vg-tag">📍 ${esc(local)}</span>` : ''}
          ${modal ? `<span class="vg-tag">💼 ${esc(modal)}</span>` : ''}
          ${remun ? `<span class="vg-tag vg-tag-pay">💰 ${esc(remun)}</span>` : ''}
        </div>
        <div class="vg-actions">
          <a class="vg-apply" href="${waCandidatar}" target="_blank" rel="noopener" onclick="gtag&&gtag('event','candidatura_vaga',{vaga:'${escJs(slug)}'});capturarInteresseVaga()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.928l6.235-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
            Candidatar-se pelo WhatsApp
          </a>
        </div>
        <div class="vg-form-alt">
          <button type="button" class="vg-form-toggle" onclick="document.getElementById('vgform').classList.toggle('open');this.querySelector('span').textContent=document.getElementById('vgform').classList.contains('open')?'Fechar formulário ▲':'Prefiro preencher um formulário ▼'">
            <span>Prefiro preencher um formulário ▼</span>
          </button>
          <form class="vg-form" id="vgform" onsubmit="return enviarCandidaturaForm(event, this)">
            <label>Nome<input type="text" name="nome" required placeholder="Seu nome" /></label>
            <label>WhatsApp<input type="tel" name="telefone" required placeholder="(11) 99999-9999" /></label>
            <label>Mensagem (opcional)<textarea name="mensagem" rows="2" placeholder="Algo que queira adiantar"></textarea></label>
            <button type="submit" class="btn btn-cta btn-full">Enviar e abrir WhatsApp →</button>
          </form>
        </div>
        <div class="vg-share">
          <span class="vg-share-label">Compartilhar</span>
          <a class="sbtn sbtn-wa" href="${waShare}" target="_blank" rel="noopener" title="WhatsApp">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.928l6.235-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
          </a>
          <a class="sbtn sbtn-fb" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrlEnc}" target="_blank" rel="noopener" title="Facebook" onclick="navigator.clipboard.writeText('${escJs(titulo)} — ${escJs(local)}\\n${escJs(url)}').then(function(){window.__artToast&&window.__artToast('Legenda copiada! Cole no post do Facebook.')})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
          <a class="sbtn sbtn-x" href="https://twitter.com/intent/tweet?text=${shareTextEnc}&url=${shareUrlEnc}" target="_blank" rel="noopener" title="X (Twitter)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a class="sbtn sbtn-li" href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrlEnc}" target="_blank" rel="noopener" title="LinkedIn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <button class="sbtn sbtn-copy" title="Copiar link" onclick="navigator.clipboard.writeText('${escJs(url)}').then(()=>vgToast('Link copiado!'))">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="sbtn sbtn-art" id="btn-art" onclick="gerarArteVaga(this)" title="Baixar arte da vaga para Status / Instagram">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-4.5-6.5l-2 2.5-1.5-1.8L7 16h10l-3.5-3.5z"/></svg>
            Baixar arte
          </button>
        </div>
      </div>
    </section>

    <div class="vg-wrap">
      <a class="vg-back" href="/vagas">← Ver todas as vagas</a>

      ${v.resumo ? `<div class="vg-block"><h2>Sobre a vaga</h2><p>${esc(v.resumo)}</p></div>` : ''}
      ${destaques.length ? `<div class="vg-block"><h2>Diferenciais</h2><ul>${liList(destaques)}</ul></div>` : ''}
      ${atividades.length ? `<div class="vg-block"><h2>Principais atividades</h2><ul>${liList(atividades)}</ul></div>` : ''}
      ${requisitos.length ? `<div class="vg-block"><h2>Requisitos e perfil</h2><ul>${liList(requisitos)}</ul></div>` : ''}

      <div class="vg-block">
        <h2>Responsável pela vaga</h2>
        <div class="vg-resp">
          <div class="vg-resp-av" role="img" aria-label="${esc(respNome)}"></div>
          <div>
            <strong>${esc(respNome)}</strong>
            <span>${esc(v.responsavel_cargo || 'Recrutamento imobiliário')} · ${esc(v.responsavel_empresa || 'RH IMOB')}</span>
          </div>
        </div>
      </div>

      <div class="vg-cta">
        <h3>Tem o perfil desta vaga?</h3>
        <p>Envie seu interesse agora pelo WhatsApp. Você revisa a mensagem antes de enviar.</p>
        <a class="vg-apply" href="${waCandidatar}" target="_blank" rel="noopener" style="display:inline-flex" onclick="capturarInteresseVaga()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.928l6.235-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
          Candidatar-se pelo WhatsApp
        </a>
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <a class="brand footer-brand" href="/"><img src="/assets/rhimob-logo.jpg" alt="" class="brand-mark" /><span><strong>RH IMOB</strong><small>Recrutamento imobiliário</small></span></a>
        <p>Recrutamento imobiliário com tecnologia, inteligência e operação especializada.</p>
      </div>
      <div>
        <h3>Empresa</h3>
        <a href="/">Contratar</a><a href="/vagas">Vagas</a><a href="/carreira">Carreira</a>
        <a href="/noticias">Notícias</a>
      </div>
      <div>
        <h3>Contato</h3>
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

  <div class="vg-toast" id="vg-toast"></div>

  <script src="/assets/share-art.js"></script>
  <script>
    function vgToast(msg){var t=document.getElementById('vg-toast');t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2000);}
    window.__artToast=vgToast;
    function gerarArteVaga(btn){
      var tags=[];
      var LOCAL='${escJs(local)}',MODAL='${escJs(modal)}',REMUN='${escJs(remun)}';
      if(LOCAL)tags.push({txt:'📍 '+LOCAL});
      if(MODAL)tags.push({txt:'💼 '+MODAL});
      if(REMUN)tags.push({txt:'💰 '+REMUN,type:'pay'});
      gerarArteRHIMOB({
        kicker:'🚀 VAGA ABERTA · ${escJs(categoria)}'.toUpperCase(),
        title:'${escJs(titulo)}',
        tags:tags,
        ctaText:'Candidate-se pelo WhatsApp',
        ctaColor:'#25d366',
        url:'${escJs(url)}',
        filename:'vaga-rhimob.png'
      },btn);
    }

    // Captura o interesse na vaga ANTES de o candidato sair pro WhatsApp — sem isso,
    // uma candidatura via link direto de vaga nunca aparecia no painel de leads
    // (só o modal do site salvava; este botão só abria o WhatsApp).
    var __capturado = false;
    function capturarInteresseVaga(){
      if(__capturado) return; // evita duplicar se o candidato clicar duas vezes
      __capturado = true;
      try{
        var sid = 'vaga-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        fetch('https://pufxvskozfdvfscqnays.supabase.co/rest/v1/site_leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj',
            Authorization: 'Bearer sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            session_id: sid,
            nome: '',
            whatsapp: '',
            cidade: '${escJs(local)}',
            cargo_vaga: '${escJs(titulo)}',
            tipo: 'candidato',
            origem: 'Candidatura direta — vaga/${escJs(slug)}',
            pagina: '${escJs(url)}',
            enviou_whatsapp: true
          }),
          keepalive: true
        }).catch(function(){});
      }catch(e){}
    }

    // Formulário alternativo: candidato prefere digitar nome/telefone em vez de
    // clicar direto no WhatsApp. Salva o lead JÁ com nome/telefone reais (ao
    // contrário de capturarInteresseVaga, que manda vazio) e abre o WhatsApp
    // com uma mensagem pronta.
    function enviarCandidaturaForm(ev, form){
      ev.preventDefault();
      var nome = form.nome.value.trim();
      var tel = form.telefone.value.trim();
      var msg = form.mensagem.value.trim();
      if(!nome || !tel){ alert('Preencha nome e WhatsApp para continuar.'); return false; }
      __capturado = true; // evita que capturarInteresseVaga grave uma segunda linha vazia
      try{
        var sid = 'vaga-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        fetch('https://pufxvskozfdvfscqnays.supabase.co/rest/v1/site_leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj',
            Authorization: 'Bearer sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            session_id: sid,
            nome: nome,
            whatsapp: tel,
            cidade: '${escJs(local)}',
            cargo_vaga: '${escJs(titulo)}',
            tipo: 'candidato',
            mensagem: msg,
            origem: 'Candidatura direta (formulário) — vaga/${escJs(slug)}',
            pagina: '${escJs(url)}',
            enviou_whatsapp: true
          }),
          keepalive: true
        }).catch(function(){});
      }catch(e){}
      var texto = 'Olá, ${escJs(respNome)}! Meu nome é ' + nome + ' (' + tel + '). Vim pelo site da RH IMOB e tenho interesse na vaga: ${escJs(titulo)}${local ? ' (' + escJs(local) + ')' : ''}.' + (msg ? (' Mensagem: ' + msg) : '') + '\\n${escJs(url)}';
      window.open('https://api.whatsapp.com/send?phone=${respWa}&text=' + encodeURIComponent(texto), '_blank');
      return false;
    }
  </script>
</body>
</html>`;
}

function notFoundHtml() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Vaga não encontrada | RH IMOB</title><meta name="robots" content="noindex"/>
<link rel="stylesheet" href="/styles.css?v=20260713evolucao"/>
<style>body{display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;font-family:Inter,sans-serif;background:#faf8ff}
.nf{max-width:420px;padding:40px}.nf h1{font-size:26px;color:#2b124d;margin:0 0 12px}.nf p{color:#6f6283;margin:0 0 24px}
.nf a{display:inline-block;background:#2b124d;color:#fff;padding:13px 26px;border-radius:12px;text-decoration:none;font-weight:700}</style>
</head><body><div class="nf"><h1>Vaga não encontrada</h1><p>Esta vaga pode ter sido preenchida ou expirada. Veja as oportunidades abertas.</p><a href="/vagas">Ver vagas abertas →</a></div></body></html>`;
}
