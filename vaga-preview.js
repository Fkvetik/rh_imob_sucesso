const SITE_BASE_URL = 'https://www.rhimob.com.br';
const SITE_VAGAS_TABLE = process.env.RHIMOB_SITE_VAGAS_TABLE || 'site_vagas_publicas';
const DEFAULT_OG_IMAGE = process.env.RHIMOB_DEFAULT_OG_IMAGE || 'https://res.cloudinary.com/dlp78sixn/image/upload/v1778505990/ChatGPT_Image_11_de_mai._de_2026_10_25_44_hhz9jc.png';

const PUBLIC_SUPABASE_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj';

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
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

function normalizeJob(row) {
  const title = pick(row, ['titulo', 'title', 'nome_vaga'], 'Vaga RH IMOB');
  const cidadeUf = [row.cidade, row.estado_uf].filter(Boolean).join('/');
  const location = pick(row, ['localidade', 'location'], cidadeUf || 'Consultar região');
  const id = pick(row, ['vaga_id', 'slug', 'vaga_slug', 'id'], slugify(title));
  const shareSlug = slugify(pick(row, ['slug', 'vaga_slug'], id || title));
  const contract = pick(row, ['modalidade', 'contract', 'tipo_contrato'], 'Consultar condição');
  const pay = pick(row, ['remuneracao', 'pay'], 'Condição informada pela RH IMOB');
  const schedule = pick(row, ['horario', 'schedule'], '');
  const summary = pick(row, ['resumo', 'summary'], 'Oportunidade cadastrada pela RH IMOB.');
  const image = pick(row, ['imagem_og', 'og_image', 'ogImage', 'imagem_url', 'image_url', 'imageUrl'], DEFAULT_OG_IMAGE);

  return { id, shareSlug, title, location, contract, pay, schedule, summary, image };
}

async function fetchJobsFromSupabase() {
  const supabaseUrl = (process.env.RHIMOB_SUPABASE_URL || process.env.SUPABASE_URL || PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.RHIMOB_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.RHIMOB_SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL ou chave pública ausente. Configure RHIMOB_SUPABASE_URL e RHIMOB_SUPABASE_ANON_KEY no Vercel.');
  }

  const baseFields = [
    'id', 'vaga_id', 'titulo', 'categoria', 'localidade', 'cidade', 'estado_uf',
    'modalidade', 'remuneracao', 'horario', 'resumo', 'status', 'prioridade', 'updated_at'
  ];
  const optionalFields = [
    'slug', 'vaga_slug', 'title', 'nome_vaga', 'location', 'tipo_contrato', 'pay',
    'schedule', 'summary', 'imagem_og', 'og_image', 'imagem_url', 'image_url', 'imageUrl'
  ];

  async function request(selectFields) {
    const params = new URLSearchParams();
    params.set('select', selectFields.join(','));
    params.set('status', 'eq.ATIVA');
    params.set('order', 'prioridade.asc,updated_at.desc');
    params.set('limit', '150');

    const endpoint = `${supabaseUrl}/rest/v1/${SITE_VAGAS_TABLE}?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`Falha ao consultar vagas no Supabase: HTTP ${response.status} ${text}`);
      error.status = response.status;
      error.body = text;
      throw error;
    }

    return text ? JSON.parse(text) : [];
  }

  try {
    return await request([...baseFields, ...optionalFields]);
  } catch (error) {
    const msg = String(error && error.body ? error.body : error && error.message ? error.message : error);
    const canRetryWithoutOptionalColumns = msg.includes('PGRST204') || msg.includes('schema cache') || msg.includes('Could not find');
    if (!canRetryWithoutOptionalColumns) throw error;
    return request(baseFields);
  }
}

function buildDescription(job) {
  return [job.location, job.contract, job.pay, job.schedule].filter(Boolean).join(' • ') || job.summary;
}

function buildHtml(job, slug) {
  const canonicalUrl = `${SITE_BASE_URL}/vaga/${encodeURIComponent(slug)}`;
  const redirectUrl = `${SITE_BASE_URL}/vagas.html?vaga=${encodeURIComponent(job.id)}#vagas`;
  const title = `${job.title} | RH IMOB`;
  const description = buildDescription(job);
  const image = job.image || DEFAULT_OG_IMAGE;

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
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <meta http-equiv="refresh" content="1;url=${escapeHtml(redirectUrl)}">
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:32px;background:#f7f3ed;color:#211a14}
    main{max-width:720px;margin:auto;background:#fff;border-radius:24px;padding:28px;box-shadow:0 16px 50px rgba(0,0,0,.08)}
    a{color:#8a4b1d;font-weight:700}
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(job.title)}</h1>
    <p>${escapeHtml(description)}</p>
    <p>Redirecionando para a vaga no site da RH IMOB...</p>
    <p><a href="${escapeHtml(redirectUrl)}">Abrir vaga</a></p>
  </main>
  <script>setTimeout(function(){ window.location.href = ${JSON.stringify(redirectUrl)}; }, 500);</script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  try {
    const slug = slugify(req.query.slug || '');
    if (!slug) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('Vaga não encontrada');
      return;
    }

    const rows = await fetchJobsFromSupabase();
    const jobs = Array.isArray(rows) ? rows.map(normalizeJob) : [];
    const job = jobs.find((item) => {
      return item.shareSlug === slug || slugify(item.id) === slug || slugify(item.title) === slug;
    });

    if (!job) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('Vaga não encontrada');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.end(buildHtml(job, slug));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`Erro ao gerar prévia da vaga: ${escapeHtml(error && error.message ? error.message : error)}`);
  }
};
