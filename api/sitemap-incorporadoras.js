// Sitemap dinâmico do hub e das páginas de incorporadoras (/incorporadoras[/slug]).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const DB = JSON.parse(readFileSync(join(process.cwd(), 'data/incorporadoras.json'), 'utf8'));
const SITE = 'https://www.rhimob.com.br';

export default async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url><loc>${SITE}/incorporadoras</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ...DB.companies.filter((c) => c.slug).map((c) => `  <url><loc>${SITE}/incorporadoras/${c.slug}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`)
  ].join('\n');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
}
