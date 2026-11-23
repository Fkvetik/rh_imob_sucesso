// Cron da fila de e-mail — roda a cada 2 min (vercel.json). Envia os itens da
// email_fila que já venceram (enviar_apos <= agora), 1 por conta por vez,
// respeitando o limite/dia. Lê a fila com a chave de serviço do COLETOR
// (server-only). Protegido pelo CRON_SECRET do Vercel.

import { COLETOR } from './_ext-comum.js';
import { montarMime, trocar, saudacao, corpoComRodape, primeiroNome, accessTokenDoRefresh, enviarRaw } from './_email-mime.js';

export const config = { maxDuration: 60 };

const POR_RODADA = 20; // teto por execução (cada conta sai ~1 por rodada pelo escalonamento)

export default async function handler(req, res) {
  // Auth: Vercel Cron manda Authorization: Bearer <CRON_SECRET> quando a env existe.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const q = req.query.secret || '';
  if (secret && auth !== `Bearer ${secret}` && q !== secret) {
    return res.status(401).json({ ok: false, error: 'não autorizado' });
  }
  const KEY = COLETOR.service();
  if (!KEY) return res.status(500).json({ ok: false, error: 'Falta COLETOR_SERVICE_KEY no Vercel.' });

  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  const agora = new Date().toISOString();

  // 1) itens vencidos
  let itens = [];
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/email_fila?status=eq.pendente&enviar_apos=lte.${encodeURIComponent(agora)}&order=enviar_apos.asc&limit=${POR_RODADA}`, { headers: H });
    itens = await r.json();
    if (!Array.isArray(itens)) itens = [];
  } catch (e) { return res.status(502).json({ ok: false, error: 'falha ao ler a fila' }); }
  if (!itens.length) return res.status(200).json({ ok: true, enviados: 0, msg: 'nada vencido' });

  const campCache = {}; // id -> campanha
  const contaCache = {}; // login -> { refresh, email, nome, limite, hoje, data, tokenAcesso }
  let enviados = 0, falhas = 0, bloqueadosLimite = 0;

  async function getCampanha(id) {
    if (campCache[id]) return campCache[id];
    const r = await fetch(`${COLETOR.url}/rest/v1/email_campanha?id=eq.${id}&select=*&limit=1`, { headers: H });
    const d = await r.json().catch(() => null);
    campCache[id] = (Array.isArray(d) && d[0]) || null;
    return campCache[id];
  }
  async function getConta(login) {
    if (contaCache[login]) return contaCache[login];
    const r = await fetch(`${COLETOR.url}/rest/v1/usuarios?login=eq.${encodeURIComponent(login)}&select=login,nome_operador,gmail_refresh_token,gmail_email,email_limite_dia,email_enviados_hoje,email_enviados_data,email_acesso&limit=1`, { headers: H });
    const d = await r.json().catch(() => null);
    const u = (Array.isArray(d) && d[0]) || null;
    if (!u) { contaCache[login] = null; return null; }
    const hojeStr = new Date().toISOString().slice(0, 10);
    const base = (u.email_enviados_data === hojeStr) ? (u.email_enviados_hoje || 0) : 0;
    contaCache[login] = {
      refresh: u.gmail_refresh_token, email: u.gmail_email, nome: u.nome_operador,
      limite: u.email_limite_dia || 100, hoje: base, data: hojeStr,
      acesso: !!u.email_acesso, tokenAcesso: null
    };
    return contaCache[login];
  }
  async function marcar(id, campos) {
    await fetch(`${COLETOR.url}/rest/v1/email_fila?id=eq.${id}`, { method: 'PATCH', headers: H, body: JSON.stringify(campos) }).catch(() => {});
  }
  async function salvarContador(login, novo, data) {
    await fetch(`${COLETOR.url}/rest/v1/usuarios?login=eq.${encodeURIComponent(login)}`, { method: 'PATCH', headers: H, body: JSON.stringify({ email_enviados_hoje: novo, email_enviados_data: data }) }).catch(() => {});
  }

  for (const item of itens) {
    const conta = await getConta(item.login);
    if (!conta || !conta.acesso || !conta.refresh) { await marcar(item.id, { status: 'falha', motivo: 'Gmail não conectado / sem acesso' }); falhas++; continue; }
    if (conta.hoje >= conta.limite) { bloqueadosLimite++; continue; } // deixa pendente p/ amanhã

    const camp = await getCampanha(item.campanha_id);
    if (!camp) { await marcar(item.id, { status: 'falha', motivo: 'campanha não encontrada' }); falhas++; continue; }

    try {
      if (!conta.tokenAcesso) conta.tokenAcesso = await accessTokenDoRefresh(conta.refresh);
      const vars = { nome: primeiroNome(item.nome), cidade: item.cidade || '', cargo: item.cargo || '', saudacao: saudacao(), empresa: camp.empresa || '', remetente: camp.remetente || '' };
      const raw = montarMime({
        de: conta.email, nomeDe: conta.nome || camp.empresa || '',
        para: item.para, assunto: trocar(camp.assunto, vars),
        html: corpoComRodape(trocar(camp.corpo_html, vars)),
        anexos: Array.isArray(camp.anexos) ? camp.anexos : []
      });
      await enviarRaw(conta.tokenAcesso, raw);
      await marcar(item.id, { status: 'enviado', enviado_em: new Date().toISOString() });
      conta.hoje += 1; enviados++;
      await salvarContador(item.login, conta.hoje, conta.data);
    } catch (e) {
      const tent = (item.tentativas || 0) + 1;
      if (tent >= 3) { await marcar(item.id, { status: 'falha', tentativas: tent, motivo: String(e.message || e).slice(0, 200) }); falhas++; }
      else { await marcar(item.id, { tentativas: tent, enviar_apos: new Date(Date.now() + 10 * 60000).toISOString(), motivo: String(e.message || e).slice(0, 200) }); } // tenta de novo em 10 min
    }
  }

  return res.status(200).json({ ok: true, enviados, falhas, bloqueadosLimite });
}
