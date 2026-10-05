// POST /api/ext-ingest-talento  { token, lead }
// Antes a extensão chamava nt_rpc_ingest_talento direto com a chave pública —
// qualquer pessoa conseguia inserir talentos falsos no pool. Agora só entra
// lead de operador logado (token do Coletor), e quem fala com o banco do
// Novos Talentos é o servidor, com a chave de serviço.
import { cors, send, lerCorpo, validarSessao, NT } from './_ext-comum.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const { token, lead } = await lerCorpo(req);
  const s = await validarSessao(token);
  if (!s.ok) return send(res, 401, { ok: false, error: s.error });

  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) return send(res, 400, { ok: false, error: 'Lead inválido' });
  if (JSON.stringify(lead).length > 60000) return send(res, 413, { ok: false, error: 'Lead grande demais' });

  const service = NT.service();
  if (!service) return send(res, 500, { ok: false, error: 'Chave de serviço não configurada' });

  const r = await fetch(`${NT.url}/rest/v1/rpc/nt_rpc_ingest_talento`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_lead: lead })
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) return send(res, 502, { ok: false, error: (data && (data.message || data.hint)) || `HTTP ${r.status}` });
  return send(res, 200, data || { ok: true });
}
