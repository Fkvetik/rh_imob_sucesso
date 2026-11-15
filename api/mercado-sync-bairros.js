// POST /api/mercado-sync-bairros  { senha, fase, offset?, apos? }
//
// Leva o "mapa de bairros" do Novos Talentos (nt_mapa_bairros: cidade, bairro,
// região, micro-região, coordenada) para o banco dos Corretores
// (rhi_mapa_bairros) e, em seguida, marca a região dos lugares do Mercado por
// região (SQL MERCADO_MAPS_9). Quem chama é o botão do admin, em passos curtos:
//   fase "copiar"  : copia um bloco de bairros a partir de `offset`
//                    -> { copiados, proximo (offset seguinte ou null) }
//   fase "marcar"  : marca um lote de lugares a partir de `apos`
//                    -> { feitos, ultima, total, com_regiao, por_fonte }
// Só o administrador da RH IMOB (mesma senha do painel) executa. As chaves de
// serviço dos dois bancos ficam só aqui no servidor.
import { COLETOR, NT, RHI } from './_ext-comum.js';

const BLOCO = 1000;

function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(obj));
}
function lerCorpo(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse(typeof req.body === 'string' ? req.body : '{}'); } catch { return {}; }
}
async function adminGeral(senha) {
  if (!senha || typeof senha !== 'string' || senha.length > 200) return false;
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_admin_verificar_senha`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_admin_password: senha, p_login: null })
    });
    const d = await r.json().catch(() => null);
    // admin de empresa cliente (tem conta vinculada) não mexe na base geral
    return !!(r.ok && d && d.ok === true && !d.conta_id_plataforma);
  } catch { return false; }
}
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const txt = v => { const t = String(v == null ? '' : v).trim(); return t || null; };

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });
  const corpo = lerCorpo(req);
  if (!(await adminGeral(corpo.senha))) return send(res, 401, { ok: false, error: 'Só o administrador da RH IMOB executa esta sincronização.' });

  const ntKey = NT.service(), rhiKey = RHI.service();
  if (!ntKey || !rhiKey) return send(res, 500, { ok: false, error: 'Chaves de serviço não configuradas no servidor' });
  const hNt = { apikey: ntKey, Authorization: `Bearer ${ntKey}` };
  const hRhi = { apikey: rhiKey, Authorization: `Bearer ${rhiKey}`, 'Content-Type': 'application/json' };

  try {
    if (corpo.fase === 'copiar') {
      const offset = Math.max(0, parseInt(corpo.offset, 10) || 0);
      const cols = 'mapa_key,cidade,estado_uf,bairro,regiao_macro,micro_regiao,latitude,longitude';
      const r = await fetch(`${NT.url}/rest/v1/nt_mapa_bairros?select=${cols}&order=mapa_key.asc&offset=${offset}&limit=${BLOCO}`, { headers: hNt });
      const linhas = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(linhas)) return send(res, 502, { ok: false, error: 'Não consegui ler o mapa de bairros do Novos Talentos (HTTP ' + r.status + ')' });
      const limpas = linhas.filter(l => l && l.mapa_key).map(l => ({
        mapa_key: String(l.mapa_key), cidade: txt(l.cidade), estado_uf: txt(l.estado_uf), bairro: txt(l.bairro),
        regiao_macro: txt(l.regiao_macro), micro_regiao: txt(l.micro_regiao), latitude: num(l.latitude), longitude: num(l.longitude)
      }));
      if (limpas.length) {
        const w = await fetch(`${RHI.url}/rest/v1/rhi_mapa_bairros?on_conflict=mapa_key`, {
          method: 'POST',
          headers: { ...hRhi, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(limpas)
        });
        if (!w.ok) {
          const t = await w.text().catch(() => '');
          return send(res, 502, { ok: false, error: 'Não consegui gravar no banco dos Corretores (falta rodar o SQL MERCADO_MAPS_9?) — ' + t.slice(0, 160) });
        }
      }
      return send(res, 200, { ok: true, copiados: limpas.length, proximo: linhas.length === BLOCO ? offset + BLOCO : null });
    }

    if (corpo.fase === 'marcar') {
      const r = await fetch(`${RHI.url}/rest/v1/rpc/rhi_mercado_reclassificar`, {
        method: 'POST', headers: hRhi,
        body: JSON.stringify({ p_limite: 1500, p_apos: txt(corpo.apos) })
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.ok !== true) return send(res, 502, { ok: false, error: 'Não consegui marcar as regiões (falta rodar o SQL MERCADO_MAPS_9?)' });
      return send(res, 200, d);
    }

    return send(res, 400, { ok: false, error: 'fase inválida (use "copiar" ou "marcar")' });
  } catch (e) {
    return send(res, 502, { ok: false, error: 'Falha: ' + String((e && e.message) || e).slice(0, 160) });
  }
}
