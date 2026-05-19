import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const ROOT = process.cwd();

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.webmanifest') return 'application/manifest+json; charset=utf-8';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function safeJoin(relativePath) {
  const normalized = path.normalize(relativePath).replace(/^([.][.][\\/])+/, '');
  const full = path.join(ROOT, normalized);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function resolveFile(parts) {
  const clean = (parts || []).map((p) => String(p || '').trim()).filter(Boolean);
  const requested = clean.join('/');

  const routes = new Map([
    ['novos-talentos', 'novos-talentos.html'],
    ['corretores', 'corretores.html'],
    ['corretores.html', 'corretores.html'],
    ['vagas', 'vagas.html'],
    ['vagas.html', 'vagas.html'],
    ['politica', 'politica.html'],
    ['politica.html', 'politica.html'],
    ['404.html', '404.html'],
    ['favicon.ico', 'favicon.ico'],
    ['favicon.svg', 'favicon.svg'],
    ['site.webmanifest', 'site.webmanifest'],
    ['styles.css', 'styles.css'],
    ['script.js', 'script.js'],
    ['novos-talentos.css', 'novos-talentos.css'],
    ['novos-talentos.js', 'novos-talentos.js'],
    ['corretores.css', 'corretores.css'],
    ['corretores.js', 'corretores.js']
  ]);

  if (routes.has(requested)) return safeJoin(routes.get(requested));

  if (requested.startsWith('assets/')) return safeJoin(requested);

  const ext = path.extname(requested).toLowerCase();
  const allowed = new Set(['.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.webmanifest', '.json', '.txt']);
  if (allowed.has(ext)) return safeJoin(requested);

  return null;
}

export async function GET(_request, context) {
  const file = resolveFile(context?.params?.path || []);

  if (!file) {
    return new Response('Arquivo não encontrado.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        'Content-Type': contentType(file),
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (_err) {
    return new Response('Arquivo não encontrado.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
