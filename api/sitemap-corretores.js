// Vercel Function — Sitemap dos sites de corretores publicados (/corretor/:cidade/:nome)
// URL: https://www.rhimob.com.br/api/sitemap-corretores
// Dados: rpc_sites_publicados no Coletor (SQL SITES_6). Rascunho nunca entra.
import { COLETOR } from './_ext-comum.js';

const SITE = 'https://www.rhimob.com.br';

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_sites_publicados`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: '{}'
    });
    const sites = await r.json();
    const urls = Array.isArray(sites)
      ? sites.filter(s => s.c && s.n).map(s => `  <url>
    <loc>${SITE}/corretor/${escapeXml(s.c)}/${escapeXml(s.n)}</loc>
    <lastmod>${new Date(s.em || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')
      : '';

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
  } catch (err) {
    res.status(500).send(`<?xml version="1.0"?><error>${escapeXml(err.message)}</error>`);
  }
}
