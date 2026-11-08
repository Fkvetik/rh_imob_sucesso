// POST /api/mercado-ingest  { segredo, estagio, rows:[...] }
//
// Porta única pela qual a planilha do Google Maps (Apps Script) alimenta a base
// "Mercado por região" (tabela rhi_mercado_maps no projeto RHI / Corretores
// CRECI). Quem chama é o Apps Script — servidor-para-servidor, sem navegador:
//   - CENTRAL manda o registro parcial (estagio:'central');
//   - COLETA/TRATADOS mandam o registro completo (estagio:'coleta');
//   - o backfill manda o histórico em lotes (estagio:'coleta').
//
// Segurança:
//   - exige o segredo MERCADO_INGEST_SECRET (env do Vercel; o mesmo valor fica
//     nas Script Properties do Apps Script). Sem ele, 401.
//   - a chave do Supabase (RHI_SUPABASE_SERVICE_KEY) fica SÓ aqui no servidor;
//     nunca vai para a planilha nem para a extensão.
//   - o telefone entra como dado interno; o "Perto de mim" só lê contagem.
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

function s(v, max) {
  const t = (v == null ? '' : String(v)).trim();
  return t ? t.slice(0, max || 300) : '';
}
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function inteiro(v) {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

// Coordenada do lugar a partir da placeUrl do Maps. O formato das URLs de
// "place" guarda a coordenada no token data= como …!3d<lat>!4d<lng>… . Em
// algumas URLs aparece também /@lat,lng (mas numa busca /maps/search o /@ é o
// centro do mapa, não o lugar) — por isso o /@ só vale em URL de /maps/place/.
function coordsDaUrl(url) {
  const u = String(url || '');
  let m = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(u);          // place: data=…!3d!4d
  if (!m && /\/maps\/place\//.test(u)) m = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/.exec(u); // /@ só em /place/
  if (!m) return { lat: null, lng: null };
  const lat = Number(m[1]), lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  // Dentro do Brasil, senão ignora (evita gravar coordenada torta).
  if (lat < -34 || lat > 6 || lng < -74 || lng > -28) return { lat: null, lng: null };
  return { lat, lng };
}

// Endereço no padrão br: "Rua X, 123 - Bairro, Cidade - UF, CEP".
// Extrai uf, cidade e bairro no melhor esforço — serve para filtrar a lista.
function parseEndereco(end) {
  const out = { bairro: '', cidade: '', uf: '' };
  const t = s(end, 300);
  if (!t) return out;
  const mUf = /\b([A-Z]{2})\b(?:\s*,?\s*\d{5}-?\d{3})?\s*,?\s*(?:Brasil)?\s*$/.exec(t);
  if (mUf) out.uf = mUf[1];
  // "... - Cidade - UF"  => cidade é o trecho antes de " - UF"
  if (out.uf) {
    const antes = t.slice(0, mUf.index).replace(/[-,\s]+$/, '');
    const parts = antes.split(' - ');
    if (parts.length >= 2) out.cidade = parts[parts.length - 1].split(',').pop().trim();
    // bairro: trecho depois da primeira vírgula/numero e antes da cidade
    const mB = / - ([^-,]+),/.exec(t);
    if (mB) out.bairro = mB[1].trim();
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const corpo = await lerCorpo(req);
  const segredoOk = process.env.MERCADO_INGEST_SECRET;
  if (!segredoOk) return send(res, 500, { ok: false, error: 'MERCADO_INGEST_SECRET não configurado no servidor' });
  if (s(corpo.segredo, 200) !== segredoOk) return send(res, 401, { ok: false, error: 'Segredo inválido' });

  const estagioReq = s(corpo.estagio, 20).toLowerCase();
  const estagio = estagioReq === 'central' ? 'central' : 'coleta';

  const rows = Array.isArray(corpo.rows) ? corpo.rows : [];
  if (!rows.length) return send(res, 400, { ok: false, error: 'Nenhuma linha enviada (rows vazio)' });
  if (rows.length > 500) return send(res, 413, { ok: false, error: 'Lote grande demais (máx. 500 linhas)' });

  const limpos = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const place_key = s(r.place_key, 400);
    if (!place_key) continue; // sem chave de dedup não entra
    const place_url = s(r.place_url || r.placeUrl || r.href, 600);
    const { lat, lng } = coordsDaUrl(place_url);
    const endereco = s(r.endereco, 300);
    const p = parseEndereco(endereco);
    limpos.push({
      place_key,
      place_url,
      nome:           s(r.nome || r.cardName, 200),
      categoria:      s(r.categoria || r.CATEGORIA_MAPS, 160),
      tipo_local:     s(r.tipo_local, 120),
      telefone:       s(r.telefone || r.fone_maps || r.cardPhone, 60),
      endereco,
      bairro:         s(r.bairro || p.bairro, 120),
      cidade:         s(r.cidade || r.Cidade || p.cidade, 120),
      uf:             s(r.uf || p.uf, 2),
      lat, lng,
      site:           s(r.site || r.site_maps, 300),
      instagram_url:  s(r.instagram_url || r.instagramUrl, 300),
      instagram_user: s(r.instagram_user || r.igUsername, 120),
      seguidores:     inteiro(r.seguidores != null ? r.seguidores : r.SEGUIDORES),
      avaliacao:      num(r.avaliacao),
      num_avaliacoes: inteiro(r.num_avaliacoes),
      creci:          s(r.creci || r.CRECI, 60),
      status:         s(r.status, 60),
      estagio
    });
  }
  if (!limpos.length) return send(res, 400, { ok: false, error: 'Nenhuma linha com place_key válido' });

  const service = RHI.service();
  if (!service) return send(res, 500, { ok: false, error: 'RHI_SUPABASE_SERVICE_KEY não configurada no servidor' });

  const r = await fetch(`${RHI.url}/rest/v1/rpc/rhi_mercado_ingest`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_rows: limpos })
  }).catch(() => null);
  const data = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !data || data.ok !== true) {
    const msg = (data && (data.error || data.message || data.hint)) || (r ? `HTTP ${r.status}` : 'sem resposta');
    const falta = /rhi_mercado_ingest/.test(String(msg));
    return send(res, 502, { ok: false, error: falta ? 'Falta rodar o SQL MERCADO_MAPS_1 no projeto RHI' : msg });
  }
  return send(res, 200, { ok: true, recebidos: rows.length, validos: limpos.length, gravados: data.gravados, estagio });
}
