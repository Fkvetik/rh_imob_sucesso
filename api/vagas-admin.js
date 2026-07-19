// Vercel Function — gestão de vagas (site_vagas_publicas).
// Protegido por token: /api/vagas-admin?token=SEU_TOKEN
//
// GET  → { ok, vagas }  (todas, qualquer status, para o painel)
// POST { acao, ... }:
//   criar_vaga, editar_vaga, alterar_status_vaga, excluir_vaga
//
// A página pública (/vagas) só mostra status=ATIVA; desativar tira do ar
// sem apagar. Excluir remove de vez.

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const TABELA = 'site_vagas_publicas';

// campos texto livres aceitos em criar/editar
const CAMPOS = [
  'titulo', 'categoria', 'localidade', 'cidade', 'estado_uf', 'modalidade',
  'remuneracao', 'horario', 'resumo', 'destaques', 'detalhes', 'requisitos',
  'atividades', 'selo', 'whatsapp_destino',
  'imagem_url', 'video_url', 'instagram_url', 'midia_tipo', 'midia_alt', 'imagem_og',
  'responsavel_nome', 'responsavel_whatsapp', 'responsavel_empresa',
  'responsavel_cargo', 'responsavel_email', 'slug'
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const token = req.query.token || '';
  const ADMIN_TOKEN = process.env.LEADS_ADMIN_TOKEN;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!ADMIN_TOKEN || !SERVICE_KEY) return send(res, 500, { error: 'config', message: 'Faltam variáveis de ambiente na Vercel.' });
  if (token !== ADMIN_TOKEN) return send(res, 401, { error: 'auth', message: 'Token inválido.' });

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      switch (body.acao) {
        case 'criar_vaga':         return await criarVaga(res, headers, body);
        case 'editar_vaga':        return await editarVaga(res, headers, body);
        case 'alterar_status_vaga':return await alterarStatus(res, headers, body);
        case 'excluir_vaga':       return await excluirVaga(res, headers, body);
        default:                   return send(res, 400, { error: 'acao_invalida', message: 'Ação desconhecida: ' + body.acao });
      }
    }

    const r = await fetch(
      `${SB_URL}/rest/v1/${TABELA}?select=*&order=status.asc,prioridade.asc,updated_at.desc`,
      { headers }
    );
    if (!r.ok) return supabaseErr(res, r);
    const vagas = await r.json();
    return send(res, 200, { ok: true, vagas });
  } catch (e) {
    return send(res, 500, { error: 'exception', message: String(e && e.message || e) });
  }
}

async function criarVaga(res, headers, body) {
  const titulo = (body.titulo || '').trim();
  if (!titulo) return send(res, 400, { error: 'validacao', message: 'Título é obrigatório.' });

  // vaga_id = identificador da URL (/vaga/<vaga_id>). Usa o informado ou gera do título+cidade.
  let vagaId = (body.vaga_id || '').trim() || slug(titulo + '-' + (body.cidade || ''));
  if (!vagaId) vagaId = 'vaga-' + Math.random().toString(36).slice(2, 8);

  // garante unicidade
  const chk = await fetch(`${SB_URL}/rest/v1/${TABELA}?select=vaga_id&vaga_id=eq.${encodeURIComponent(vagaId)}`, { headers });
  const existentes = chk.ok ? await chk.json() : [];
  if (existentes.length) vagaId = vagaId + '-' + Math.random().toString(36).slice(2, 5);

  const row = { vaga_id: vagaId, slug: vagaId, updated_at: new Date().toISOString(), created_at: new Date().toISOString() };
  // texto vazio vai como '' (não null): várias colunas são NOT NULL com default ''
  CAMPOS.forEach(c => { if (body[c] !== undefined && c !== 'slug') row[c] = body[c] == null ? '' : body[c]; });
  row.status = body.status || 'ATIVA';
  row.prioridade = numOrNull(body.prioridade); if (row.prioridade == null) row.prioridade = 50;
  if (!row.whatsapp_destino) row.whatsapp_destino = 'MARIANA';

  const r = await fetch(`${SB_URL}/rest/v1/${TABELA}`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row)
  });
  if (!r.ok) return supabaseErr(res, r);
  const created = await r.json();
  return send(res, 200, { ok: true, vaga: Array.isArray(created) ? created[0] : created });
}

async function editarVaga(res, headers, body) {
  if (!body.vaga_id) return send(res, 400, { error: 'validacao', message: 'vaga_id é obrigatório.' });
  const patch = { updated_at: new Date().toISOString() };
  CAMPOS.forEach(c => { if (body[c] !== undefined && c !== 'slug') patch[c] = body[c] == null ? '' : body[c]; });
  if (body.status !== undefined) patch.status = body.status;
  if (body.prioridade !== undefined) patch.prioridade = numOrNull(body.prioridade);

  const r = await fetch(`${SB_URL}/rest/v1/${TABELA}?vaga_id=eq.${encodeURIComponent(body.vaga_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

async function alterarStatus(res, headers, body) {
  if (!body.vaga_id || !body.status) return send(res, 400, { error: 'validacao', message: 'vaga_id e status são obrigatórios.' });
  const r = await fetch(`${SB_URL}/rest/v1/${TABELA}?vaga_id=eq.${encodeURIComponent(body.vaga_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ status: body.status, updated_at: new Date().toISOString() })
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

async function excluirVaga(res, headers, body) {
  if (!body.vaga_id) return send(res, 400, { error: 'validacao', message: 'vaga_id é obrigatório.' });
  const r = await fetch(`${SB_URL}/rest/v1/${TABELA}?vaga_id=eq.${encodeURIComponent(body.vaga_id)}`, {
    method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' }
  });
  if (!r.ok) return supabaseErr(res, r);
  return send(res, 200, { ok: true });
}

// helpers
function send(res, status, obj) { res.status(status).send(JSON.stringify(obj)); }
async function supabaseErr(res, r) {
  const t = await r.text().catch(() => '');
  return send(res, 502, { error: 'supabase', status: r.status, message: t.slice(0, 400) });
}
function numOrNull(v) { if (v === '' || v == null) return null; const n = Number(v); return isFinite(n) ? n : null; }
function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
