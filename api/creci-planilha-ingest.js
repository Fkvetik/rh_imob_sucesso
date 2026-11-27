// POST /api/creci-planilha-ingest  { segredo, rows:[...] }
//
// Porta servidor-a-servidor pela qual o SYNC da planilha "CRECI_IG_WHATSAPP"
// alimenta a base de Corretores CRECI (leads, projeto RHI). Insere TODO CRECI
// ativo novo e complementa Instagram/telefone de quem já existe (RPC
// rhi_ext_ingest_planilha_ig — SQL CRECI_12). O filtro "só com telefone"
// acontece depois, na fila de disparo.
//
// Segurança: exige o segredo MERCADO_INGEST_SECRET (mesmo env já usado pelo
// /api/mercado-ingest; fica nas Script Properties do Apps Script). A chave de
// serviço do RHI fica só no servidor.
import { RHI } from './_ext-comum.js';

function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(obj));
}
async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const txt = typeof req.body === 'string' ? req.body : '';
  try { return JSON.parse(txt); } catch { return {}; }
}
function s(v, max) { const t = (v == null ? '' : String(v)).trim(); return t ? t.slice(0, max || 300) : ''; }

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const corpo = await lerCorpo(req);
  const segredo = process.env.MERCADO_INGEST_SECRET;
  if (!segredo) return send(res, 500, { ok: false, error: 'MERCADO_INGEST_SECRET não configurado no servidor' });
  if (s(corpo.segredo, 200) !== segredo) return send(res, 401, { ok: false, error: 'Segredo inválido' });

  const rows = Array.isArray(corpo.rows) ? corpo.rows : [];
  if (!rows.length) return send(res, 400, { ok: false, error: 'Nenhuma linha enviada (rows vazio)' });
  if (rows.length > 500) return send(res, 413, { ok: false, error: 'Lote grande demais (máx. 500 linhas)' });

  const limpos = rows.filter(r => r && typeof r === 'object').map(r => ({
    cidade:         s(r.cidade || r.CIDADE, 120),
    nome:           s(r.nome || r.Nome, 200),
    creci:          s(r.creci || r.CRECI, 40),
    data_inscricao: s(r.data_inscricao || r.DataInscricao, 20),
    situacao:       s(r.situacao || r.Situacao, 30),
    instagram_url:  s(r.instagram_url || r.RHI_IG_INSTAGRAM_URL, 160),
    username:       s(r.username || r.RHI_IG_USERNAME, 60),
    nome_perfil:    s(r.nome_perfil || r.RHI_IG_NOME_PERFIL, 160),
    bio:            s(r.bio || r.RHI_IG_BIO, 2000),
    cargo:          s(r.cargo || r.RHI_IG_CARGO, 120),
    cargo_raw:      s(r.cargo_raw || r.RHI_IG_CARGO_RAW, 160),
    seguidores:     s(r.seguidores || r.RHI_IG_SEGUIDORES, 20),
    seguindo:       s(r.seguindo || r.RHI_IG_SEGUINDO, 20),
    postagens:      s(r.postagens || r.RHI_IG_POSTAGENS, 20),
    telefone:       s(r.telefone || r.RHI_IG_TELEFONE_TXT, 60),
    telefone_wa:    s(r.telefone_wa || r.RHI_IG_TELEFONE_WA, 200),
    telefone_txt:   s(r.telefone_txt || r.RHI_IG_TELEFONE_TXT, 200)
  }));

  const service = RHI.service();
  if (!service) return send(res, 500, { ok: false, error: 'RHI_SUPABASE_SERVICE_KEY não configurada no servidor' });

  const r = await fetch(`${RHI.url}/rest/v1/rpc/rhi_ext_ingest_planilha_ig`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_rows: limpos })
  }).catch(() => null);
  const data = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !data || data.ok !== true) {
    const msg = (data && (data.error || data.message || data.hint)) || (r ? `HTTP ${r.status}` : 'sem resposta');
    const falta = /rhi_ext_ingest_planilha_ig/.test(String(msg));
    return send(res, 502, { ok: false, error: falta ? 'Falta rodar o SQL CRECI_12 no projeto RHI' : msg });
  }
  return send(res, 200, { ok: true, recebidos: rows.length, ...data });
}
