// POST /api/ext-mercado-export  { token }
// Devolve, em CSV, tudo que ESTE operador coletou no "Mercado por região".
// Autorização = token de sessão (mesmo login da ferramenta). Lê via chave de
// serviço do RHI (fica só no servidor). Depende do SQL MERCADO_MAPS_10.
import { RHI, validarSessao } from './_ext-comum.js';

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
const COLS = [
  ['nome', 'Nome'], ['telefone', 'Telefone'], ['categoria', 'Categoria'],
  ['endereco', 'Endereço'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['uf', 'UF'],
  ['site', 'Site'], ['instagram_url', 'Instagram'], ['instagram_user', 'Instagram_user'],
  ['creci', 'CRECI'], ['avaliacao', 'Avaliação'], ['num_avaliacoes', 'Nº avaliações'],
  ['status', 'Status'], ['place_url', 'Link Maps']
];
function celula(v) {
  const t = (v == null ? '' : String(v)).replace(/"/g, '""');
  return `"${t}"`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });
  const corpo = await lerCorpo(req);
  const token = String(corpo.token || '').trim();
  const sessao = await validarSessao(token);
  if (!sessao || sessao.ok !== true) return send(res, 401, { ok: false, error: (sessao && sessao.error) || 'Sessão inválida ou expirada' });
  const login = String(sessao.login || '').trim();

  const service = RHI.service();
  if (!service) return send(res, 500, { ok: false, error: 'RHI_SUPABASE_SERVICE_KEY não configurada no servidor' });

  const r = await fetch(`${RHI.url}/rest/v1/rpc/rhi_mercado_do_operador`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_login: login })
  }).catch(() => null);
  const rows = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !Array.isArray(rows)) {
    const msg = (rows && (rows.message || rows.error || rows.hint)) || (r ? `HTTP ${r.status}` : 'sem resposta');
    const falta = /rhi_mercado_do_operador/.test(String(msg));
    return send(res, 502, { ok: false, error: falta ? 'Falta rodar o SQL MERCADO_MAPS_10 no projeto RHI' : msg });
  }

  const head = COLS.map(c => celula(c[1])).join(',');
  const linhas = rows.map(row => COLS.map(c => celula(row[c[0]])).join(','));
  const csv = '﻿' + [head].concat(linhas).join('\r\n'); // BOM p/ Excel abrir com acento

  return send(res, 200, { ok: true, login, total: rows.length, csv });
}
