// Vercel Function — administração dos logins/senhas da extensão
// RHIMOB_NT_ENRIQUECIMENTO (nt_enriquecimento_usuarios, Novos Talentos).
// Mesmo padrão de auth do api/contas.js: protegido pela senha de admin do
// painel admin-catho-coletor.html (rpc_admin_verificar_senha no Coletor).
// Chamar como: /api/enriquecimento-usuarios?token=SENHA_DE_ADMIN
//
// GET  → { ok, usuarios }
// POST { acao: 'criar'|'editar'|'excluir', ... }

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';

const COLETOR_URL = 'https://lrejfhsomfxyaoshmpzz.supabase.co';
const COLETOR_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y';

async function senhaDeAdminValida(senha, login) {
  if (!senha) return { valida: false, motivo: 'Senha não informada.' };
  try {
    const r = await fetch(`${COLETOR_URL}/rest/v1/rpc/rpc_admin_verificar_senha`, {
      method: 'POST',
      headers: { apikey: COLETOR_ANON_KEY, Authorization: `Bearer ${COLETOR_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_admin_password: senha, p_login: login || null })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { valida: false, motivo: `Falha ao verificar senha (HTTP ${r.status} do Coletor): ${t.slice(0, 200)}` };
    }
    const data = await r.json();
    if (data && data.ok === true) return { valida: true };
    return { valida: false, motivo: 'Senha de admin incorreta.' };
  } catch (e) {
    return { valida: false, motivo: 'Falha de rede ao verificar senha: ' + String(e && e.message || e) };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const token = req.query.token || '';
  const login = req.query.login || '';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SERVICE_KEY) {
    return send(res, 500, { error: 'config', message: 'Falta SUPABASE_SERVICE_KEY na Vercel.' });
  }
  const check = await senhaDeAdminValida(token, login);
  if (!check.valida) {
    return send(res, 401, { error: 'auth', message: check.motivo });
  }

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      switch (body.acao) {
        case 'criar':   return await criarUsuario(res, headers, body);
        case 'editar':  return await editarUsuario(res, headers, body);
        case 'excluir': return await excluirUsuario(res, headers, body);
        default:        return send(res, 400, { error: 'acao_invalida', message: 'Ação desconhecida: ' + body.acao });
      }
    }

    const r = await fetch(`${SB_URL}/rest/v1/nt_enriquecimento_usuarios?select=*&order=login.asc`, { headers });
    if (!r.ok) return supabaseErr(res, r);
    const usuarios = await r.json();
    return send(res, 200, { ok: true, usuarios });
  } catch (e) {
    return send(res, 500, { error: 'exception', message: String(e && e.message || e) });
  }
}

async function criarUsuario(res, headers, body) {
  const loginNovo = (body.login || '').trim().toLowerCase();
  const senha = (body.senha || '').trim();
  if (!loginNovo) return send(res, 400, { error: 'validacao', message: 'Login é obrigatório.' });
  if (!senha || senha.length < 6) return send(res, 400, { error: 'validacao', message: 'Senha precisa ter pelo menos 6 caracteres.' });

  const row = {
    login: loginNovo,
    senha,
    nome: (body.nome || '').trim() || null,
    ativo: body.ativo !== false
  };
  const r = await fetch(`${SB_URL}/rest/v1/nt_enriquecimento_usuarios`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row)
  });
  if (!r.ok) return supabaseErr(res, r);
  const created = await r.json();
  return send(res, 200, { ok: true, usuario: Array.isArray(created) ? created[0] : created });
}

async function editarUsuario(res, headers, body) {
  const id = body.id;
  if (!id) return send(res, 400, { error: 'validacao', message: 'id é obrigatório.' });
  const patch = {};
  if (body.nome != null) patch.nome = String(body.nome).trim() || null;
  if (body.senha != null && String(body.senha).trim()) {
    if (String(body.senha).trim().length < 6) return send(res, 400, { error: 'validacao', message: 'Senha precisa ter pelo menos 6 caracteres.' });
    patch.senha = String(body.senha).trim();
  }
  if (body.ativo != null) patch.ativo = !!body.ativo;

  const r = await fetch(`${SB_URL}/rest/v1/nt_enriquecimento_usuarios?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(patch)
  });
  if (!r.ok) return supabaseErr(res, r);
  const updated = await r.json();
  return send(res, 200, { ok: true, usuario: Array.isArray(updated) ? updated[0] : updated });
}

async function excluirUsuario(res, headers, body) {
  const id = body.id;
  if (!id) return send(res, 400, { error: 'validacao', message: 'id é obrigatório.' });
  const r = await fetch(`${SB_URL}/rest/v1/nt_enriquecimento_usuarios?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE', headers
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

function send(res, status, obj) { res.status(status).send(JSON.stringify(obj)); }
async function supabaseErr(res, r) {
  const t = await r.text().catch(() => '');
  return send(res, 502, { error: 'supabase', status: r.status, message: t.slice(0, 400) });
}
