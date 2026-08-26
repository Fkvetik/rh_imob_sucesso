// Vercel Function — administração completa de contas/usuários do Banco de
// Corretores CRECI (projeto RHI, tnzmxpoxvdlckmjwdala: tabelas contas,
// usuarios_conta). Mesmo padrão do /api/contas (Novos Talentos), adaptado ao
// schema real desse projeto — mais simples: sem produto_codigo (é um projeto
// dedicado só a isso) e sem tabela de planos.
// Protegido pela MESMA senha de admin do painel admin-catho-coletor.html.
// Chamar como: /api/contas-rhi?token=SENHA_DE_ADMIN
//
// GET  → { ok, contas, usuarios }  (contas já com "consumidos" mesclado)
// POST { acao, ... } → operações de escrita:
//   criar_conta, editar_conta
//   criar_usuario (cria login no Supabase Auth + registra na conta)
//   editar_usuario, alterar_status_usuario, resetar_senha_usuario, excluir_usuario

const SB_URL = 'https://tnzmxpoxvdlckmjwdala.supabase.co';

// Projeto Coletor — só pra validar a senha de admin (mesmo helper do /api/contas).
const COLETOR_URL = 'https://lrejfhsomfxyaoshmpzz.supabase.co';
const COLETOR_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y';

async function senhaDeAdminValida(senha) {
  if (!senha) return { valida: false, motivo: 'Senha não informada.' };
  try {
    const r = await fetch(`${COLETOR_URL}/rest/v1/rpc/rpc_admin_verificar_senha`, {
      method: 'POST',
      headers: { apikey: COLETOR_ANON_KEY, Authorization: `Bearer ${COLETOR_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_admin_password: senha, p_login: null })
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
  const SERVICE_KEY = process.env.RHI_SUPABASE_SERVICE_KEY;

  if (!SERVICE_KEY) {
    return send(res, 500, { error: 'config', message: 'Falta RHI_SUPABASE_SERVICE_KEY na Vercel.' });
  }
  const check = await senhaDeAdminValida(token);
  if (!check.valida) {
    return send(res, 401, { error: 'auth', message: check.motivo });
  }

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      switch (body.acao) {
        case 'criar_conta':            return await criarConta(res, headers, body);
        case 'editar_conta':           return await editarConta(res, headers, body);
        case 'criar_usuario':          return await criarUsuario(res, headers, SERVICE_KEY, body);
        case 'editar_usuario':         return await editarUsuario(res, headers, body);
        case 'alterar_status_usuario': return await alterarStatusUsuario(res, headers, body);
        case 'resetar_senha_usuario':  return await resetarSenhaUsuario(res, headers, SERVICE_KEY, body);
        case 'excluir_usuario':        return await excluirUsuario(res, headers, SERVICE_KEY, body);
        default:                       return send(res, 400, { error: 'acao_invalida', message: 'Ação desconhecida: ' + body.acao });
      }
    }

    // GET — carrega tudo de uma vez
    const [rContas, rUsuarios, rConsumos] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/contas?select=*&order=created_at.desc`, { headers }),
      fetch(`${SB_URL}/rest/v1/usuarios_conta?select=id,conta_id,auth_user_id,nome,email,telefone,perfil,status&order=nome.asc`, { headers }),
      fetch(`${SB_URL}/rest/v1/lead_consumos?select=conta_id&status=eq.LIBERADO`, { headers })
    ]);

    if (!rContas.ok || !rUsuarios.ok || !rConsumos.ok) {
      return send(res, 502, { error: 'supabase', message: 'Falha ao consultar Supabase.' });
    }

    const contasRaw = await rContas.json();
    const usuarios = await rUsuarios.json();
    const consumos = await rConsumos.json();

    const consumidoPorConta = {};
    (Array.isArray(consumos) ? consumos : []).forEach(c => {
      consumidoPorConta[c.conta_id] = (consumidoPorConta[c.conta_id] || 0) + 1;
    });
    const contas = (Array.isArray(contasRaw) ? contasRaw : []).map(c => ({
      ...c,
      consumidos: consumidoPorConta[c.id] || 0
    }));

    return send(res, 200, { ok: true, contas, usuarios });
  } catch (e) {
    return send(res, 500, { error: 'exception', message: String(e && e.message || e) });
  }
}

// ───────────────────────── CONTAS ─────────────────────────

async function criarConta(res, headers, body) {
  const nome = (body.nome_empresa || '').trim();
  if (!nome) return send(res, 400, { error: 'validacao', message: 'Nome da empresa é obrigatório.' });

  const row = {
    nome_empresa: nome,
    telefone: body.telefone || null,
    usuarios_contratados: numOrNull(body.usuarios_contratados),
    limite_leads: numOrNull(body.limite_leads),
    data_inicio: body.data_inicio || null,
    data_fim: body.data_fim || null,
    status: body.status || 'ATIVA',
    observacao: body.observacao || null,
    updated_at: new Date().toISOString()
  };

  const r = await fetch(`${SB_URL}/rest/v1/contas`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row)
  });
  if (!r.ok) return supabaseErr(res, r);
  const created = await r.json();
  return send(res, 200, { ok: true, conta: Array.isArray(created) ? created[0] : created });
}

async function editarConta(res, headers, body) {
  if (!body.conta_id) return send(res, 400, { error: 'validacao', message: 'conta_id é obrigatório.' });
  const patch = { updated_at: new Date().toISOString() };
  if (body.nome_empresa != null) patch.nome_empresa = String(body.nome_empresa).trim();
  if (body.telefone !== undefined) patch.telefone = body.telefone || null;
  if (body.status != null) patch.status = body.status;
  if (body.usuarios_contratados !== undefined) patch.usuarios_contratados = numOrNull(body.usuarios_contratados);
  if (body.limite_leads !== undefined) patch.limite_leads = numOrNull(body.limite_leads);
  if (body.data_inicio !== undefined) patch.data_inicio = body.data_inicio || null;
  if (body.data_fim !== undefined) patch.data_fim = body.data_fim || null;
  if (body.observacao !== undefined) patch.observacao = body.observacao || null;

  const r = await fetch(`${SB_URL}/rest/v1/contas?id=eq.${encodeURIComponent(body.conta_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

// ───────────────────────── USUÁRIOS ─────────────────────────

async function criarUsuario(res, headers, serviceKey, body) {
  const nome = (body.nome || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const senha = (body.senha || '').trim();
  if (!body.conta_id) return send(res, 400, { error: 'validacao', message: 'conta_id é obrigatório.' });
  if (!nome) return send(res, 400, { error: 'validacao', message: 'Nome é obrigatório.' });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'validacao', message: 'E-mail inválido.' });
  if (senha.length < 6) return send(res, 400, { error: 'validacao', message: 'Senha deve ter ao menos 6 caracteres.' });

  // 1) cria o login no Supabase Auth (gera auth_user_id)
  const rAuth = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha, email_confirm: true })
  });
  const auth = await rAuth.json();
  if (!rAuth.ok || !auth.id) {
    const msg = (auth && (auth.msg || auth.error_description || auth.message)) || 'Falha ao criar login.';
    const amigavel = /already been registered|already exists|duplicate/i.test(msg) ? 'Já existe um login com esse e-mail.' : msg;
    return send(res, 400, { error: 'auth', message: amigavel });
  }

  // 2) registra na conta. Se falhar, faz rollback do login no Auth (evita órfão).
  const row = {
    conta_id: body.conta_id,
    auth_user_id: auth.id,
    nome,
    email,
    telefone: body.telefone || null,
    perfil: body.perfil || 'OPERADOR',
    status: 'ATIVO',
    updated_at: new Date().toISOString()
  };
  const rIns = await fetch(`${SB_URL}/rest/v1/usuarios_conta`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row)
  });
  if (!rIns.ok) {
    await fetch(`${SB_URL}/auth/v1/admin/users/${auth.id}`, {
      method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).catch(() => {});
    return supabaseErr(res, rIns);
  }
  const created = await rIns.json();
  return send(res, 200, { ok: true, usuario: Array.isArray(created) ? created[0] : created });
}

async function editarUsuario(res, headers, body) {
  if (!body.usuario_id) return send(res, 400, { error: 'validacao', message: 'usuario_id é obrigatório.' });
  const patch = { updated_at: new Date().toISOString() };
  if (body.nome != null) patch.nome = String(body.nome).trim();
  if (body.telefone !== undefined) patch.telefone = body.telefone || null;
  if (body.perfil != null) patch.perfil = body.perfil;
  if (body.status != null) patch.status = body.status;

  const r = await fetch(`${SB_URL}/rest/v1/usuarios_conta?id=eq.${encodeURIComponent(body.usuario_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

async function alterarStatusUsuario(res, headers, body) {
  if (!body.usuario_id || !body.status) return send(res, 400, { error: 'validacao', message: 'usuario_id e status são obrigatórios.' });
  const r = await fetch(`${SB_URL}/rest/v1/usuarios_conta?id=eq.${encodeURIComponent(body.usuario_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ status: body.status, updated_at: new Date().toISOString() })
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

async function resetarSenhaUsuario(res, headers, serviceKey, body) {
  const senha = (body.senha || '').trim();
  if (!body.usuario_id) return send(res, 400, { error: 'validacao', message: 'usuario_id é obrigatório.' });
  if (senha.length < 6) return send(res, 400, { error: 'validacao', message: 'Senha deve ter ao menos 6 caracteres.' });

  const rGet = await fetch(`${SB_URL}/rest/v1/usuarios_conta?select=auth_user_id&id=eq.${encodeURIComponent(body.usuario_id)}`, { headers });
  if (!rGet.ok) return supabaseErr(res, rGet);
  const rows = await rGet.json();
  const authId = rows[0] && rows[0].auth_user_id;
  if (!authId) return send(res, 400, { error: 'sem_auth', message: 'Usuário não tem login vinculado (auth_user_id ausente).' });

  const rUpd = await fetch(`${SB_URL}/auth/v1/admin/users/${authId}`, {
    method: 'PUT', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: senha })
  });
  if (!rUpd.ok) return supabaseErr(res, rUpd);

  // Diferente do /api/contas (Novos Talentos): esse projeto não tem coluna
  // pra guardar uma cópia de referência da senha — só o Auth mesmo guarda.
  return send(res, 200, { ok: true });
}

async function excluirUsuario(res, headers, serviceKey, body) {
  if (!body.usuario_id) return send(res, 400, { error: 'validacao', message: 'usuario_id é obrigatório.' });

  const rGet = await fetch(`${SB_URL}/rest/v1/usuarios_conta?select=auth_user_id&id=eq.${encodeURIComponent(body.usuario_id)}`, { headers });
  if (!rGet.ok) return supabaseErr(res, rGet);
  const rows = await rGet.json();
  const authId = rows[0] && rows[0].auth_user_id;

  const rDel = await fetch(`${SB_URL}/rest/v1/usuarios_conta?id=eq.${encodeURIComponent(body.usuario_id)}`, {
    method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' }
  });
  if (!rDel.ok) return supabaseErr(res, rDel);

  if (authId) {
    await fetch(`${SB_URL}/auth/v1/admin/users/${authId}`, {
      method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).catch(() => {});
  }
  return send(res, 200, { ok: true });
}

// ───────────────────────── helpers ─────────────────────────

function send(res, status, obj) { res.status(status).send(JSON.stringify(obj)); }
async function supabaseErr(res, r) {
  const t = await r.text().catch(() => '');
  return send(res, 502, { error: 'supabase', status: r.status, message: t.slice(0, 400) });
}
function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}
