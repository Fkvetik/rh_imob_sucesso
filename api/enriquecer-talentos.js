// Vercel Function — enriquecimento automático de candidatos (Novos Talentos).
// Roda via cron (Vercel Cron chama sozinho) ou manualmente com ?token=.
// Usa ViaCEP (gratuito, dados oficiais dos Correios) para confirmar
// cidade/bairro/UF a partir do CEP do candidato — sem geocodificação por
// texto livre, que causava erro quando o bairro tinha nome igual em outra
// cidade (ex.: "Barra Funda" existe em Guarujá e em São Paulo capital).
// Só preenche o que está faltando; nunca sobrescreve dado já existente.
// Quando o CEP não bate com a cidade declarada, marca CEP_DIVERGENTE em vez
// de adivinhar — fica sinalizado para revisão manual.

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const LOTE_PADRAO = 40;
const CONCORRENCIA = 5;

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

    res.status(200).send(JSON.stringify({ ok: true, ...resumo, detalhes: resultados }));
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
