// Proxy de imagem OG — serve imagens do Supabase comprimidas a partir do nosso domínio.
// Facebook/WhatsApp rejeita terceiros (wsrv.nl). Servindo de rhimob.com.br, confiam.
// wsrv.nl é usado internamente para comprimir PNG 2.5 MB → JPEG ~150 KB.

export const config = { maxDuration: 15 };

const ALLOWED_HOSTS = ['tnzmxpoxvdlckmjwdala.supabase.co', 'pufxvskozfdvfscqnays.supabase.co'];

export default async function handler(req, res) {
  const rawUrl = req.query.url;

  if (!rawUrl || !ALLOWED_HOSTS.some((h) => rawUrl.includes(h))) {
    res.status(400).end();
    return;
  }

  const stripped = rawUrl.replace(/^https?:\/\//, '');
  const wsrvUrl = `https://images.weserv.nl/?url=${stripped}&w=1200&h=630&q=75&output=jpg&fit=cover`;

  try {
    const r = await fetch(wsrvUrl, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`wsrv ${r.status}`);
    const buf = await r.arrayBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000');
    res.setHeader('Content-Length', buf.byteLength);
    res.send(Buffer.from(buf));
  } catch (_) {
    // Fallback: original Supabase image sem compressão
    try {
      const r2 = await fetch(rawUrl, { signal: AbortSignal.timeout(8000) });
      if (!r2.ok) { res.status(502).end(); return; }
      const buf2 = await r2.arrayBuffer();
      res.setHeader('Content-Type', r2.headers.get('content-type') || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(buf2));
    } catch (_2) {
      res.status(502).end();
    }
  }
}
