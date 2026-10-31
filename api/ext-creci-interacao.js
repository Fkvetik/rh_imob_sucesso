// POST /api/ext-creci-interacao  { token, acao, ... }
// Interações no Instagram feitas pela Aceleradora (Meus perfis › 💬 Interagir),
// gravadas na base do Corretores CRECI (SQL CRECI_5) por operador:
//   acao 'registrar'   { lead_key, status, post, comentario }  → comentário feito / pulado / inativo
//   acao 'resposta'    { lead_key, post, respondeu, curtiu }    → resultado da conferência
//   acao 'a_verificar' {}                                        → comentários a conferir
//   acao 'sem_telefone' { cidade? }                              → ativos sem telefone (CSV)
import { cors, send, lerCorpo, validarSessao, RHI } from './_ext-comum.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const b = await lerCorpo(req);
  const s = await validarSessao(b.token);
  if (!s.ok) return send(res, 401, { ok: false, error: s.error });
  // Só para quem o admin liberou (SQL ACESSO_CRECI_1); sem liberação, bloqueia.
  if (s.acesso_creci_cidade !== true) return send(res, 403, { ok: false, error: 'O CRECI por cidade não está liberado para este login. Peça ao administrador.' });

  const service = RHI.service();
  if (!service) return send(res, 500, { ok: false, error: 'Chave de serviço do Corretores CRECI não configurada' });
  const conta = 'login:' + s.login;
  const t = (v, n) => (v == null ? null : String(v).slice(0, n));

  let fn, corpo;
  if (b.acao === 'registrar') {
    fn = 'rhi_ext_registrar_interacao';
    corpo = { p_conta: conta, p_lead_key: t(b.lead_key, 80), p_status: t(b.status, 30), p_post: t(b.post, 300), p_comentario: t(b.comentario, 600) };
  } else if (b.acao === 'resposta') {
    fn = 'rhi_ext_marcar_resposta';
    corpo = { p_conta: conta, p_lead_key: t(b.lead_key, 80), p_post: t(b.post, 300), p_respondeu: !!b.respondeu, p_curtiu: !!b.curtiu };
  } else if (b.acao === 'sem_telefone') {
    // Ativos sem telefone coletados por este login (SQL CRECI_8) — vira CSV na extensão.
    fn = 'rhi_ext_sem_telefone';
    corpo = { p_conta: conta, p_cidade: t(b.cidade, 80) || null };
  } else if (b.acao === 'a_verificar') {
    fn = 'rhi_ext_a_verificar';
    corpo = { p_conta: conta };
  } else {
    return send(res, 400, { ok: false, error: 'Ação inválida' });
  }

  const r = await fetch(`${RHI.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  }).catch(() => null);
  const data = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok) {
    const msg = (data && (data.message || data.hint)) || (r ? `HTTP ${r.status}` : 'sem resposta');
    return send(res, 502, { ok: false, error: /rhi_ext_sem_telefone/.test(msg) ? 'Falta rodar o SQL CRECI_8 no Corretores CRECI' : /rhi_ext_/.test(msg) ? 'Falta rodar o SQL CRECI_5 no Corretores CRECI' : msg });
  }
  return send(res, 200, b.acao === 'a_verificar' ? { ok: true, itens: data || [] } : (data || { ok: true }));
}
