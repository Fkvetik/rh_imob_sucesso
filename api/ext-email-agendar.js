// Põe uma campanha de e-mail na fila (ritmo espaçado). O cron envia depois.
// POST { token, assunto, corpoHtml, remetente, empresa, anexos:[{nome,tipo,b64}],
//        destinatarios:[{nome,email,cidade,cargo}] } -> { ok, enfileirados }

import { cors, send, lerCorpo, COLETOR } from './_ext-comum.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' });
  const b = await lerCorpo(req);
  const token = String(b.token || '').trim();
  const assunto = String(b.assunto || '').trim();
  const corpo = String(b.corpoHtml || '');
  const destinatarios = Array.isArray(b.destinatarios) ? b.destinatarios : [];
  const anexos = Array.isArray(b.anexos) ? b.anexos.slice(0, 5) : [];
  if (!assunto || !corpo) return send(res, 400, { ok: false, error: 'Assunto e mensagem são obrigatórios.' });
  if (!destinatarios.length) return send(res, 400, { ok: false, error: 'Nenhum destinatário.' });

  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_email_enfileirar`, {
      method: 'POST', headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_token: token, p_assunto: assunto, p_corpo: corpo,
        p_remetente: String(b.remetente || ''), p_empresa: String(b.empresa || ''),
        p_anexos: anexos, p_destinatarios: destinatarios
      })
    });
    const d = await r.json().catch(() => null);
    if (!d || d.ok !== true) return send(res, 400, { ok: false, error: (d && d.error) || 'Não foi possível agendar.' });
    return send(res, 200, { ok: true, enfileirados: d.enfileirados || 0 });
  } catch (e) {
    return send(res, 502, { ok: false, error: 'Falha ao agendar: ' + String(e.message || e) });
  }
}
