// POST /api/mercado-conhecidos  { keys:[...], fones:[...] }
//
// A extensão coletora do Maps pergunta, antes de mandar um lugar para a
// planilha (CENTRAL), se ele JÁ está na base "Mercado por região" — para não
// recoletar e reenriquecer o que já existe.
//   keys  = par 0x..:0x.. do lugar no link do Maps
//   fones = telefone só com dígitos (10 ou 11), sem o 55
// Resposta: { ok, keys:[os que já existem], fones:[os que já existem] }.
//
// Só devolve, do que foi PERGUNTADO, o que existe: nenhum telefone ou dado da
// base sai daqui. A chave do banco fica só no servidor.
import { RHI } from './_ext-comum.js';

const MAX = 400;          // itens por pedido (cada lista)
const POR_MIN = 60;       // pedidos por minuto por IP

function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(status).send(JSON.stringify(obj));
}

function lerCorpo(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse(typeof req.body === 'string' ? req.body : '{}'); } catch { return {}; }
}

function rateOk(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const agora = Date.now();
  const hits = (global.__mercConhHits = global.__mercConhHits || new Map());
  const lista = (hits.get(ip) || []).filter(t => agora - t < 60000);
  lista.push(agora);
  hits.set(ip, lista);
  return lista.length <= POR_MIN;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });
  if (!rateOk(req)) return send(res, 429, { ok: false, error: 'Muitas consultas, aguarde um pouco' });

  const corpo = lerCorpo(req);
  const lista = v => (Array.isArray(v) ? v : []).slice(0, MAX).map(x => String(x || '').trim().toLowerCase());
  const keys = [...new Set(lista(corpo.keys).filter(k => /^0x[0-9a-f]{1,20}:0x[0-9a-f]{1,20}$/.test(k)))];
  const fones = [...new Set(lista(corpo.fones).filter(f => /^[0-9]{10,11}$/.test(f)))];
  if (!keys.length && !fones.length) return send(res, 200, { ok: true, keys: [], fones: [] });

  const service = RHI.service();
  if (!service) return send(res, 500, { ok: false, error: 'Chave de serviço não configurada' });
  try {
    const r = await fetch(`${RHI.url}/rest/v1/rpc/rhi_mercado_ja_tem`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_keys: keys, p_fones: fones })
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) {
      console.log('[mercado-conhecidos] RPC falhou', r.status, JSON.stringify(d).slice(0, 200));
      return send(res, 502, { ok: false, error: 'Consulta ao banco falhou (falta rodar o SQL MERCADO_MAPS_8?)' });
    }
    return send(res, 200, { ok: true, keys: d.keys || [], fones: d.fones || [] });
  } catch (e) {
    return send(res, 502, { ok: false, error: 'Banco indisponível' });
  }
}
