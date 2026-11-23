// Opções dos filtros do disparo de e-mail (dropdowns em cascata).
// POST { token, campo, cidade?, regiao?, micro?, bairro? } -> { ok, opcoes:[...] }
// campo: cidade | regiao | micro | bairro | cargo | perfil | faixa

import { cors, send, lerCorpo, COLETOR, NT } from './_ext-comum.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' });
  const body = await lerCorpo(req);
  const token = String(body.token || '').trim();

  // gate: token válido + acesso a e-mail
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_email_config`, {
      method: 'POST', headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
    const cfg = await r.json().catch(() => null);
    if (!cfg || cfg.ok !== true) return send(res, 401, { ok: false, error: (cfg && cfg.error) || 'Sessão inválida.' });
    if (!cfg.email_acesso) return send(res, 403, { ok: false, error: 'Conta sem acesso a e-mail.' });
  } catch (e) { return send(res, 502, { ok: false, error: 'Falha ao conferir a sessão.' }); }

  try {
    const r = await fetch(`${NT.url}/rest/v1/rpc/nt_rpc_email_filtros`, {
      method: 'POST', headers: { apikey: NT.anon, Authorization: `Bearer ${NT.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_campo: String(body.campo || ''),
        p_cidade: body.cidade || null, p_regiao: body.regiao || null,
        p_micro: body.micro || null, p_bairro: body.bairro || null
      })
    });
    const txt = await r.text();
    if (!r.ok) return send(res, 502, { ok: false, error: `Banco recusou (HTTP ${r.status}): ${txt.slice(0, 200)}` });
    const d = JSON.parse(txt);
    if (!d || d.ok !== true) return send(res, 502, { ok: false, error: (d && d.error) || 'Falha nas opções.' });
    return send(res, 200, { ok: true, opcoes: d.opcoes || [] });
  } catch (e) { return send(res, 502, { ok: false, error: 'Falha ao buscar opções: ' + String(e.message || e) }); }
}
