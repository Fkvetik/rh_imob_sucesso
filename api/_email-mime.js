// Peças comuns de e-mail (montagem MIME + personalização). Usado pelo envio
// direto (teste) e pelo cron da fila. Arquivo "_" não vira rota no Vercel.

export function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
export function saudacao() { const h = new Date(Date.now() - 3 * 3600 * 1000).getUTCHours(); return h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite'); }
export function trocar(txt, v) {
  return String(txt || '').replace(/\{nome\}|\{cidade\}|\{cargo\}|\{saudacao\}|\{empresa\}|\{remetente\}/g, m => v[m.slice(1, -1)] ?? '');
}
export function corpoComRodape(html) {
  const foot = `<hr style="border:none;border-top:1px solid #eee;margin:22px 0 10px">
<p style="font-size:11px;color:#999;line-height:1.5">Você recebeu este e-mail porque disponibilizou seu contato para receber oportunidades. Para não receber mais, responda esta mensagem com <b>SAIR</b>.</p>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">${html}${foot}</div>`;
}
function b64(str) { return Buffer.from(str, 'utf8').toString('base64'); }
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function encAssunto(s) { return '=?UTF-8?B?' + b64(String(s || '')) + '?='; }

// Monta a mensagem MIME e devolve em base64url (formato que a Gmail API espera).
export function montarMime({ de, nomeDe, para, assunto, html, anexos }) {
  const bnd = 'rhimob_' + Math.random().toString(36).slice(2);
  const temAnexo = anexos && anexos.length;
  const fromHdr = nomeDe ? `${encAssunto(nomeDe)} <${de}>` : de;
  let m = '';
  m += `From: ${fromHdr}\r\n`;
  m += `To: ${para}\r\n`;
  m += `Subject: ${encAssunto(assunto)}\r\n`;
  m += `MIME-Version: 1.0\r\n`;
  m += `List-Unsubscribe: <mailto:${de}?subject=SAIR>\r\n`;
  if (temAnexo) {
    m += `Content-Type: multipart/mixed; boundary="${bnd}"\r\n\r\n`;
    m += `--${bnd}\r\n`;
    m += `Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(html)}\r\n`;
    for (const a of anexos) {
      const nome = String(a.nome || 'anexo').replace(/[\r\n"]/g, '');
      const tipo = String(a.tipo || 'application/octet-stream').replace(/[\r\n]/g, '');
      const dados = String(a.b64 || '').replace(/\s+/g, '');
      m += `--${bnd}\r\n`;
      m += `Content-Type: ${tipo}; name="${encAssunto(nome)}"\r\n`;
      m += `Content-Transfer-Encoding: base64\r\n`;
      m += `Content-Disposition: attachment; filename="${encAssunto(nome)}"\r\n\r\n`;
      m += dados.replace(/(.{76})/g, '$1\r\n') + `\r\n`;
    }
    m += `--${bnd}--`;
  } else {
    m += `Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(html)}`;
  }
  return b64url(Buffer.from(m, 'utf8'));
}

// refresh_token -> access_token (Gmail API)
export async function accessTokenDoRefresh(refresh) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || !d.access_token) throw new Error((d && (d.error_description || d.error)) || ('HTTP ' + r.status));
  return d.access_token;
}

// Envia UMA mensagem já montada (raw base64url) pela Gmail API.
export async function enviarRaw(accessToken, raw) {
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw })
  });
  if (!r.ok) { const e = await r.json().catch(() => null); throw new Error((e && e.error && e.error.message) || ('HTTP ' + r.status)); }
  return true;
}
