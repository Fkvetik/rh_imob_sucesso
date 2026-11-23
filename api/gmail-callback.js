// Fase 3a — o Google volta aqui depois do consentimento. Troca o code por
// refresh_token, descobre o e-mail da conta e guarda no COLETOR (rpc_gmail_salvar),
// ligado ao login da sessão (state = token). Client secret só em env do Vercel.

import { COLETOR } from './_ext-comum.js';

const REDIRECT = 'https://www.rhimob.com.br/api/gmail-callback';

function pagina(titulo, msg, ok) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo}</title>
<style>body{font-family:system-ui,Arial;background:#f6f3fb;color:#1f1733;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border:1px solid #e6e1ef;border-radius:16px;padding:30px 34px;max-width:420px;text-align:center}
.ic{font-size:40px}.card h1{font-size:18px;margin:12px 0 6px}.card p{color:#6b6478;font-size:14px;line-height:1.6;margin:0}
.b{margin-top:18px;display:inline-block;background:#2b124d;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:800;font-size:14px;cursor:pointer}</style></head>
<body><div class="card"><div class="ic">${ok ? '✅' : '⚠️'}</div><h1>${titulo}</h1><p>${msg}</p>
<button class="b" onclick="window.close()">Fechar</button></div></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const code = String(req.query.code || '');
  const token = String(req.query.state || '');
  const erro = String(req.query.error || '');
  if (erro) return res.status(200).send(pagina('Conexão cancelada', 'Você não autorizou o Gmail. Pode tentar de novo pela ferramenta.', false));
  if (!code || !token) return res.status(400).send(pagina('Link inválido', 'Faltam dados do Google. Abra de novo a conexão pela ferramenta.', false));

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(500).send(pagina('Servidor incompleto', 'Faltam GOOGLE_CLIENT_ID/SECRET no Vercel.', false));

  // 1) code -> tokens
  let tk;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' })
    });
    tk = await r.json().catch(() => null);
    if (!r.ok || !tk) throw new Error((tk && (tk.error_description || tk.error)) || ('HTTP ' + r.status));
  } catch (e) {
    return res.status(502).send(pagina('Falha ao conectar', 'O Google não confirmou a conexão: ' + String(e.message || e), false));
  }
  if (!tk.refresh_token) {
    return res.status(200).send(pagina('Reconecte, por favor', 'O Google não devolveu a autorização permanente. Em myaccount.google.com → Segurança → apps com acesso, remova o acesso e conecte de novo.', false));
  }

  // 2) descobre o e-mail da conta
  let email = '';
  try {
    const u = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tk.access_token } });
    const ud = await u.json().catch(() => null);
    email = (ud && ud.email) || '';
  } catch (_) {}

  // 3) guarda ligado à conta da sessão
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_gmail_salvar`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_refresh: tk.refresh_token, p_email: email })
    });
    const sd = await r.json().catch(() => null);
    if (!sd || sd.ok !== true) throw new Error((sd && sd.error) || 'não foi possível salvar');
  } catch (e) {
    return res.status(502).send(pagina('Quase lá', 'Conectamos no Google, mas não deu pra salvar na sua conta: ' + String(e.message || e) + '. Tente de novo.', false));
  }

  return res.status(200).send(pagina('Gmail conectado!', 'Pronto — os e-mails vão sair de <b>' + (email || 'sua conta') + '</b>. Pode fechar esta aba e voltar para a ferramenta.', true));
}
