// Notificação no celular (Web Push), sem biblioteca: assinatura VAPID (ES256)
// e conteúdo cifrado em aes128gcm (RFC 8291). Arquivo com "_": não vira rota.
//
// Variáveis na Vercel (nunca no repositório):
//   VAPID_PRIVATE  chave privada (o par da pública que está no painel-app.js)
//   PUSH_SEGREDO   segredo que o banco confere (o banco guarda só o hash)
import crypto from 'node:crypto';
import { COLETOR } from './_ext-comum.js';

export const VAPID_PUBLICA = 'BMhNAWQnrly9bINXw91o9dgVb223-AHFTas0NlcYDfcjiuSEE1PdiCieZ4IQANkzbv8AUCQPq3ZqGAepbGhALbU';
const CONTATO = 'mailto:contato@rhimob.com.br';

const b64u = buf => Buffer.from(buf).toString('base64url');
const deB64u = s => Buffer.from(String(s || ''), 'base64url');

function chavePrivada() {
  const d = process.env.VAPID_PRIVATE;
  if (!d) return null;
  const pub = deB64u(VAPID_PUBLICA);
  return crypto.createPrivateKey({ format: 'jwk', key: {
    kty: 'EC', crv: 'P-256', d, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
}

function vapid(endpoint, chave) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const corpo = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTATO }));
  const ass = crypto.sign('sha256', Buffer.from(`${cab}.${corpo}`), { key: chave, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${cab}.${corpo}.${b64u(ass)}, k=${VAPID_PUBLICA}`;
}

// RFC 8291: cifra o texto para o aparelho (p256dh + auth da inscrição).
// sal e chave efêmera podem vir de fora só para teste.
export function cifrar(texto, p256dh, auth, teste = {}) {
  const uaPub = deB64u(p256dh), segredoAuth = deB64u(auth);
  const ecdh = crypto.createECDH('prime256v1');
  if (teste.privada) ecdh.setPrivateKey(teste.privada); else ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const comum = ecdh.computeSecret(uaPub);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', comum, segredoAuth,
    Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32));
  const sal = teste.sal || crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const cifrado = Buffer.concat([c.update(Buffer.concat([Buffer.from(texto), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([sal, rs, Buffer.from([asPub.length]), asPub, cifrado]);
}

async function rpc(nome, corpo) {
  const r = await fetch(`${COLETOR.url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });
  return r.json().catch(() => null);
}

// Pega os avisos ainda não entregues e manda para cada aparelho inscrito.
// Devolve { ok, enviados, falhas } (ok: false quando falta configurar).
export async function enviarPendentes() {
  const segredo = process.env.PUSH_SEGREDO, chave = chavePrivada();
  if (!segredo || !chave) return { ok: false, motivo: 'faltam VAPID_PRIVATE e PUSH_SEGREDO na Vercel' };
  const d = await rpc('rpc_push_pendentes', { p_segredo: segredo });
  if (!d || !d.ok) return { ok: false, motivo: 'banco recusou (REDE_5 rodado? segredo certo?)' };
  let enviados = 0, falhas = 0;
  await Promise.all((d.envios || []).map(async e => {
    try {
      const corpo = cifrar(JSON.stringify({ titulo: e.titulo, texto: e.texto, url: e.url, n: e.nao_lidos }), e.p256dh, e.auth);
      const r = await fetch(e.endpoint, {
        method: 'POST',
        headers: { Authorization: vapid(e.endpoint, chave), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
                   TTL: '86400', Urgency: 'high' },
        body: corpo,
        signal: AbortSignal.timeout(8000)
      });
      if (r.status === 404 || r.status === 410) { await rpc('rpc_push_remover', { p_segredo: segredo, p_endpoint: e.endpoint }); falhas++; }
      else if (r.ok) enviados++;
      else falhas++;
    } catch { falhas++; }
  }));
  return { ok: true, enviados, falhas };
}
