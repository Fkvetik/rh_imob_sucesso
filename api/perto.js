// GET /api/perto?lat=&lng=&raio=5   ou   /api/perto?cep=01310100&raio=5
// Página "Perto de mim": quantos Novos Talentos há no raio, por faixa de
// distância e agrupados em quadrados de ~1 km para o mapa (nt_perto, SQL
// GEO_2). Só números: nenhum dado de pessoa sai daqui.
// O ponto de quem consulta é arredondado (~1 km) antes de qualquer coisa —
// protege quem consulta, impede "varrer" a base ponto a ponto e deixa a
// resposta cacheável. Nada é guardado.
import { NT, COLETOR, RHI } from './_ext-comum.js';

const RAIOS = [1, 3, 5, 10, 20, 30];

function enviar(res, status, corpo, cacheSeg) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheSeg ? `public, s-maxage=${cacheSeg}, stale-while-revalidate=86400` : 'no-store');
  res.status(status).send(JSON.stringify(corpo));
}

async function pontoDoCep(cep) {
  const r = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`).catch((e) => ({ ok: false, status: 'rede: ' + e.message }));
  if (!r || !r.ok) { console.log('[perto] AwesomeAPI', cep, r && r.status); return null; }
  const d = await r.json().catch(() => null);
  const lat = Number(d && d.lat), lng = Number(d && d.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, rotulo: [d.district, d.city && d.state ? `${d.city}/${d.state}` : d.city].filter(Boolean).join(' · ') };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return enviar(res, 405, { ok: false, error: 'Use GET' });
  const q = req.query || {};
  const raioPedido = Number(q.raio) || 5;
  const raio = RAIOS.includes(raioPedido) ? raioPedido : 5;

  let lat = Number(q.lat), lng = Number(q.lng), rotulo = '';
  const cep = String(q.cep || '').replace(/\D/g, '');
  if (cep) {
    if (cep.length !== 8) return enviar(res, 400, { ok: false, error: 'CEP inválido. Use os 8 números.' });
    const p = await pontoDoCep(cep);
    if (!p) return enviar(res, 404, { ok: false, error: 'Não encontramos esse CEP. Confira os números.' });
    lat = p.lat; lng = p.lng; rotulo = p.rotulo;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -34 || lat > 6 || lng < -74 || lng > -28) {
    return enviar(res, 400, { ok: false, error: 'Localização fora do Brasil ou inválida.' });
  }
  lat = Math.round(lat * 100) / 100;
  lng = Math.round(lng * 100) / 100;

  const service = NT.service();
  if (!service) return enviar(res, 500, { ok: false, error: 'Configuração do servidor incompleta.' });

  const corpo = JSON.stringify({ p_lat: lat, p_lng: lng, p_raio_km: raio });
  const [r, rRede, rMerc] = await Promise.all([
    fetch(`${NT.url}/rest/v1/rpc/nt_perto`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: corpo
    }).catch(() => null),
    // Corretores e imobiliárias da Rede que informaram o CEP (REDE_GEO_1).
    fetch(`${COLETOR.url}/rest/v1/rpc/rpc_perto_parceiros`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: corpo
    }).catch(() => null),
    // Imobiliárias mapeadas no mercado (Google Maps) — contagem, sem nomes (MERCADO_MAPS).
    fetch(`${RHI.url}/rest/v1/rpc/rhi_mercado_perto`, {
      method: 'POST',
      headers: { apikey: RHI.anon, Authorization: `Bearer ${RHI.anon}`, 'Content-Type': 'application/json' },
      body: corpo
    }).catch(() => null)
  ]);
  const talentos = r ? await r.json().catch(() => null) : null;
  const parceiros = rRede && rRede.ok ? await rRede.json().catch(() => null) : null;
  const mercado = rMerc && rMerc.ok ? await rMerc.json().catch(() => null) : null;
  if (!r || !r.ok || !talentos) {
    console.log('[perto] nt_perto falhou', r && r.status, JSON.stringify(talentos).slice(0, 300));
    return enviar(res, 502, { ok: false, error: 'Não foi possível consultar agora. Tente de novo em instantes.' });
  }

  const imobOk = !!(mercado && mercado.ok && mercado.imobiliarias != null);
  const emBreve = ['lancamentos'];
  if (!parceiros) emBreve.push('corretores');
  if (!parceiros && !imobOk) emBreve.push('imobiliarias');
  return enviar(res, 200, {
    ok: true,
    centro: { lat, lng, rotulo },
    raio_km: raio,
    talentos,
    parceiros, // null enquanto o SQL REDE_GEO_1 não roda: a página mostra "em breve"
    mercado,   // imobiliárias mapeadas no Maps (só contagem); null se o SQL/coords ainda não rodaram
    em_breve: emBreve
  }, 1800);
}
