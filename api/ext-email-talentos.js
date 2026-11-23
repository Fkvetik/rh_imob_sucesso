// Disparo de e-mail (Banco de Novos Talentos) — Fase 2: seleção protegida.
// A extensão/ferramenta manda só o token de sessão do operador; aqui o servidor
// confere o token no COLETOR, checa se a conta tem email_acesso (admin libera) e,
// se tiver, lista talentos do NT (nome/e-mail/cidade/cargo) com a chave de serviço
// — a lista de e-mails (PII) nunca sai sem token válido + acesso liberado.
//
// POST { token, cidade?, cargo?, limite? } -> { ok, login, limite_dia, total, talentos:[...] }
// (O ENVIO em si é a Fase 3 — este endpoint só seleciona.)

import { cors, send, lerCorpo, COLETOR, NT } from './_ext-comum.js';

const TETO_LISTA = 500; // quanto a tela pode exibir pra escolher (o envio/dia é outro limite)

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' });

  const body = await lerCorpo(req);
  const token = String(body.token || '').trim();

  // 1) Confere o token e o acesso a e-mail (rpc_email_config — SQL EMAIL_2).
  let cfg;
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_email_config`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
    cfg = await r.json().catch(() => null);
  } catch (e) {
    return send(res, 502, { ok: false, error: 'Falha ao conferir a sessão.' });
  }
  if (!cfg || cfg.ok !== true) return send(res, 401, { ok: false, error: (cfg && cfg.error) || 'Sessão inválida ou expirada.' });
  if (!cfg.email_acesso) return send(res, 403, { ok: false, error: 'Esta conta ainda não tem o disparo de e-mail liberado. Fale com a RH IMOB.' });

  // 2) Lista talentos do NT (chave de serviço — bypassa RLS). Só com e-mail.
  const cidade = String(body.cidade || '').trim();
  const cargo = String(body.cargo || '').trim();
  const pedido = Math.max(1, Math.min(TETO_LISTA, parseInt(body.limite, 10) || TETO_LISTA));

  const service = NT.service();
  if (!service) return send(res, 500, { ok: false, error: 'Configuração do servidor incompleta (NT service key).' });

  let url = `${NT.url}/rest/v1/nt_talentos?select=talento_key,nome,email,cidade,estado_uf,cargo`
    + `&email=not.is.null&nome=not.is.null&order=cidade.asc&limit=${pedido}`;
  if (cidade) url += `&cidade=ilike.*${encodeURIComponent(cidade)}*`;
  if (cargo)  url += `&cargo=ilike.*${encodeURIComponent(cargo)}*`;

  let lista;
  try {
    const r = await fetch(url, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
    if (!r.ok) return send(res, 502, { ok: false, error: `Falha ao buscar talentos (HTTP ${r.status}).` });
    lista = await r.json();
  } catch (e) {
    return send(res, 502, { ok: false, error: 'Falha ao buscar talentos.' });
  }

  const talentos = (Array.isArray(lista) ? lista : [])
    .filter(t => t && t.email && String(t.email).includes('@'))
    .map(t => ({
      key: t.talento_key,
      nome: t.nome || '',
      email: t.email,
      cidade: t.cidade || '',
      uf: t.estado_uf || '',
      cargo: t.cargo || ''
    }));

  return send(res, 200, {
    ok: true,
    login: cfg.login,
    limite_dia: cfg.limite_dia || 100,
    total: talentos.length,
    talentos
  });
}
