// POST /api/ext-mercado-ingest  { token, estagio, rows:[...] }
//
// Porta AUTENTICADA pela qual a extensão RH Aceleradora (navegador do operador)
// alimenta a base "Mercado por região" enquanto o operador navega no Google Maps.
// Diferente do /api/mercado-ingest (que usa um segredo servidor-a-servidor do
// Apps Script), aqui a autorização é o TOKEN de sessão do próprio operador:
//   - valida o token no COLETOR (mesmo login da ferramenta);
//   - a chave de serviço do RHI fica SÓ no servidor (nunca no cliente);
//   - grava no mesmo rhi_mercado_maps (RPC rhi_mercado_ingest), com dedup por
//     place_key e o filtro de "só ramo imobiliário".
// estagio: 'central' (parcial, o card do Maps) | 'coleta' (completo, enriquecido).
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
function s(v, max) {
  const t = (v == null ? '' : String(v)).trim();
  return t ? t.slice(0, max || 300) : '';
}
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function inteiro(v) { const n = num(v); return n == null ? null : Math.round(n); }

// Só ramo imobiliário entra no banco (confere nome + categoria + tipo_local).
function ehImovel(r) {
  const base = [r.nome, r.categoria, r.tipo_local, r.CATEGORIA_INSTAGRAM, r.categoria_instagram]
    .join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return /(imobiliar|imove|corretor|corretag|agente imobil|consultor(a)? imobil|real estate|incorporador|loteador|administr\w* de imove|habitacional)/.test(base);
}
// Coordenada a partir da placeUrl do Maps (…!3d<lat>!4d<lng>… ou /@ só em /place/).
function coordsDaUrl(url) {
  const u = String(url || '');
  let m = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(u);
  if (!m && /\/maps\/place\//.test(u)) m = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/.exec(u);
  if (!m) return { lat: null, lng: null };
  const lat = Number(m[1]), lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  if (lat < -34 || lat > 6 || lng < -74 || lng > -28) return { lat: null, lng: null };
  return { lat, lng };
}
// "Rua X, 123 - Bairro, Cidade - UF, CEP" → bairro/cidade/uf (melhor esforço).
function parseEndereco(end) {
  const out = { bairro: '', cidade: '', uf: '' };
  const t = s(end, 300);
  if (!t) return out;
  const mUf = /\b([A-Z]{2})\b(?:\s*,?\s*\d{5}-?\d{3})?\s*,?\s*(?:Brasil)?\s*$/.exec(t);
  if (mUf) out.uf = mUf[1];
  if (out.uf) {
    const antes = t.slice(0, mUf.index).replace(/[-,\s]+$/, '');
    const parts = antes.split(' - ');
    if (parts.length >= 2) out.cidade = parts[parts.length - 1].split(',').pop().trim();
    const mB = / - ([^-,]+),/.exec(t);
    if (mB) out.bairro = mB[1].trim();
  }
  return out;
}

// Chave ESTÁVEL do lugar, pra o card (central) e o lugar aberto (coleta) do
// MESMO lugar virarem UM registro só. Prioriza o ftid (!1s0x..:0x..), depois a
// coordenada (!3d!4d), depois o nome no /place/<nome>/. Sem isso, a URL inteira
// (do card) difere da URL do lugar aberto e o mesmo lugar contava 2×.
function canonPlaceKey(url) {
  const u = String(url || '');
  let m = u.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i); if (m) return m[1].toLowerCase();
  m = u.match(/!3d(-?\d[\d.]+)!4d(-?\d[\d.]+)/); if (m) return m[1] + ',' + m[2];
  m = u.match(/\/maps\/place\/([^/@]+)/); if (m) { try { return decodeURIComponent(m[1]).toLowerCase(); } catch (_) { return m[1].toLowerCase(); } }
  return u.split('?')[0];
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const corpo = await lerCorpo(req);

  // 1) autoriza pelo token de sessão do operador (mesmo login da ferramenta)
  const token = s(corpo.token, 200);
  const sessao = await validarSessao(token);
  if (!sessao || sessao.ok !== true) return send(res, 401, { ok: false, error: (sessao && sessao.error) || 'Sessão inválida ou expirada' });
  const login = s(sessao.login, 120);

  const estagioReq = s(corpo.estagio, 20).toLowerCase();
  const estagio = estagioReq === 'coleta' ? 'coleta' : 'central';

  const rows = Array.isArray(corpo.rows) ? corpo.rows : [];
  if (!rows.length) return send(res, 400, { ok: false, error: 'Nenhuma linha enviada (rows vazio)' });
  if (rows.length > 500) return send(res, 413, { ok: false, error: 'Lote grande demais (máx. 500 linhas)' });

  const limpos = [];
  let filtrados = 0;
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const place_url = s(r.place_url || r.placeUrl || r.href, 600);
    const place_key = (s(r.place_key, 400) || canonPlaceKey(place_url)).slice(0, 400); // chave estável (card e lugar aberto = 1 só)
    if (!place_key) continue;
    const { lat, lng } = coordsDaUrl(place_url);
    const endereco = s(r.endereco, 300);
    const p = parseEndereco(endereco);
    const obj = {
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
      estagio,
      CATEGORIA_INSTAGRAM: s(r.CATEGORIA_INSTAGRAM, 160)
    };
    if (!ehImovel(obj)) { filtrados++; continue; }
    delete obj.CATEGORIA_INSTAGRAM;
    limpos.push(obj);
  }
  if (!limpos.length) {
    return send(res, 200, { ok: true, login, recebidos: rows.length, validos: 0, gravados: 0, filtrados, estagio, aviso: 'Nenhuma linha do ramo imobiliário no lote' });
  }

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

  // Marca QUEM coletou (pro operador ver TUDO que coletou + CSV + "completar
  // faltantes"). É AWAIT de propósito: sem esperar, o serverless devolve a
  // resposta e congela antes de gravar — e a prévia do operador vinha incompleta.
  // Não quebra o ingest se o SQL MERCADO_MAPS_10 ainda não tiver sido rodado.
  if (login) {
    try {
      await fetch(`${RHI.url}/rest/v1/rpc/rhi_mercado_registrar_coleta`, {
        method: 'POST',
        headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_place_keys: limpos.map(o => o.place_key), p_login: login })
      });
    } catch (_) {}
  }

  return send(res, 200, { ok: true, login, recebidos: rows.length, validos: limpos.length, filtrados, gravados: data.gravados, estagio });
}
