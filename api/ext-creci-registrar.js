// POST /api/ext-creci-registrar  { token, itens:[{ cidade, nome, creci, situacao, data_inscricao, url }], lote }
// Coletor do CRECI-SP dentro da Aceleradora (etapa 1). A extensão lê cada
// "Detalhes" no site do CRECI e manda para cá; aqui o token do operador é
// conferido no Coletor e quem grava na base do Corretores CRECI é o servidor,
// com a chave de serviço (SQL CRECI_2 → rhi_ext_registrar_corretores).
// Devolve, por corretor, se é novo, se está ativo e se já tem telefone/Instagram.
import { cors, send, lerCorpo, validarSessao, RHI } from './_ext-comum.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const { token, itens, lote } = await lerCorpo(req);
  const s = await validarSessao(token);
  if (!s.ok) return send(res, 401, { ok: false, error: s.error });
  // Só para quem o admin liberou (SQL ACESSO_CRECI_1); sem liberação, bloqueia.
  if (s.acesso_creci_cidade !== true) return send(res, 403, { ok: false, error: 'O CRECI por cidade não está liberado para este login. Peça ao administrador.' });

  if (!Array.isArray(itens) || !itens.length) return send(res, 400, { ok: false, error: 'Nenhum corretor enviado' });
  if (itens.length > 50 || JSON.stringify(itens).length > 40000) return send(res, 413, { ok: false, error: 'Lote grande demais' });

  // Só os campos que a coleta lê; nada além disso vai para o banco.
  const limpos = itens.map(it => ({
    cidade: String(it.cidade || '').slice(0, 80),
    nome: String(it.nome || '').slice(0, 160),
    creci: String(it.creci || '').slice(0, 20),
    situacao: String(it.situacao || '').slice(0, 30),
    data_inscricao: String(it.data_inscricao || '').slice(0, 10)
  }));
  const loteSeguro = 'EXT_' + String(s.login || 'op').replace(/[^\w.-]/g, '').slice(0, 30) + '_' +
    String(lote || new Date().toISOString().slice(0, 10).replace(/-/g, '')).replace(/[^\w-]/g, '').slice(0, 20);

  const service = RHI.service();
  if (!service) return send(res, 500, { ok: false, error: 'Chave de serviço do Corretores CRECI não configurada' });

  const r = await fetch(`${RHI.url}/rest/v1/rpc/rhi_ext_registrar_corretores`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    // conta = login do operador na Aceleradora (cada um vê as próprias extrações)
    body: JSON.stringify({ p_itens: limpos, p_lote: loteSeguro, p_conta: 'login:' + s.login, p_login: s.login })
  }).catch(() => null);
  const data = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !data) {
    const msg = (data && (data.message || data.hint)) || (r ? `HTTP ${r.status}` : 'sem resposta');
    return send(res, 502, { ok: false, error: /rhi_ext_registrar_corretores/.test(msg) ? 'Falta rodar o SQL CRECI_2 no Corretores CRECI' : msg });
  }

  // Marcas do detalhe (SQL CRECI_9): tem telefone/e-mail no CRECI, afastamento
  // e link. Mesma ordem dos itens; sem o SQL, só não guarda (não trava a coleta).
  const detalhes = (data.itens || []).map((x, i) => x && x.ok ? {
    lead_key: x.lead_key,
    tem_telefone: itens[i].tem_telefone === true, tem_email_oficial: itens[i].tem_email_oficial === true,
    tem_email_pessoal: itens[i].tem_email_pessoal === true,
    data_afastamento: String(itens[i].data_afastamento || '').slice(0, 10), url: String(itens[i].url || '').slice(0, 300)
  } : null).filter(Boolean);
  if (detalhes.length) {
    await fetch(`${RHI.url}/rest/v1/rpc/rhi_ext_coleta_detalhes`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_conta: 'login:' + s.login, p_itens: detalhes })
    }).catch(() => null);
  }
  return send(res, 200, data);
}
