// POST /api/planilha-sync
// Ponte entre o Apps Script (que lê as planilhas da agência) e o banco do
// Coletor. O GAS NÃO guarda a senha de admin: ele manda só um segredo de sync
// (PLANILHA_SYNC_SECRET). Quem fala com o banco é este servidor, com a senha de
// admin que fica só aqui (COLETOR_ADMIN_PASSWORD).
//
// acao:
//   'config'  { secret }                         -> fontes ativas pra sincronizar
//   'ingest'  { secret, fonte_id, login, leads } -> insere na fila do operador
//                                                   (dedup + aviso pra extensão)
import { COLETOR } from './_ext-comum.js';

function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(obj));
}
async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
async function rpc(nome, body) {
  const r = await fetch(`${COLETOR.url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error((data && (data.message || data.error || data.hint)) || `HTTP ${r.status}`);
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const segredo = process.env.PLANILHA_SYNC_SECRET;
  const senhaAdmin = process.env.COLETOR_ADMIN_PASSWORD;
  if (!segredo || !senhaAdmin) return send(res, 500, { ok: false, error: 'Faltam PLANILHA_SYNC_SECRET / COLETOR_ADMIN_PASSWORD no servidor' });

  const corpo = await lerCorpo(req);
  if (!corpo.secret || corpo.secret !== segredo) return send(res, 401, { ok: false, error: 'Segredo de sync inválido' });

  try {
    if (corpo.acao === 'config') {
      const data = await rpc('rpc_fontes_para_sync', { p_admin_password: senhaAdmin });
      return send(res, 200, data);
    }

    if (corpo.acao === 'ingest') {
      const login = String(corpo.login || '').trim();
      const leads = Array.isArray(corpo.leads) ? corpo.leads : [];
      if (!login) return send(res, 400, { ok: false, error: 'Falta o login de destino' });
      if (!leads.length) return send(res, 200, { ok: true, na_fila: 0, ja_estavam: 0, erros: 0 });

      let na_fila = 0, ja_estavam = 0, erros = 0;
      // rpc_admin_creci_para_fila aceita até 100 por vez.
      for (let i = 0; i < leads.length; i += 100) {
        const lote = leads.slice(i, i + 100);
        const r = await rpc('rpc_admin_creci_para_fila', { p_admin_password: senhaAdmin, p_login: login, p_leads: lote });
        if (!r || r.ok !== true) return send(res, 200, { ok: false, error: (r && r.error) || 'Falha ao inserir' });
        na_fila += r.na_fila || 0; ja_estavam += r.ja_estavam || 0; erros += r.erros || 0;
      }
      if (corpo.fonte_id) {
        try { await rpc('rpc_fonte_marcar_sync', { p_admin_password: senhaAdmin, p_id: Number(corpo.fonte_id), p_novos: na_fila }); } catch (_) {}
      }
      return send(res, 200, { ok: true, na_fila, ja_estavam, erros });
    }

    return send(res, 400, { ok: false, error: 'Ação inválida' });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e && e.message || e) });
  }
}
