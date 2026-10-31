// POST /api/ext-creci-perfis  { token, cidade?, cargo?, busca?, page? }
// "📸 Meus perfis do Instagram" da Aceleradora: os perfis das extrações do
// CRECI feitas por este operador (SQL CRECI_2 → rhi_ext_meus_perfis),
// paginados. Nome, cidade, cargo, seguidores, bio e link do perfil — sem
// telefone (ele só sai pela liberação com a cota do plano).
import { cors, send, lerCorpo, validarSessao, RHI } from './_ext-comum.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const { token, cidade, cargo, busca, page } = await lerCorpo(req);
  const s = await validarSessao(token);
  if (!s.ok) return send(res, 401, { ok: false, error: s.error });
  // Liberado por login no admin (SQL ACESSO_CRECI_1). Antes do SQL o campo não existe e passa.
  if (s.acesso_creci_cidade === false) return send(res, 403, { ok: false, error: 'O CRECI por cidade não está liberado para este login. Peça ao administrador.' });

  const service = RHI.service();
  if (!service) return send(res, 500, { ok: false, error: 'Chave de serviço do Corretores CRECI não configurada' });

  const txt = (v, n) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));
  const r = await fetch(`${RHI.url}/rest/v1/rpc/rhi_ext_meus_perfis`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_conta: 'login:' + s.login, p_cidade: txt(cidade, 80), p_cargo: txt(cargo, 60),
      p_busca: txt(busca, 60), p_page: Math.max(1, Math.min(500, parseInt(page, 10) || 1)), p_page_size: 24
    })
  }).catch(() => null);
  const data = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !data) {
    const msg = (data && (data.message || data.hint)) || (r ? `HTTP ${r.status}` : 'sem resposta');
    return send(res, 502, { ok: false, error: /rhi_ext_meus_perfis/.test(msg) ? 'Falta rodar o SQL CRECI_2 no Corretores CRECI' : msg });
  }
  return send(res, 200, data);
}
