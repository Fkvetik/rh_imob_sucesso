const SITE_BASE_URL = process.env.RHIMOB_SITE_BASE_URL || 'https://www.rhimob.com.br';
const SITE_VAGAS_TABLE = process.env.RHIMOB_SITE_VAGAS_TABLE || 'site_vagas_publicas';
const DEFAULT_OG_IMAGE = process.env.RHIMOB_DEFAULT_OG_IMAGE || 'https://res.cloudinary.com/dlp78sixn/image/upload/v1778505990/ChatGPT_Image_11_de_mai._de_2026_10_25_44_hhz9jc.png';

const PUBLIC_SUPABASE_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj';

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pick(row, names, fallback = '') {
  for (const name of names) {
    if (row && row[name] != null && String(row[name]).trim() !== '') return String(row[name]).trim();
  }
  return fallback;
}

function splitText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(/\n|\r|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function labelFromSlug(slug) {
  return normalize(String(slug || '').replace(/[-_]+/g, ' ')).replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeJob(row, fallbackSlug) {
  const title = pick(row, ['titulo'], labelFromSlug(fallbackSlug) || 'Vaga RH IMOB');
  const cidadeUf = [row && row.cidade, row && row.estado_uf].filter(Boolean).join('/');
  const location = pick(row, ['localidade'], cidadeUf || 'Consultar região');
  const id = pick(row, ['vaga_id'], fallbackSlug || '');
  const contract = pick(row, ['modalidade'], 'Consultar condição');
  const pay = pick(row, ['remuneracao'], 'Condição informada pela RH IMOB');
  const schedule = pick(row, ['horario'], '');
  const summary = pick(row, ['resumo'], 'Oportunidade divulgada pela RH IMOB para atuação no mercado imobiliário.');
  const image = pick(row, ['imagem_url'], DEFAULT_OG_IMAGE) || DEFAULT_OG_IMAGE;
  const alt = pick(row, ['midia_alt'], title);
  const category = pick(row, ['categoria'], 'Vaga imobiliária');
  const highlights = splitText(pick(row, ['destaques'], '')).slice(0, 3);

  return { id, title, location, contract, pay, schedule, summary, image, alt, category, highlights };
}

async function requestSupabaseByVagaId(vagaId) {
  const supabaseUrl = (process.env.RHIMOB_SUPABASE_URL || process.env.SUPABASE_URL || PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.RHIMOB_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.RHIMOB_SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const selectFields = [
    'vaga_id','titulo','categoria','localidade','cidade','estado_uf','modalidade','remuneracao','horario',
    'resumo','destaques','status','prioridade','updated_at','imagem_url','instagram_url','midia_alt'
  ];

  const params = new URLSearchParams();
  params.set('select', selectFields.join(','));
  params.set('vaga_id', `eq.${vagaId}`);
  params.set('status', 'eq.ATIVA');
  params.set('limit', '1');

  const endpoint = `${supabaseUrl}/rest/v1/${SITE_VAGAS_TABLE}?${params.toString()}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });
    const text = await response.text();
    if (!response.ok) {
      console.error('RH IMOB preview: erro Supabase', response.status, text);
      return null;
    }
    const rows = text ? JSON.parse(text) : [];
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (error) {
    console.error('RH IMOB preview: falha ao consultar Supabase', error);
    return null;
  }
}

function buildDescription(job) {
  const primary = [job.location, job.contract, job.pay].filter(Boolean).join(' • ');
  return primary || job.summary;
}

function buildHtml(job, vagaId, found) {
  const canonicalUrl = `${SITE_BASE_URL}/vaga/${encodeURIComponent(vagaId)}`;
  const redirectUrl = `${SITE_BASE_URL}/vagas.html?vaga=${encodeURIComponent(job.id || vagaId)}#vagas`;
  const title = `${job.title} | RH IMOB`;
  const description = buildDescription(job);
  const image = job.image || DEFAULT_OG_IMAGE;
  const chips = [job.location, job.contract, job.pay, job.schedule].filter(Boolean).slice(0, 4);
  const highlightMarkup = (job.highlights || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">

  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="RH IMOB">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <style>
    :root{--bg:#f7f2ff;--panel:#fff;--line:rgba(43,18,77,.10);--purple:#5f26c9;--purple-dark:#2b124d;--orange:#ff8f3d;--text:#2f2440;--muted:#6d6280}
    *{box-sizing:border-box}
    body{font-family:Inter,Arial,sans-serif;margin:0;padding:24px;background:radial-gradient(circle at 0% 0%,rgba(95,38,201,.14),transparent 26rem),linear-gradient(180deg,#fbf8ff,#fff7ef);color:var(--text)}
    main{max-width:780px;margin:auto;background:var(--panel);border:1px solid var(--line);border-radius:30px;padding:22px;box-shadow:0 24px 70px rgba(43,18,77,.12)}
    .card{background:linear-gradient(135deg,var(--purple-dark),var(--purple) 62%,var(--orange));border-radius:26px;padding:clamp(22px,4vw,34px);color:#fff;position:relative;overflow:hidden}
    .card:after{content:'';position:absolute;right:-48px;top:-48px;width:210px;height:210px;border-radius:50%;background:rgba(255,255,255,.11)}
    .brand{font-size:12px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;opacity:.94;position:relative;z-index:1}
    h1{font-size:clamp(32px,6vw,52px);line-height:1.02;letter-spacing:-.05em;margin:18px 0 18px;max-width:630px;position:relative;z-index:1}
    .chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 22px;position:relative;z-index:1}
    .chip{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.15);font-size:14px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .summary{background:#fff;color:var(--text);border-radius:24px;padding:22px;box-shadow:0 18px 42px rgba(43,18,77,.13);position:relative;z-index:1}
    .summary strong{display:block;color:var(--purple);font-size:13px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:12px}
    .summary p{margin:0;line-height:1.68;font-size:16px}
    .summary ul{margin:14px 0 0;padding-left:20px}
    .summary li{margin:8px 0;line-height:1.55;font-weight:700}
    .actions{display:grid;gap:12px;margin-top:18px}
    .actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 18px;border-radius:17px;text-decoration:none;font-weight:950}
    .primary{background:linear-gradient(135deg,var(--purple-dark),var(--purple) 56%,var(--orange));color:#fff}
    .secondary{background:#f5edff;color:var(--purple-dark);border:1px solid rgba(95,38,201,.12)}
    .image-wrap{margin-top:18px;border-radius:22px;overflow:hidden;border:1px solid var(--line)}
    .image-wrap img{display:block;width:100%;max-height:340px;object-fit:cover}
    .note{margin-top:14px;color:var(--muted);font-size:14px;line-height:1.6}
    @media(max-width:640px){body{padding:14px}.chips{grid-template-columns:1fr}main{padding:14px;border-radius:22px}.card{border-radius:22px}}
  </style>
</head>
<body>
  <main>
    <section class="card">
      <div class="brand">RH IMOB • ${escapeHtml(job.category)}</div>
      <h1>${escapeHtml(job.title)}</h1>
      <div class="chips">${chips.map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join('')}</div>
      <div class="summary">
        <strong>Resumo da oportunidade</strong>
        <p>${escapeHtml(job.summary)}</p>
        ${highlightMarkup ? `<ul>${highlightMarkup}</ul>` : ''}
      </div>
    </section>
    <div class="image-wrap"><img src="${escapeHtml(image)}" alt="${escapeHtml(job.alt || job.title)}"></div>
    <div class="actions">
      <a class="primary" href="${escapeHtml(redirectUrl)}">Abrir vaga completa no site</a>
      <a class="secondary" href="${escapeHtml(SITE_BASE_URL + '/vagas.html#vagas')}">Ver todas as vagas RH IMOB</a>
    </div>
    <p class="note">${found ? 'Esta é a página visual individual da vaga compartilhada.' : 'Não encontrei essa vaga ativa no banco agora, mas você pode ver as oportunidades abertas no site.'}</p>
  </main>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const vagaId = normalize((req.query && (req.query.slug || req.query.vaga)) || '');

  if (!vagaId) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.end(buildHtml(normalizeJob(null, 'vagas'), 'vagas', false));
    return;
  }

  const row = await requestSupabaseByVagaId(vagaId);
  const found = Boolean(row);
  const job = normalizeJob(row, vagaId);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.end(buildHtml(job, vagaId, found));
};
