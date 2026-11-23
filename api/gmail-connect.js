// Fase 3a — inicia a conexão do Gmail da empresa (OAuth). A ferramenta abre
// /api/gmail-connect?t=<token da sessão>; aqui conferimos o acesso e mandamos
// a conta pro consentimento do Google (escopo gmail.send). O refresh_token volta
// no /api/gmail-callback. Client ID/secret ficam só em env do Vercel.

import { COLETOR } from './_ext-comum.js';

const REDIRECT = 'https://www.rhimob.com.br/api/gmail-callback';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

export default async function handler(req, res) {
  const token = String(req.query.t || '').trim();
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  if (!CLIENT_ID) return res.status(500).send('Configuração do servidor incompleta (GOOGLE_CLIENT_ID).');
  if (!token) return res.status(400).send('Abra esta ferramenta pela extensão (sem token de sessão).');

  // Confere o token + acesso a e-mail antes de mandar pro Google.
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_email_config`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
    const cfg = await r.json().catch(() => null);
    if (!cfg || cfg.ok !== true) return res.status(401).send('Sessão inválida ou expirada. Entre de novo na extensão.');
    if (!cfg.email_acesso) return res.status(403).send('Esta conta ainda não tem o disparo de e-mail liberado. Fale com a RH IMOB.');
  } catch (e) {
    return res.status(502).send('Falha ao conferir a sessão.');
  }

  const url = 'https://accounts.google.com/o/oauth2/v2/auth'
    + '?client_id=' + encodeURIComponent(CLIENT_ID)
    + '&redirect_uri=' + encodeURIComponent(REDIRECT)
    + '&response_type=code'
    + '&access_type=offline'
    + '&prompt=consent'
    + '&include_granted_scopes=true'
    + '&scope=' + encodeURIComponent(SCOPES)
    + '&state=' + encodeURIComponent(token);

  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, url);
}
