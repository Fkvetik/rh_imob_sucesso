// POST /api/site-foto  { t, imagem }   (imagem = data URL jpeg/png/webp)
// Painel do corretor (/meu-site): recebe uma foto já reduzida no navegador,
// confere o link de edição no Coletor (rpc_site_validar_upload, SQL SITES_1)
// e grava no Storage público do projeto Novos Talentos (bucket corretor-sites,
// SQL SITES_1_NT) com a chave de serviço, que nunca sai do servidor.
import { cors, send, lerCorpo, COLETOR, NT } from './_ext-comum.js';

const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 4 * 1024 * 1024;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const b = await lerCorpo(req);
  const t = String(b.t || '');
  const m = String(b.imagem || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!t || t.length > 80) return send(res, 400, { ok: false, error: 'Link inválido' });
  if (!m) return send(res, 400, { ok: false, error: 'Envie uma foto JPG, PNG ou WEBP' });
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_BYTES) return send(res, 413, { ok: false, error: 'Foto muito grande (máx. 4 MB)' });

  try {
    const v = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_site_validar_upload`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token_edicao: t })
    }).then(r => r.json()).catch(() => null);
    if (!v || !v.ok) return send(res, 403, { ok: false, error: (v && v.error) || 'Link inválido' });

    const service = NT.service();
    if (!service) return send(res, 500, { ok: false, error: 'Chave de serviço não configurada no Vercel' });
    const caminho = `${v.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${TIPOS[m[1]]}`;
    const up = await fetch(`${NT.url}/storage/v1/object/corretor-sites/${caminho}`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': m[1], 'Cache-Control': '31536000', 'x-upsert': 'false' },
      body: bytes
    });
    if (!up.ok) {
      const txt = await up.text().catch(() => '');
      if (/bucket not found/i.test(txt)) return send(res, 500, { ok: false, error: 'Falta rodar o SQL SITES_1_NT no Supabase do Novos Talentos.' });
      return send(res, 502, { ok: false, error: 'Não consegui guardar a foto (' + up.status + ')' });
    }
    return send(res, 200, { ok: true, url: `${NT.url}/storage/v1/object/public/corretor-sites/${caminho}` });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e && e.message || e) });
  }
}
