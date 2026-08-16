// Vercel Function — administração completa de contas/planos/usuários da
// Plataforma Novos Talentos (nt_contas, nt_planos, nt_usuarios_conta).
// Protegido pela MESMA senha de admin do painel admin-catho-coletor.html
// (verificada contra o Coletor, via rpc_admin_verificar_senha) — não existe
// mais um token separado (LEADS_ADMIN_TOKEN) que o admin precisasse guardar.
// Chamar como: /api/contas?token=SENHA_DE_ADMIN
//
// GET  → { ok, contas, planos, usuarios }  (contas já com consumo/saldo mesclado)
// POST { acao, ... } → operações de escrita:
//   criar_conta, editar_conta
//   criar_usuario (cria login no Supabase Auth + registra na conta)
//   editar_usuario, alterar_status_usuario, resetar_senha_usuario, excluir_usuario
//   editar_plano

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const PRODUTO = 'NOVOS_TALENTOS';

// Projeto Coletor — só pra validar a senha de admin (rpc_admin_verificar_senha
// já é SECURITY DEFINER e liberada só pra devolver true/false, sem vazar nada).
const COLETOR_URL = 'https://lrejfhsomfxyaoshmpzz.supabase.co';
const COLETOR_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y';

// Retorna { valida, motivo } em vez de só true/false — senão um problema de
// rede/config vira "senha incorreta" na cara do usuário, o que é enganoso
// e impossível de diagnosticar de fora.
async function senhaDeAdminValida(senha) {
  if (!senha) return { valida: false, motivo: 'Senha não informada.' };
  try {
    const r = await fetch(`${COLETOR_URL}/rest/v1/rpc/rpc_admin_verificar_senha`, {
      method: 'POST',
      headers: { apikey: COLETOR_ANON_KEY, Authorization: `Bearer ${COLETOR_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_admin_password: senha })
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
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SERVICE_KEY) {
    return send(res, 500, { error: 'config', message: 'Falta SUPABASE_SERVICE_KEY na Vercel.' });
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
        case 'editar_plano':           return await editarPlano(res, headers, body);
        default:                       return send(res, 400, { error: 'acao_invalida', message: 'Ação desconhecida: ' + body.acao });
      }
    }

    // GET — carrega tudo de uma vez
    const [rRelatorio, rContas, rPlanos, rUsuarios] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/nt_relatorio_contas_v10?select=*`, { headers }),
      fetch(`${SB_URL}/rest/v1/nt_contas?select=*&produto_codigo=eq.${PRODUTO}&order=created_at.desc`, { headers }),
      fetch(`${SB_URL}/rest/v1/nt_planos?select=*&produto_codigo=eq.${PRODUTO}`, { headers }),
      fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?select=usuario_id,conta_id,auth_user_id,nome,email_login,senha_temporaria,perfil,status&produto_codigo=eq.${PRODUTO}&order=nome.asc`, { headers })
    ]);

    if (!rRelatorio.ok || !rContas.ok || !rPlanos.ok || !rUsuarios.ok) {
      return send(res, 502, { error: 'supabase', message: 'Falha ao consultar Supabase.' });
    }

    const relatorio = await rRelatorio.json();
    const contasRaw = await rContas.json();
    const planos = await rPlanos.json();
    const usuarios = await rUsuarios.json();

    // mescla consumo/saldo (vem da view) nas contas completas (têm todas as colunas editáveis)
    const consumoPorConta = {};
    (Array.isArray(relatorio) ? relatorio : []).forEach(r => { consumoPorConta[r.conta_id] = r; });
    const contas = (Array.isArray(contasRaw) ? contasRaw : []).map(c => {
      const rel = consumoPorConta[c.conta_id] || {};
      return { ...c, consumidos: rel.consumidos || 0, saldo: (rel.saldo != null ? rel.saldo : (c.limite_total || 0)) };
    });

    return send(res, 200, { ok: true, contas, planos, usuarios });
  } catch (e) {
    return send(res, 500, { error: 'exception', message: String(e && e.message || e) });
  }
}

// ───────────────────────── CONTAS ─────────────────────────

async function criarConta(res, headers, body) {
  const nome = (body.nome_conta || '').trim();
  if (!nome) return send(res, 400, { error: 'validacao', message: 'Nome da conta é obrigatório.' });
  if (!body.plano_tipo) return send(res, 400, { error: 'validacao', message: 'Plano é obrigatório.' });

  const contaId = body.conta_id && body.conta_id.trim()
    ? body.conta_id.trim()
    : 'CONTA_' + slug(nome) + '_' + Math.random().toString(36).slice(2, 7).toUpperCase();

  const row = {
    conta_id: contaId,
    produto_codigo: PRODUTO,
    nome_conta: nome,
    plano_tipo: body.plano_tipo,
    modo_integracao: body.modo_integracao || null,
    status: body.status || 'ATIVA',
    limite_total: numOrNull(body.limite_total),
    limite_por_usuario: numOrNull(body.limite_por_usuario),
    usuarios_contratados: numOrNull(body.usuarios_contratados),
    observacao: body.observacao || null,
    updated_at: new Date().toISOString()
  };

  const r = await fetch(`${SB_URL}/rest/v1/nt_contas`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row)
  });
  if (!r.ok) return supabaseErr(res, r);
  const created = await r.json();
  return send(res, 200, { ok: true, conta: Array.isArray(created) ? created[0] : created });
}

async function editarConta(res, headers, body) {
  if (!body.conta_id) return send(res, 400, { error: 'validacao', message: 'conta_id é obrigatório.' });
  const patch = { updated_at: new Date().toISOString() };
  if (body.nome_conta != null) patch.nome_conta = String(body.nome_conta).trim();
  if (body.plano_tipo != null) patch.plano_tipo = body.plano_tipo;
  if (body.modo_integracao !== undefined) patch.modo_integracao = body.modo_integracao || null;
  if (body.status != null) patch.status = body.status;
  if (body.limite_total !== undefined) patch.limite_total = numOrNull(body.limite_total);
  if (body.limite_por_usuario !== undefined) patch.limite_por_usuario = numOrNull(body.limite_por_usuario);
  if (body.usuarios_contratados !== undefined) patch.usuarios_contratados = numOrNull(body.usuarios_contratados);
  if (body.observacao !== undefined) patch.observacao = body.observacao || null;

  const r = await fetch(`${SB_URL}/rest/v1/nt_contas?conta_id=eq.${encodeURIComponent(body.conta_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

// ───────────────────────── USUÁRIOS ─────────────────────────

async function criarUsuario(res, headers, serviceKey, body) {
  const nome = (body.nome || '').trim();
  const email = (body.email_login || '').trim().toLowerCase();
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
    produto_codigo: PRODUTO,
    auth_user_id: auth.id,
    nome,
    email_login: email,
    senha_temporaria: senha,
    perfil: body.perfil || 'OPERADOR',
    status: 'ATIVO',
    observacao: body.observacao || null,
    updated_at: new Date().toISOString()
  };
  const rIns = await fetch(`${SB_URL}/rest/v1/nt_usuarios_conta`, {
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
  if (body.perfil != null) patch.perfil = body.perfil;
  if (body.status != null) patch.status = body.status;
  if (body.observacao !== undefined) patch.observacao = body.observacao || null;

  const r = await fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?usuario_id=eq.${encodeURIComponent(body.usuario_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

async function alterarStatusUsuario(res, headers, body) {
  if (!body.usuario_id || !body.status) return send(res, 400, { error: 'validacao', message: 'usuario_id e status são obrigatórios.' });
  // UPDATE direto (a RPC oficial exige sessão de usuário; service_role contorna RLS).
  const r = await fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?usuario_id=eq.${encodeURIComponent(body.usuario_id)}`, {
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

  // descobre o auth_user_id do usuário
  const rGet = await fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?select=auth_user_id&usuario_id=eq.${encodeURIComponent(body.usuario_id)}`, { headers });
  if (!rGet.ok) return supabaseErr(res, rGet);
  const rows = await rGet.json();
  const authId = rows[0] && rows[0].auth_user_id;
  if (!authId) return send(res, 400, { error: 'sem_auth', message: 'Usuário não tem login vinculado (auth_user_id ausente).' });

  // atualiza a senha no Auth
  const rUpd = await fetch(`${SB_URL}/auth/v1/admin/users/${authId}`, {
    method: 'PUT', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: senha })
  });
  if (!rUpd.ok) return supabaseErr(res, rUpd);

  // guarda a nova senha temporária como referência para o admin
  await fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?usuario_id=eq.${encodeURIComponent(body.usuario_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ senha_temporaria: senha, updated_at: new Date().toISOString() })
  }).catch(() => {});

  return send(res, 200, { ok: true });
}

async function excluirUsuario(res, headers, serviceKey, body) {
  if (!body.usuario_id) return send(res, 400, { error: 'validacao', message: 'usuario_id é obrigatório.' });

  const rGet = await fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?select=auth_user_id&usuario_id=eq.${encodeURIComponent(body.usuario_id)}`, { headers });
  if (!rGet.ok) return supabaseErr(res, rGet);
  const rows = await rGet.json();
  const authId = rows[0] && rows[0].auth_user_id;

  // remove o registro da conta
  const rDel = await fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?usuario_id=eq.${encodeURIComponent(body.usuario_id)}`, {
    method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' }
  });
  if (!rDel.ok) return supabaseErr(res, rDel);

  // remove também o login do Auth (se existir)
  if (authId) {
    await fetch(`${SB_URL}/auth/v1/admin/users/${authId}`, {
      method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }).catch(() => {});
  }
  return send(res, 200, { ok: true });
}

// ───────────────────────── PLANOS ─────────────────────────

async function editarPlano(res, headers, body) {
  if (!body.plano_tipo) return send(res, 400, { error: 'validacao', message: 'plano_tipo é obrigatório.' });
  const patch = { updated_at: new Date().toISOString() };
  if (body.preco_mensal !== undefined) {
    const p = Number(body.preco_mensal);
    if (!isFinite(p) || p < 0) return send(res, 400, { error: 'validacao', message: 'Preço inválido.' });
    patch.preco_mensal = p;
  }
  if (body.nome_comercial != null) patch.nome_comercial = String(body.nome_comercial).trim();
  if (body.descricao_comercial != null) patch.descricao_comercial = String(body.descricao_comercial).trim();
  if (body.limite_total_padrao !== undefined) patch.limite_total_padrao = numOrNull(body.limite_total_padrao);
  if (body.usuarios_padrao !== undefined) patch.usuarios_padrao = numOrNull(body.usuarios_padrao);
  if (body.status != null) patch.status = body.status;

  const r = await fetch(`${SB_URL}/rest/v1/nt_planos?plano_tipo=eq.${encodeURIComponent(body.plano_tipo)}&produto_codigo=eq.${PRODUTO}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
  });
  if (!r.ok) return supabaseErr(res, r);
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
function slug(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'CONTA';
}
