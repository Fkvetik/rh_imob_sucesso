// Disparo de e-mail (Banco de Novos Talentos) — seleção protegida.
// Confere o token no COLETOR + email_acesso e lista talentos do NT com a chave de
// serviço. Filtro completo (igual ao Novos Talentos): cidade, região, micro-região,
// bairro, cargo, perfil, faixa etária. A lista de e-mails (PII) só sai com token
// válido + acesso liberado.
//
// POST { token, cidade?, regiao?, micro?, bairro?, cargo?, perfil?, faixa?, limite? }
//   -> { ok, login, limite_dia, total, talentos:[{key,nome,email,cidade,uf,bairro,regiao,micro,cargo,perfil,faixa}] }

import { cors, send, lerCorpo, COLETOR, NT } from './_ext-comum.js';

const TETO_LISTA = 500;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' });

  const body = await lerCorpo(req);
  const token = String(body.token || '').trim();

  // 1) token + acesso a e-mail
  let cfg;
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_email_config`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
    cfg = await r.json().catch(() => null);
  } catch (e) { return send(res, 502, { ok: false, error: 'Falha ao conferir a sessão.' }); }
  if (!cfg || cfg.ok !== true) return send(res, 401, { ok: false, error: (cfg && cfg.error) || 'Sessão inválida ou expirada.' });
  if (!cfg.email_acesso) return send(res, 403, { ok: false, error: 'Esta conta ainda não tem o disparo de e-mail liberado. Fale com a RH IMOB.' });

  // 2) monta o filtro (todos opcionais)
  const service = NT.service();
  if (!service) return send(res, 500, { ok: false, error: 'Configuração do servidor incompleta (NT service key).' });

  const ilike = (campo, v) => { v = String(v || '').trim(); return v ? `&${campo}=ilike.*${encodeURIComponent(v)}*` : ''; };
  const pedido = Math.max(1, Math.min(TETO_LISTA, parseInt(body.limite, 10) || TETO_LISTA));

  let url = `${NT.url}/rest/v1/nt_talentos?select=*&email=not.is.null&order=cidade.asc&limit=${pedido}`
    + ilike('cidade', body.cidade)
    + ilike('regiao_macro', body.regiao)
    + ilike('micro_regiao', body.micro)
    + ilike('bairro', body.bairro)
    + ilike('cargo', body.cargo)
    + ilike('faixa_idade', body.faixa);

  let lista, totalGeral = null;
  try {
    const r = await fetch(url, { headers: { apikey: service, Authorization: `Bearer ${service}`, Prefer: 'count=exact', 'Range-Unit': 'items', Range: `0-${pedido - 1}` } });
    const txt = await r.text();
    if (!r.ok && r.status !== 206) return send(res, 502, { ok: false, error: `Banco recusou a busca (HTTP ${r.status}): ${txt.slice(0, 300)}` });
    lista = JSON.parse(txt);
    const cr = r.headers.get('content-range'); // ex.: 0-499/12345
    if (cr && cr.includes('/')) { const n = parseInt(cr.split('/')[1], 10); if (!isNaN(n)) totalGeral = n; }
  } catch (e) {
    return send(res, 502, { ok: false, error: 'Falha ao buscar talentos: ' + String(e.message || e) });
  }

  const talentos = (Array.isArray(lista) ? lista : [])
    .filter(t => t && t.email && String(t.email).includes('@'))
    .map(t => ({
      key: t.talento_key,
      nome: t.primeiro_nome || t.nome || '',
      email: t.email,
      cidade: t.cidade || '',
      uf: t.estado_uf || '',
      bairro: t.bairro || '',
      regiao: t.regiao_macro || '',
      micro: t.micro_regiao || '',
      cargo: t.cargo || '',
      faixa: t.faixa_idade || ''
    }));

  return send(res, 200, { ok: true, login: cfg.login, limite_dia: cfg.limite_dia || 100, total: talentos.length, total_geral: (totalGeral != null ? totalGeral : talentos.length), talentos });
}
