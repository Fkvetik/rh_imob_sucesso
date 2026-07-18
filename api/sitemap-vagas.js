// Vercel Function — Sitemap dinâmico das vagas individuais (/vaga/:slug)
// URL: https://www.rhimob.com.br/api/sitemap-vagas
// Faz o Google descobrir e indexar cada vaga (Google Empregos via JobPosting).

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const SB_KEY = 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj';
const SITE = 'https://www.rhimob.com.br';

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  try {
    const apiRes = await fetch(
      `${SB_URL}/rest/v1/site_vagas_publicas?status=eq.ATIVA&order=updated_at.desc&limit=1000&select=vaga_id,updated_at`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    const vagas = await apiRes.json();

    const urls = Array.isArray(vagas)
      ? vagas.filter(v => v.vaga_id).map(v => `  <url>
    <loc>${SITE}/vaga/${escapeXml(v.vaga_id)}</loc>
    <lastmod>${new Date(v.updated_at || Date.now()).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/vagas</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
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
