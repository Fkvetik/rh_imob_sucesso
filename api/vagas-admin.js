// Vercel Function — gestão de vagas (site_vagas_publicas).
// Protegido por token: /api/vagas-admin?token=SEU_TOKEN
//
// GET  → { ok, vagas }  (todas, qualquer status, para o painel)
// POST { acao, ... }:
//   criar_vaga, editar_vaga, alterar_status_vaga, excluir_vaga
//
// A página pública (/vagas) só mostra status=ATIVA; desativar tira do ar
// sem apagar. Excluir remove de vez.

import { pingIndexNow } from './_indexnow.js';
import crypto from 'crypto';

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const TABELA = 'site_vagas_publicas';
const SITE = 'https://www.rhimob.com.br';

// campos texto livres aceitos em criar/editar
const CAMPOS = [
  'titulo', 'categoria', 'localidade', 'cidade', 'estado_uf', 'endereco', 'modalidade',
  'remuneracao', 'horario', 'resumo', 'destaques', 'sobre_empresa', 'detalhes', 'requisitos',
  'atividades', 'selo', 'whatsapp_destino',
  'imagem_url', 'video_url', 'instagram_url', 'midia_tipo', 'midia_alt', 'imagem_og',
  'pdf_url', 'pdf_label',
  'responsavel_nome', 'responsavel_whatsapp', 'responsavel_empresa',
  'responsavel_cargo', 'responsavel_email', 'responsavel_foto_url', 'slug'
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
        case 'definir_estado':     return await definirEstado(res, headers, body);
        case 'gerar_edit_token':   return await gerarEditToken(res, headers, body);
        case 'propagar_foto':      return await propagarFotoAcao(res, headers, body);
        case 'gerar_painel_empresa': return await gerarPainelEmpresa(res, body);
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
  if (body.na_grade !== undefined) row.na_grade = body.na_grade !== false && body.na_grade !== 'false';
  if (!row.whatsapp_destino) row.whatsapp_destino = 'MARIANA';

  const r = await fetch(`${SB_URL}/rest/v1/${TABELA}`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row)
  });
  if (!r.ok) return supabaseErr(res, r);
  const created = await r.json();
  const nova = Array.isArray(created) ? created[0] : created;
  // Foto segue o responsável: se veio foto, aplica a todas as vagas do mesmo telefone.
  if (row.responsavel_foto_url && row.responsavel_whatsapp) await propagarFotoResponsavel(headers, row.responsavel_whatsapp, row.responsavel_foto_url);
  // Avisa os buscadores na hora (só se entrou pública). Best-effort.
  if (nova && nova.status === 'ATIVA') await pingIndexNow(`${SITE}/vaga/${nova.vaga_id}`);
  return send(res, 200, { ok: true, vaga: nova });
}

async function editarVaga(res, headers, body) {
  if (!body.vaga_id) return send(res, 400, { error: 'validacao', message: 'vaga_id é obrigatório.' });
  const patch = { updated_at: new Date().toISOString() };
  CAMPOS.forEach(c => { if (body[c] !== undefined && c !== 'slug') patch[c] = body[c] == null ? '' : body[c]; });
  if (body.status !== undefined) patch.status = body.status;
  if (body.prioridade !== undefined) patch.prioridade = numOrNull(body.prioridade);
  if (body.na_grade !== undefined) patch.na_grade = body.na_grade !== false && body.na_grade !== 'false';

  const r = await fetch(`${SB_URL}/rest/v1/${TABELA}?vaga_id=eq.${encodeURIComponent(body.vaga_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
  });
  if (!r.ok) return supabaseErr(res, r);
  // Foto segue o responsável: salvou foto → aplica a todas as vagas do mesmo telefone.
  if (patch.responsavel_foto_url && body.responsavel_whatsapp) await propagarFotoResponsavel(headers, body.responsavel_whatsapp, patch.responsavel_foto_url);
  await pingIndexNow(`${SITE}/vaga/${body.vaga_id}`); // reindexar após editar
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

// Três estados num comando só (grade | fora | desativada):
//   grade  → ATIVA + na_grade=true   (aparece na grade /vagas)
//   fora   → ATIVA + na_grade=false  (pública por link, fora da grade)
//   desativada → INATIVA             (sai do ar)
async function definirEstado(res, headers, body) {
  if (!body.vaga_id || !body.estado) return send(res, 400, { error: 'validacao', message: 'vaga_id e estado são obrigatórios.' });
  const mapa = {
    grade:      { status: 'ATIVA',   na_grade: true },
    fora:       { status: 'ATIVA',   na_grade: false },
    desativada: { status: 'INATIVA', na_grade: false },
  };
  const alvo = mapa[body.estado];
  if (!alvo) return send(res, 400, { error: 'validacao', message: 'Estado inválido: ' + body.estado });
  const r = await fetch(`${SB_URL}/rest/v1/${TABELA}?vaga_id=eq.${encodeURIComponent(body.vaga_id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ ...alvo, updated_at: new Date().toISOString() })
  });
  if (!r.ok) return supabaseErr(res, r);
  if (alvo.status === 'ATIVA') await pingIndexNow(`${SITE}/vaga/${body.vaga_id}`);
  return send(res, 200, { ok: true });
}

// Gera (ou reaproveita) o token de edição da vaga e devolve o link do dono.
// O token é o segredo que deixa o dono editar só aquela vaga, sem o token-mestre.
async function gerarEditToken(res, headers, body) {
  if (!body.vaga_id) return send(res, 400, { error: 'validacao', message: 'vaga_id é obrigatório.' });
  const sel = await fetch(`${SB_URL}/rest/v1/${TABELA}?select=edit_token&vaga_id=eq.${encodeURIComponent(body.vaga_id)}&limit=1`, { headers });
  if (!sel.ok) return supabaseErr(res, sel);
  const linhas = await sel.json();
  if (!Array.isArray(linhas) || !linhas.length) return send(res, 404, { error: 'nao_encontrada', message: 'Vaga não encontrada.' });
  let token = linhas[0].edit_token;
  if (!token) {
    token = novoToken();
    const up = await fetch(`${SB_URL}/rest/v1/${TABELA}?vaga_id=eq.${encodeURIComponent(body.vaga_id)}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ edit_token: token })
    });
    if (!up.ok) return supabaseErr(res, up);
  }
  const link = `https://www.rhimob.com.br/editar-vaga?v=${encodeURIComponent(body.vaga_id)}&t=${encodeURIComponent(token)}`;
  return send(res, 200, { ok: true, edit_token: token, link });
}

// Link do painel da empresa (sem senha): token = HMAC do slug da empresa com o
// segredo do servidor. Mesmo segredo usado por /api/painel-empresa pra validar.
function tokenEmpresa(sl) {
  const secret = process.env.LEADS_ADMIN_TOKEN || '';
  return crypto.createHmac('sha256', secret).update('empresa:' + sl).digest('base64url').slice(0, 24);
}
async function gerarPainelEmpresa(res, body) {
  const sl = slug(body.empresa || '');
  if (!sl) return send(res, 400, { error: 'validacao', message: 'Empresa é obrigatória.' });
  const link = `https://www.rhimob.com.br/painel-empresa?e=${encodeURIComponent(sl)}&t=${tokenEmpresa(sl)}`;
  return send(res, 200, { ok: true, link });
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

// A foto segue o RESPONSÁVEL (o telefone): ao salvar uma foto numa vaga, todas
// as outras vagas com o mesmo WhatsApp recebem a mesma foto. Assim a operadora
// define a foto uma vez e ela vale pra todas as vagas daquele responsável
// (ex.: todas da Karina, todas do Caio). Só propaga quando há foto e telefone.
async function propagarFotoResponsavel(headers, whatsapp, foto) {
  const tel = String(whatsapp || '').trim();
  const url = String(foto || '').trim();
  if (!tel || !url) return;
  try {
    await fetch(`${SB_URL}/rest/v1/${TABELA}?responsavel_whatsapp=eq.${encodeURIComponent(tel)}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ responsavel_foto_url: url })
    });
  } catch (_) {}
}
// Ação explícita: aplica uma foto a todas as vagas de um telefone (backfill).
async function propagarFotoAcao(res, headers, body) {
  const tel = String(body.whatsapp || body.responsavel_whatsapp || '').trim();
  const foto = String(body.foto || body.responsavel_foto_url || '').trim();
  if (!tel || !foto) return send(res, 400, { error: 'validacao', message: 'whatsapp e foto são obrigatórios.' });
  await propagarFotoResponsavel(headers, tel, foto);
  return send(res, 200, { ok: true });
}
function novoToken() {
  // token curto, aleatório e sem caracteres ambíguos — só pra autorizar a edição
  // daquela vaga pelo dono (não é login; o admin segue protegido pelo token-mestre).
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < 24; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
