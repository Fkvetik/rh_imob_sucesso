// Fase 3b — envia um LOTE de e-mails pela conta Gmail conectada (Gmail API).
// A página chama em lotes pequenos (ritmo + evita timeout). Confere acesso,
// limite/dia, personaliza por talento, anexa e registra o uso.
//
// POST {
//   token, assunto, corpoHtml, remetente, empresa,
//   anexos: [{ nome, tipo, b64 }],         // mesmos anexos pra todos
//   destinatarios: [{ nome, email, cidade, cargo }]
// } -> { ok, enviados, falhas:[{email,erro}], limite_dia, enviados_hoje }

import { cors, send, lerCorpo, COLETOR } from './_ext-comum.js';

export const config = { maxDuration: 60 };

const LOTE_MAX = 25; // teto por chamada (a página manda em lotes)

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' });
  const body = await lerCorpo(req);
  const token = String(body.token || '').trim();
  const assunto = String(body.assunto || '').trim();
  const corpoHtml = String(body.corpoHtml || '');
  const remetente = String(body.remetente || '');
  const empresa = String(body.empresa || '');
  const anexos = Array.isArray(body.anexos) ? body.anexos.slice(0, 5) : [];
  let destinatarios = Array.isArray(body.destinatarios) ? body.destinatarios : [];

  if (!assunto || !corpoHtml) return send(res, 400, { ok: false, error: 'Assunto e mensagem são obrigatórios.' });
  if (!destinatarios.length) return send(res, 400, { ok: false, error: 'Nenhum destinatário.' });

  // 1) Confere acesso + pega o refresh_token (server-side).
  let cfg;
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_gmail_para_envio`, {
      method: 'POST', headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
    cfg = await r.json().catch(() => null);
  } catch (e) { return send(res, 502, { ok: false, error: 'Falha ao conferir a conta.' }); }
  if (!cfg || cfg.ok !== true) return send(res, 401, { ok: false, error: (cfg && cfg.error) || 'Sessão inválida.' });

  const limite = cfg.limite_dia || 100;
  const jaHoje = cfg.enviados_hoje || 0;
  const restante = Math.max(0, limite - jaHoje);
  if (restante <= 0) return send(res, 429, { ok: false, error: `Limite diário de ${limite} e-mails já atingido.`, limite_dia: limite, enviados_hoje: jaHoje });

  // Respeita o que falta do dia e o teto por chamada.
  destinatarios = destinatarios.slice(0, Math.min(LOTE_MAX, restante));

  // 2) refresh_token -> access_token
  let accessToken;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: cfg.refresh_token, grant_type: 'refresh_token' })
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d || !d.access_token) throw new Error((d && (d.error_description || d.error)) || 'sem access_token');
    accessToken = d.access_token;
  } catch (e) {
    return send(res, 502, { ok: false, error: 'O Gmail precisa ser reconectado: ' + String(e.message || e), reconectar: true });
  }

  const de = cfg.gmail_email;
  const nomeDe = cfg.nome_operador || empresa || '';
  const falhas = [];
  let enviados = 0;

  for (const d of destinatarios) {
    if (!d || !d.email || !String(d.email).includes('@')) { falhas.push({ email: (d && d.email) || '?', erro: 'e-mail inválido' }); continue; }
    try {
      const vars = {
        nome: primeiroNome(d.nome), cidade: d.cidade || '', cargo: d.cargo || '',
        saudacao: saudacao(), empresa: empresa, remetente: remetente
      };
      const raw = montarMime({
        de, nomeDe, para: d.email,
        assunto: trocar(assunto, vars),
        html: corpoComRodape(trocar(corpoHtml, vars), d.email),
        anexos
      });
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw })
      });
      if (!r.ok) { const e = await r.json().catch(() => null); throw new Error((e && e.error && e.error.message) || ('HTTP ' + r.status)); }
      enviados++;
    } catch (e) {
      falhas.push({ email: d.email, erro: String(e.message || e) });
    }
  }

  // 3) soma ao contador do dia
  let enviadosHoje = jaHoje + enviados;
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_gmail_registrar_envio`, {
      method: 'POST', headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_qtd: enviados })
    });
    const d = await r.json().catch(() => null);
    if (d && d.ok && typeof d.enviados_hoje === 'number') enviadosHoje = d.enviados_hoje;
  } catch (_) {}

  return send(res, 200, { ok: true, enviados, falhas, limite_dia: limite, enviados_hoje: enviadosHoje });
}

// ---------- helpers ----------
function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function saudacao() { const h = new Date(Date.now() - 3 * 3600 * 1000).getUTCHours(); return h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite'); }
function trocar(txt, v) {
  return String(txt).replace(/\{nome\}|\{cidade\}|\{cargo\}|\{saudacao\}|\{empresa\}|\{remetente\}/g, m => v[m.slice(1, -1)] ?? '');
}
function corpoComRodape(html, email) {
  const foot = `<hr style="border:none;border-top:1px solid #eee;margin:22px 0 10px">
<p style="font-size:11px;color:#999;line-height:1.5">Você recebeu este e-mail porque disponibilizou seu contato para receber oportunidades. Para não receber mais, responda esta mensagem com <b>SAIR</b>.</p>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">${html}${foot}</div>`;
}
function b64(str) { return Buffer.from(str, 'utf8').toString('base64'); }
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function encAssunto(s) { return '=?UTF-8?B?' + b64(s) + '?='; }
function montarMime({ de, nomeDe, para, assunto, html, anexos }) {
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
