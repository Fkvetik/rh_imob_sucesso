// Vercel Function — Google News Sitemap dinâmico
// URL: https://www.rhimob.com.br/api/sitemap-news
// Referenciado em sitemap.xml como sitemapindex

const SB_URL = 'https://tnzmxpoxvdlckmjwdala.supabase.co';
const SB_KEY = 'sb_publishable_C_KCEs0Kd_l6NoDOFPmNOA_qBuyIxSv';
const SITE = 'https://www.rhimob.com.br';

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  try {
    // Google News aceita artigos dos últimos 2 dias para inclusão
    // Incluímos últimos 30 dias para o sitemap geral
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const apiRes = await fetch(
      `${SB_URL}/rest/v1/noticias?ativo=eq.true&publicado_em=gte.${since}&order=publicado_em.desc&limit=1000&select=titulo,slug,categoria,publicado_em`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );

    const articles = await apiRes.json();

    const urls = Array.isArray(articles)
      ? articles.map(a => `  <url>
    <loc>${SITE}/noticias/${escapeXml(a.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>RH IMOB</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${new Date(a.publicado_em).toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.titulo)}</news:title>
    </news:news>
    <lastmod>${new Date(a.publicado_em).toISOString()}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (err) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(500).send(`<?xml version="1.0"?><error>${String(err.message)}</error>`);
  }
}
