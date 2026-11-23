// Fase 3a — status da conexão do Gmail da conta (pra tela mostrar conectado/limite).
// POST { token } -> { ok, email_acesso, conectado, gmail_email, limite_dia, enviados_hoje }

import { cors, send, lerCorpo, COLETOR } from './_ext-comum.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' });
  const body = await lerCorpo(req);
  const token = String(body.token || '').trim();
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_gmail_status`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
    const d = await r.json().catch(() => null);
    if (!d || d.ok !== true) return send(res, 401, { ok: false, error: (d && d.error) || 'Sessão inválida.' });
    return send(res, 200, d);
  } catch (e) {
    return send(res, 502, { ok: false, error: 'Falha ao consultar o status.' });
  }
}
