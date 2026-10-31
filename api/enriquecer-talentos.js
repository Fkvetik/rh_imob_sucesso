// Vercel Function — enriquecimento automático de candidatos (Novos Talentos).
// Roda via cron (Vercel Cron chama sozinho) ou manualmente com ?token=.
// Usa ViaCEP (gratuito, dados oficiais dos Correios) para confirmar
// cidade/bairro/UF a partir do CEP do candidato — sem geocodificação por
// texto livre, que causava erro quando o bairro tinha nome igual em outra
// cidade (ex.: "Barra Funda" existe em Guarujá e em São Paulo capital).
// Só preenche o que está faltando; nunca sobrescreve dado já existente.
// Quando o CEP não bate com a cidade declarada, marca CEP_DIVERGENTE em vez
// de adivinhar — fica sinalizado para revisão manual.

//
// 2ª etapa (GEO_1): coordenada pelo CEP para talento SEM latitude/longitude.
// Cada CEP é consultado uma vez (cache nt_geo_cep no banco); o banco grava em
// todos os talentos do mesmo CEP que estão sem coordenada. Nunca sobrescreve
// coordenada existente. Fonte: AwesomeAPI (ponto da rua do CEP); como ela
// limita os servidores da Vercel (429), a alternativa é ViaCEP (endereço) +
// OpenStreetMap/Nominatim (ponto da rua), no máximo 1 consulta por segundo.

export const config = { maxDuration: 60 };

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const LOTE_PADRAO = 40;
const CONCORRENCIA = 5;
const GEO_LOTE = 25;            // CEPs por execução (a cada 15 min)
const GEO_TEMPO_MAX_MS = 45000; // para de começar CEP novo perto do limite da função
const NOMINATIM_UA = 'RHIMOB-geocodificacao/1.0 (+https://www.rhimob.com.br)';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ADMIN_TOKEN = process.env.LEADS_ADMIN_TOKEN;
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!SERVICE_KEY) {
    res.status(500).send(JSON.stringify({ error: 'config', message: 'Falta SUPABASE_SERVICE_KEY na Vercel.' }));
    return;
  }

  const token = req.query.token || '';
  const authHeader = req.headers.authorization || '';
  const autorizadoManual = ADMIN_TOKEN && token === ADMIN_TOKEN;
  const autorizadoCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!autorizadoManual && !autorizadoCron) {
    res.status(401).send(JSON.stringify({ error: 'auth', message: 'Não autorizado.' }));
    return;
  }

  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || LOTE_PADRAO));
  const geoLimite = Math.min(100, Math.max(0, parseInt(req.query.geo, 10) || GEO_LOTE));
  const inicio = Date.now();

  try {
    const pendentes = await fetchPendentes(SERVICE_KEY, limit);
    const resultados = await processarEmLotes(pendentes, SERVICE_KEY, CONCORRENCIA);

    const resumo = { processados: resultados.length, confirmados: 0, divergentes: 0, sem_cep: 0, invalidos: 0, erros: 0 };
    resultados.forEach((r) => {
      if (r.status === 'CEP_CONFIRMADO') resumo.confirmados++;
      else if (r.status === 'CEP_DIVERGENTE') resumo.divergentes++;
      else if (r.status === 'SEM_CEP') resumo.sem_cep++;
      else if (r.status === 'CEP_INVALIDO') resumo.invalidos++;
      else resumo.erros++;
    });

    // Uma falha na etapa de coordenada não derruba a confirmação de CEP acima.
    let geo;
    try { geo = await coordenadasPorCep(SERVICE_KEY, geoLimite, inicio); }
    catch (e) { geo = { erro: String(e && e.message || e) }; }
    // Grade do "Perto de mim" (GEO_2c) refeita com as coordenadas novas.
    try { geo.grade = await rpcNT('nt_geo_grade_atualizar', {}, SERVICE_KEY); }
    catch (e) { geo.grade = 'erro: ' + e.message; }
    // Uma linha por execução nos logs da Vercel, para acompanhar sem abrir o banco.
    console.log('[enriquecer-talentos]', JSON.stringify({ ...resumo, geo }));

    res.status(200).send(JSON.stringify({ ok: true, ...resumo, geo, detalhes: resultados }));
  } catch (e) {
    res.status(500).send(JSON.stringify({ error: 'exception', message: String(e && e.message || e) }));
  }
}

async function fetchPendentes(serviceKey, limit) {
  const r = await fetch(
    `${SB_URL}/rest/v1/nt_talentos?select=talento_key,cep,cidade,estado_uf,bairro,geo_status` +
    `&or=(geo_status.is.null,geo_status.eq.PENDENTE)&order=updated_at.asc&limit=${limit}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!r.ok) throw new Error('Falha ao buscar pendentes: ' + r.status);
  return r.json();
}

async function processarEmLotes(rows, serviceKey, concorrencia) {
  const resultados = [];
  for (let i = 0; i < rows.length; i += concorrencia) {
    const fatia = rows.slice(i, i + concorrencia);
    const parciais = await Promise.all(fatia.map((row) => processarUm(row, serviceKey)));
    resultados.push(...parciais);
  }
  return resultados;
}

async function processarUm(row, serviceKey) {
  const cep8 = String(row.cep || '').replace(/\D/g, '');
  if (cep8.length !== 8) {
    await atualizar(row.talento_key, { geo_status: 'SEM_CEP' }, serviceKey);
    return { talento_key: row.talento_key, status: 'SEM_CEP' };
  }

  let via;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep8}/json/`);
    via = await r.json();
  } catch (e) {
    return { talento_key: row.talento_key, status: 'ERRO_REDE', erro: String(e && e.message || e) };
  }

  if (!via || via.erro || !via.localidade) {
    await atualizar(row.talento_key, { geo_status: 'CEP_INVALIDO' }, serviceKey);
    return { talento_key: row.talento_key, status: 'CEP_INVALIDO' };
  }

  const cidadeDeclarada = normalizar(row.cidade);
  const cidadeCep = normalizar(via.localidade);
  const bate = !cidadeDeclarada || cidadeDeclarada === cidadeCep;

  if (!bate) {
    await atualizar(row.talento_key, {
      geo_status: 'CEP_DIVERGENTE',
      geo_fonte: 'VIACEP_DIVERGENTE'
    }, serviceKey);
    return { talento_key: row.talento_key, status: 'CEP_DIVERGENTE', cidade_declarada: row.cidade, cidade_cep: via.localidade };
  }

  const patch = { geo_status: 'CEP_CONFIRMADO', geo_fonte: 'VIACEP' };
  if (!row.cidade && via.localidade) patch.cidade = via.localidade;
  if (!row.estado_uf && via.uf) patch.estado_uf = via.uf;
  if (!row.bairro && via.bairro) patch.bairro = via.bairro;

  await atualizar(row.talento_key, patch, serviceKey);
  return { talento_key: row.talento_key, status: 'CEP_CONFIRMADO' };
}

// ── 2ª etapa: coordenada pelo CEP ──────────────────────────────────────
async function rpcNT(nome, corpo, serviceKey) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${nome}: ${(data && (data.message || data.hint)) || 'HTTP ' + r.status}`);
  return data;
}

async function coordenadasPorCep(serviceKey, limite, inicio) {
  const resumo = { ceps: 0, achados: 0, nao_achados: 0, talentos_preenchidos: 0, parou: null };
  if (!limite) return resumo;
  let pendentes;
  try {
    pendentes = await rpcNT('nt_geo_ceps_pendentes', { p_limite: limite }, serviceKey);
  } catch (e) {
    resumo.parou = 'Falta rodar o SQL GEO_1 no Novos Talentos (' + e.message + ')';
    return resumo;
  }
  // Um CEP por vez: a alternativa (Nominatim) aceita 1 consulta por segundo.
  let awesomeBloqueada = false;
  for (const p of pendentes) {
    if (Date.now() - inicio > GEO_TEMPO_MAX_MS) { resumo.parou = 'tempo'; break; }
    let x = awesomeBloqueada ? { status: 'LIMITE' } : await consultarCep(p.cep);
    if (x.status === 'LIMITE') { awesomeBloqueada = true; x = await consultarCepOSM(p.cep); }
    // Fora do ar ou limitado nas duas fontes: não marca nada, tenta na próxima execução.
    if (x.status === 'LIMITE') { resumo.parou = 'limite das APIs de CEP'; break; }
    if (x.status === 'ERRO') continue;
    const n = await rpcNT('nt_geo_aplicar', {
      p_cep: p.cep, p_status: x.status, p_lat: x.lat ?? null, p_lng: x.lng ?? null,
      p_fonte: x.fonte || 'AWESOMEAPI', p_cidade: x.cidade || null, p_uf: x.uf || null, p_bairro: x.bairro || null
    }, serviceKey);
    resumo.ceps++;
    if (x.status === 'OK') { resumo.achados++; resumo.talentos_preenchidos += Number(n) || 0; }
    else resumo.nao_achados++;
  }
  return resumo;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Alternativa: endereço do CEP no ViaCEP e ponto da rua no Nominatim. CEP
// sem rua (CEP geral de cidade pequena) fica com o ponto da cidade.
async function consultarCepOSM(cep) {
  let via;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (r.status === 429 || r.status >= 500) return { status: 'LIMITE' };
    via = await r.json();
  } catch (e) { return { status: 'ERRO' }; }
  if (!via || via.erro || !via.localidade) return { status: 'NAO_ACHADO', fonte: 'VIACEP' };

  const tentativas = [];
  if (via.logradouro) tentativas.push({ street: via.logradouro, city: via.localidade, state: via.uf, fonte: 'NOMINATIM_RUA' });
  tentativas.push({ city: via.localidade, state: via.uf, fonte: 'NOMINATIM_CIDADE' });
  for (const t of tentativas) {
    const qs = new URLSearchParams({ country: 'Brasil', format: 'json', limit: '1', city: t.city, state: t.state });
    if (t.street) qs.set('street', t.street);
    await esperar(1100); // regra de uso do Nominatim: no máximo 1 por segundo
    let r;
    try { r = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: { 'User-Agent': NOMINATIM_UA, 'Accept-Language': 'pt-BR' } }); }
    catch (e) { return { status: 'ERRO' }; }
    if (r.status === 429 || r.status >= 500) return { status: 'LIMITE' };
    const d = await r.json().catch(() => null);
    const lat = Number(d && d[0] && d[0].lat), lng = Number(d && d[0] && d[0].lon);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -34 && lat <= 6 && lng >= -74 && lng <= -28) {
      return { status: 'OK', lat, lng, cidade: via.localidade, uf: via.uf, bairro: via.bairro, fonte: t.fonte };
    }
  }
  return { status: 'NAO_ACHADO', fonte: 'NOMINATIM' };
}

// { status: 'OK', lat, lng, cidade, uf, bairro } | { status: 'NAO_ACHADO' | 'LIMITE' | 'ERRO' }
async function consultarCep(cep) {
  let r;
  try { r = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`); }
  catch (e) { return { status: 'ERRO' }; }
  if (r.status === 429 || r.status >= 500) return { status: 'LIMITE' };
  if (r.status === 404 || r.status === 400) return { status: 'NAO_ACHADO' };
  if (!r.ok) return { status: 'ERRO' };
  const d = await r.json().catch(() => null);
  const lat = Number(d && d.lat), lng = Number(d && d.lng);
  const valido = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -34 && lat <= 6 && lng >= -74 && lng <= -28;
  if (!valido) return { status: 'NAO_ACHADO' };
  return { status: 'OK', lat, lng, cidade: d.city, uf: d.state, bairro: d.district };
}

function normalizar(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

async function atualizar(talentoKey, patch, serviceKey) {
  patch.updated_at = new Date().toISOString();
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal'
  };
  await fetch(`${SB_URL}/rest/v1/nt_talentos?talento_key=eq.${encodeURIComponent(talentoKey)}`, {
    method: 'PATCH', headers, body: JSON.stringify(patch)
  });

  const patchPublico = {};
  if (patch.cidade) patchPublico.cidade = patch.cidade;
  if (patch.estado_uf) patchPublico.estado_uf = patch.estado_uf;
  if (patch.bairro) patchPublico.bairro = patch.bairro;
  if (Object.keys(patchPublico).length) {
    patchPublico.updated_at = patch.updated_at;
    await fetch(`${SB_URL}/rest/v1/nt_talentos_publicos?talento_key=eq.${encodeURIComponent(talentoKey)}`, {
      method: 'PATCH', headers, body: JSON.stringify(patchPublico)
    });
  }
}
