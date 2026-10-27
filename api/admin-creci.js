// POST /api/admin-creci  { senha, acao, login, ... }
// Painel /admin-catho-coletor: o admin filtra o banco de Corretores CRECI e
// coloca os corretores direto na fila de um operador, sem precisar estar na
// máquina dele. Tudo acontece COM O ACESSO DO OPERADOR ao banco CRECI (o
// e-mail cadastrado nele): a busca esconde quem a empresa dele já liberou e
// cada corretor aberto é descontado do limite da empresa dele — igual a ele
// mesmo clicar em "Liberar selecionados" na extensão.
//
// acao:
//   'contexto' { login }                       -> cidades disponíveis
//   'opcoes'   { login, cidade, ano, cargo }    -> anos e perfis com contagem
//   'contar'   { login, filtros }               -> quantos corretores disponíveis
//   'enviar'   { login, filtros, lote, campanha } -> abre até `lote` (máx. 25)
//                                                    e grava na fila do operador
// O painel chama 'enviar' em lotes até chegar na quantidade pedida.
import { cors, send, lerCorpo, sessaoPorEmail, COLETOR, RHI } from './_ext-comum.js';

async function rpcColetor(nome, body) {
  const r = await fetch(`${COLETOR.url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${r.status}`;
    if (/could not find the function|does not exist|PGRST202/i.test(msg)) throw new Error('Falta rodar o SQL CRECI_ADM_1 no Supabase do Coletor.');
    throw new Error(msg);
  }
  return data;
}

async function rpcRhi(jwt, nome, body) {
  const r = await fetch(`${RHI.url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: RHI.anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error((data && (data.message || data.error || data.hint)) || String(text).slice(0, 300));
  return data;
}

function primeiroNome(nome) {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
}

// Mesmo formato que a extensão grava ao liberar um corretor (gravarLeadDoRhi).
function leadParaFila(lead, campanha) {
  const tel = String(lead.telefone_wa || lead.telefone_base || lead.telefone_txt || '').replace(/\D/g, '');
  return {
    PerfilURL: lead.instagram_url || ('rhi://' + lead.lead_key),
    NomeCompleto: lead.nome_completo || '',
    PrimeiroNome: primeiroNome(lead.nome_completo),
    Telefone: tel,
    ProfissaoOuCargo: lead.cargo || lead.cargo_raw || '',
    Cidade: lead.cidade || '',
    FiltroOrigem: 'CORRETORES CRECI',
    NomeCampanha: campanha || 'Corretores CRECI',
    Origem: 'Corretores CRECI'
  };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' });

  const b = await lerCorpo(req);
  const senha = String(b.senha || '');
  const login = String(b.login || '').trim();
  if (!senha || !login) return send(res, 400, { ok: false, error: 'Informe a senha de admin e o operador' });

  try {
    // 1) Senha de admin + operador da conta dele + e-mail do banco CRECI.
    const op = await rpcColetor('rpc_admin_creci_operador', { p_admin_password: senha, p_login: login });
    if (!op || !op.ok) return send(res, 403, { ok: false, error: (op && op.error) || 'Sem permissão' });
    if (!op.email_rhi) {
      return send(res, 200, { ok: false, sem_acesso: true,
        error: `${op.nome_operador || login} não tem acesso ao banco de Corretores CRECI. Preencha "E-mail do banco de Corretores CRECI" no cadastro dele.` });
    }

    // 2) Acesso ao banco CRECI como esse operador (sem senha; só o servidor consegue).
    const sessao = await sessaoPorEmail(RHI, op.email_rhi);
    const jwt = sessao.access_token;
    const f = b.filtros || {};
    const filtrosBusca = { p_cidade: f.cidade || null, p_ano: f.ano || null, p_cargo: f.cargo || null };

    if (b.acao === 'contexto') {
      const cidades = await rpcRhi(jwt, 'rhi_opcoes_cidade', {});
      return send(res, 200, { ok: true, operador: op.nome_operador || login, cidades: cidades || [] });
    }

    if (b.acao === 'opcoes') {
      const [anos, cargos] = await Promise.all([
        rpcRhi(jwt, 'rhi_filtro_anos', { p_cidade: b.cidade || null, p_cargo: b.cargo || null, p_apenas_disponiveis: true }).catch(() => []),
        rpcRhi(jwt, 'rhi_filtro_cargos', { p_cidade: b.cidade || null, p_ano: b.ano || null, p_apenas_disponiveis: true }).catch(() => [])
      ]);
      return send(res, 200, { ok: true, anos: anos || [], cargos: cargos || [] });
    }

    if (b.acao === 'contar') {
      const rows = await rpcRhi(jwt, 'search_leads_plano', { ...filtrosBusca, p_page: 1, p_page_size: 1, p_ocultar_consumidos: true });
      const total = rows && rows[0] && rows[0].total_count != null ? Number(rows[0].total_count) : (rows ? rows.length : 0);
      return send(res, 200, { ok: true, total });
    }

    if (b.acao === 'enviar') {
      const lote = Math.min(Math.max(parseInt(b.lote, 10) || 25, 1), 25);
      const campanha = String(b.campanha || '').trim().slice(0, 120) || 'Corretores CRECI';
      // Quem já foi liberado some da busca, então é sempre a 1ª página.
      const rows = await rpcRhi(jwt, 'search_leads_plano', { ...filtrosBusca, p_page: 1, p_page_size: lote, p_ocultar_consumidos: true });
      const chaves = (rows || []).map(r => r.lead_key).filter(Boolean);
      if (!chaves.length) return send(res, 200, { ok: true, liberados: 0, na_fila: 0, falhas: 0, acabou: true });

      const leads = [];
      let falhas = 0, aviso = null, parou = false;
      for (const key of chaves) {
        try {
          const r = await rpcRhi(jwt, 'abrir_lead', { p_lead_key: key });
          if (!r || r.ok === false || !r.lead) { falhas++; continue; }
          if (r.plano && r.plano.aviso) aviso = r.plano.aviso;
          leads.push(leadParaFila(r.lead, campanha));
        } catch (e) {
          falhas++;
          if (String(e.message || e).includes('LIMITE_DE_ACESSOS_DO_PLANO_ESGOTADO')) {
            aviso = 'O limite de corretores da empresa deste operador acabou.';
            parou = true;
            break;
          }
        }
      }

      let fila = { na_fila: 0, ja_estavam: 0, erros: 0 };
      if (leads.length) {
        fila = await rpcColetor('rpc_admin_creci_para_fila', { p_admin_password: senha, p_login: login, p_leads: leads });
        if (!fila || !fila.ok) throw new Error((fila && fila.error) || 'Falha ao gravar na fila');
      }
      return send(res, 200, {
        ok: true, liberados: leads.length, na_fila: fila.na_fila, ja_estavam: fila.ja_estavam,
        falhas: falhas + (fila.erros || 0), aviso, acabou: parou || chaves.length < lote
      });
    }

    return send(res, 400, { ok: false, error: 'Ação desconhecida' });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e && e.message || e) });
  }
}
