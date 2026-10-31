// POST /api/ext-creci-ig  { token, lead_key, dados: { status, instagram_url, username, nome_perfil, bio, cargo, cargo_raw, seguidores, seguindo, postagens, telefone, telefone_wa, telefone_txt } }
// Etapa 2 do coletor CRECI na Aceleradora: a extensão achou (ou não) o
// Instagram de um corretor ativo e manda o resultado. O servidor confere o
// token e grava na base do Corretores CRECI (SQL CRECI_4 →
// rhi_ext_salvar_instagram), sem apagar o que já existe.
import { cors, send, lerCorpo, validarSessao, RHI } from './_ext-comum.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const { token, lead_key, dados } = await lerCorpo(req);
  const s = await validarSessao(token);
  if (!s.ok) return send(res, 401, { ok: false, error: s.error });
  // Liberado por login no admin (SQL ACESSO_CRECI_1). Antes do SQL o campo não existe e passa.
  if (s.acesso_creci_cidade === false) return send(res, 403, { ok: false, error: 'O CRECI por cidade não está liberado para este login. Peça ao administrador.' });
  if (!lead_key || typeof lead_key !== 'string' || lead_key.length > 80) return send(res, 400, { ok: false, error: 'lead_key inválido' });
  if (!dados || typeof dados !== 'object' || JSON.stringify(dados).length > 12000) return send(res, 400, { ok: false, error: 'Dados inválidos' });

  const t = (v, n) => String(v == null ? '' : v).slice(0, n);
  const n = (v) => { const x = parseInt(String(v || '').replace(/\D/g, ''), 10); return Number.isFinite(x) ? x : null; };
  const limpo = {
    status: t(dados.status, 20), instagram_url: t(dados.instagram_url, 120), username: t(dados.username, 40),
    nome_perfil: t(dados.nome_perfil, 120), bio: t(dados.bio, 2000), cargo: t(dados.cargo, 80), cargo_raw: t(dados.cargo_raw, 120),
    seguidores: n(dados.seguidores), seguindo: n(dados.seguindo), postagens: n(dados.postagens),
    telefone: t(dados.telefone, 30), telefone_wa: t(dados.telefone_wa, 200), telefone_txt: t(dados.telefone_txt, 200),
    evidencia: t(dados.evidencia, 2200) // texto onde o número do CRECI apareceu (o banco confere — SQL CRECI_7)
  };

  const service = RHI.service();
  if (!service) return send(res, 500, { ok: false, error: 'Chave de serviço do Corretores CRECI não configurada' });
  const r = await fetch(`${RHI.url}/rest/v1/rpc/rhi_ext_salvar_instagram`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_lead_key: lead_key, p_dados: limpo, p_conta: 'login:' + s.login })
  }).catch(() => null);
  const data = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !data) {
    const msg = (data && (data.message || data.hint)) || (r ? `HTTP ${r.status}` : 'sem resposta');
    return send(res, 502, { ok: false, error: /rhi_ext_salvar_instagram/.test(msg) ? 'Falta rodar o SQL CRECI_4 no Corretores CRECI' : msg });
  }
  return send(res, 200, data);
}
