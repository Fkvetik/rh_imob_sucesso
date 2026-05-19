import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

function typeOf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.webmanifest') return 'application/manifest+json; charset=utf-8';
  return 'application/octet-stream';
}

export async function GET() {
  const file = path.join(process.cwd(), 'index.html');
  const body = await readFile(file);
  return new Response(body, {
    headers: {
      'Content-Type': typeOf(file),
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
