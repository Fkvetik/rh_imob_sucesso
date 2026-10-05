// Peças comuns das funções usadas pela extensão RH IMOB Aceleradora
// (/api/ext-*). Arquivo com "_" na frente: o Vercel NÃO publica como rota.
//
// Ideia geral: a extensão nunca recebe senha de outro sistema nem chave de
// serviço. Ela manda só o token de sessão do Coletor (gerado no login do
// operador); aqui no servidor esse token é conferido no banco do Coletor e,
// se for válido, o servidor faz o resto com as chaves que só ele tem.

export const COLETOR = {
  url: 'https://lrejfhsomfxyaoshmpzz.supabase.co',
  anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y'
};
export const NT = {
  url: 'https://pufxvskozfdvfscqnays.supabase.co',
  anon: 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj',
  service: () => process.env.SUPABASE_SERVICE_KEY
};
export const RHI = {
  url: 'https://tnzmxpoxvdlckmjwdala.supabase.co',
  anon: 'sb_publishable_C_KCEs0Kd_l6NoDOFPmNOA_qBuyIxSv',
  service: () => process.env.RHI_SUPABASE_SERVICE_KEY
};

// A extensão chama de chrome-extension://..., então precisa de CORS.
// Liberar qualquer origem é seguro aqui: nada funciona sem token válido.
export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj));
}

export async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

// Confere o token de sessão do operador no banco do Coletor.
// Devolve { ok, login, email_plataforma, conta_id_plataforma, limite_pool, email_rhi }.
export async function validarSessao(token) {
  if (!token || typeof token !== 'string' || token.length < 20 || token.length > 200) {
    return { ok: false, error: 'Sessão inválida' };
  }
  const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_sessao_plataformas`, {
    method: 'POST',
    headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token })
  });
  if (!r.ok) return { ok: false, error: `Falha ao conferir a sessão (HTTP ${r.status})` };
  const data = await r.json().catch(() => null);
  if (!data || data.ok !== true) return { ok: false, error: (data && data.error) || 'Sessão inválida ou expirada' };
  return data;
}

// Gera uma sessão do Supabase Auth para o e-mail, SEM senha: o servidor pede
// um link de acesso (admin/generate_link, não envia e-mail nenhum) e troca o
// código desse link por uma sessão (verify). Só funciona com a chave de
// serviço, que nunca sai daqui.
export async function sessaoPorEmail(proj, email) {
  const service = proj.service();
  if (!service) throw new Error('Chave de serviço não configurada no Vercel');
  const g = await fetch(`${proj.url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email })
  });
  const gd = await g.json().catch(() => null);
  if (!g.ok || !gd) throw new Error((gd && (gd.msg || gd.error_description || gd.error)) || `generate_link HTTP ${g.status}`);
  const hashed = gd.hashed_token || (gd.properties && gd.properties.hashed_token);
  if (!hashed) throw new Error('generate_link não devolveu o código de acesso');

  let ultimoErro = '';
  for (const type of ['email', 'magiclink']) {
    const v = await fetch(`${proj.url}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: proj.anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, token_hash: hashed })
    });
    const vd = await v.json().catch(() => null);
    if (v.ok && vd && vd.access_token) {
      return {
        access_token: vd.access_token,
        refresh_token: vd.refresh_token || null,
        expires_in: vd.expires_in || 3600,
        user_id: (vd.user && vd.user.id) || null
      };
    }
    ultimoErro = (vd && (vd.msg || vd.error_description || vd.error)) || `verify HTTP ${v.status}`;
  }
  throw new Error(ultimoErro || 'Não foi possível gerar a sessão');
}
