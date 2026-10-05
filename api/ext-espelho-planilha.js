// POST /api/ext-espelho-planilha  { token, lead }
// Cópia do lead na planilha mãe (Apps Script). Antes a extensão mandava
// direto para o Apps Script, sem senha nenhuma — qualquer pessoa com o
// endereço conseguia gravar na planilha. Agora:
//  - só passa lead de operador logado (token do Coletor);
//  - o "usuario" vem da sessão, não do que a extensão disser;
//  - o servidor manda junto um segredo (GAS_ESPELHO_SEGREDO) que o Apps
//    Script confere antes de gravar.
import { cors, send, lerCorpo, validarSessao } from './_ext-comum.js';

// Endereço atual do Apps Script. Pode ser trocado pela variável GAS_ESPELHO_URL.
const GAS_PADRAO = 'https://script.google.com/macros/s/AKfycbxRz1deVZQJrQUjWZn3VJumCHSyAyRVw8tFE5cPSsCWaozOVxiYIpLfnCmtiR-hQEaH_Q/exec';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const { token, lead } = await lerCorpo(req);
  const s = await validarSessao(token);
  if (!s.ok) return send(res, 401, { ok: false, error: s.error });

  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) return send(res, 400, { ok: false, error: 'Lead inválido' });
  if (JSON.stringify(lead).length > 60000) return send(res, 413, { ok: false, error: 'Lead grande demais' });

  const url = process.env.GAS_ESPELHO_URL || GAS_PADRAO;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action: 'mirror_lead', usuario: s.login, lead, segredo: process.env.GAS_ESPELHO_SEGREDO || '' }),
      redirect: 'follow'
    });
    return send(res, 200, { ok: r.ok, status: r.status });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e && e.message || e) });
  }
}
