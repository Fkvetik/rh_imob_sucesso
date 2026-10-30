// Contatos do site (WhatsApp e e-mail), editados no admin → "Contatos do site".
// Ficam no Coletor (SQL CONFIG_1, tabela site_config). Arquivo com "_" na
// frente: o Vercel não publica como rota.
//
// PADRAO é o reserva: vale enquanto o banco não responde (ou antes do SQL).
import { COLETOR } from './_ext-comum.js';

export const PADRAO = {
  wa_vagas: '5511953973268',
  wa_leiloes: '5511953973268',
  wa_empresas: '5511978725515',
  wa_rede: '5511978725515',
  wa_parceria: '5511953973268',
  email: 'contato@rhimob.com.br'
};

let cache = null, cacheEm = 0;

export async function contatos() {
  if (cache && Date.now() - cacheEm < 5 * 60 * 1000) return cache;
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_site_config`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(2500)
    });
    const d = await r.json();
    if (d && d.ok && d.config) {
      cache = { ...PADRAO, ...d.config };
      cacheEm = Date.now();
      return cache;
    }
  } catch (_) {}
  return cache || PADRAO;
}
