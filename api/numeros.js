// GET /api/numeros — totais ao vivo da RH IMOB para a apresentação e o site.
//  talentos:   Novos Talentos ativos na vitrine (mesma conta do /api/planos-publicos)
//  creci:      corretores com CRECI na base do Corretores CRECI (leads_publicos)
//  rede:       parceiros da Rede com site publicado (rpc_numeros_rede, REDE_GEO_1)
// Cada número é independente: se um banco não responder, ele vem null e a
// página mostra só os outros. Cache de 1 hora.
import { NT, RHI, COLETOR } from './_ext-comum.js';

const PRODUTO = 'NOVOS_TALENTOS';

async function contar(url, chave) {
  if (!chave) return null;
  const r = await fetch(url, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, Prefer: 'count=exact', Range: '0-0' }
  }).catch(() => null);
  if (!r || !(r.ok || r.status === 206)) return null;
  const n = Number(String(r.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  const [talentos, creci, rede] = await Promise.all([
    contar(`${NT.url}/rest/v1/nt_talentos_publicos?select=talento_key&ativo=eq.true&produto_codigo=eq.${PRODUTO}`, NT.service()),
    contar(`${RHI.url}/rest/v1/leads_publicos?select=*`, RHI.service()),
    fetch(`${COLETOR.url}/rest/v1/rpc/rpc_numeros_rede`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: '{}'
    }).then(r => (r.ok ? r.json() : null)).catch(() => null)
  ]);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(JSON.stringify({ ok: true, talentos, creci, rede, em: new Date().toISOString() }));
}
