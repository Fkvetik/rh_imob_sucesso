// POST /api/ext-sessao  { token }
// Chamada pela extensão logo depois do login do operador. Confere o token do
// Coletor e devolve sessões prontas (access + refresh token) da Plataforma
// Novos Talentos e do banco de Corretores CRECI — sem a extensão nunca ver a
// senha de nenhum dos dois. Ver _ext-comum.js (sessaoPorEmail).
import { cors, send, lerCorpo, validarSessao, sessaoPorEmail, NT, RHI } from './_ext-comum.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const { token } = await lerCorpo(req);
  const s = await validarSessao(token);
  if (!s.ok) return send(res, 401, { ok: false, error: s.error });

  const out = { ok: true, login: s.login, nt: null, rhi: null, erros: {} };
  const tarefas = [];
  if (s.email_plataforma) {
    tarefas.push(sessaoPorEmail(NT, s.email_plataforma)
      .then(x => { out.nt = x; })
      .catch(e => { out.erros.nt = String(e && e.message || e); }));
  }
  if (s.email_rhi) {
    tarefas.push(sessaoPorEmail(RHI, s.email_rhi)
      .then(x => { out.rhi = x; })
      .catch(e => { out.erros.rhi = String(e && e.message || e); }));
  }
  await Promise.all(tarefas);
  return send(res, 200, out);
}
