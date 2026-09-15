// Vercel Function — exporta corretores do Banco CRECI (projeto RHI) como CSV
// pronto pra importar no Google Contatos, filtrado por cidade (e opcionalmente
// ano de inscrição no CRECI). Mesmo padrão de auth do /api/contas-rhi.
// Chamar como:
//   GET /api/exportar-contatos-rhi?token=SENHA&acao=cidades
//   GET /api/exportar-contatos-rhi?token=SENHA&acao=anos&cidade=Sorocaba
//   GET /api/exportar-contatos-rhi?token=SENHA&acao=exportar&cidade=Sorocaba&ano=2024

const SB_URL = 'https://tnzmxpoxvdlckmjwdala.supabase.co';

const COLETOR_URL = 'https://lrejfhsomfxyaoshmpzz.supabase.co';
const COLETOR_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y';

async function senhaDeAdminValida(senha) {
  if (!senha) return { valida: false, motivo: 'Senha não informada.' };
  try {
    const r = await fetch(`${COLETOR_URL}/rest/v1/rpc/rpc_admin_verificar_senha`, {
      method: 'POST',
      headers: { apikey: COLETOR_ANON_KEY, Authorization: `Bearer ${COLETOR_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_admin_password: senha, p_login: null })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { valida: false, motivo: `Falha ao verificar senha (HTTP ${r.status} do Coletor): ${t.slice(0, 200)}` };
    }
    const data = await r.json();
    if (data && data.ok === true) return { valida: true };
    return { valida: false, motivo: 'Senha de admin incorreta.' };
  } catch (e) {
    return { valida: false, motivo: 'Falha de rede ao verificar senha: ' + String(e && e.message || e) };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const token = req.query.token || '';
  const acao = req.query.acao || 'exportar';
  const cidade = (req.query.cidade || '').trim();
  const ano = (req.query.ano || '').trim();

  const SERVICE_KEY = process.env.RHI_SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) return json(res, 500, { error: 'config', message: 'Falta RHI_SUPABASE_SERVICE_KEY na Vercel.' });

  const check = await senhaDeAdminValida(token);
  if (!check.valida) return json(res, 401, { error: 'auth', message: check.motivo });

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

  try {
    if (acao === 'cidades') {
      const r = await fetch(`${SB_URL}/rest/v1/lead_filtros_cidade?select=cidade,total&order=cidade.asc`, { headers });
      if (!r.ok) return supabaseErr(res, r);
      return json(res, 200, { ok: true, cidades: await r.json() });
    }

    if (acao === 'anos') {
      if (!cidade) return json(res, 400, { error: 'validacao', message: 'cidade é obrigatória.' });
      const r = await fetch(`${SB_URL}/rest/v1/lead_filtros_cidade_ano?select=ano_inscricao,total&cidade=eq.${encodeURIComponent(cidade)}&order=ano_inscricao.desc`, { headers });
      if (!r.ok) return supabaseErr(res, r);
      return json(res, 200, { ok: true, anos: await r.json() });
    }

    // acao === 'exportar' — gera e devolve o CSV
    if (!cidade) return json(res, 400, { error: 'validacao', message: 'cidade é obrigatória.' });

    const leads = await buscarTodosLeads(headers, cidade, ano);
    const csv = montarCsvGoogleContatos(leads, cidade);
    const nomeArquivo = `contatos_corretores_${slug(cidade)}${ano ? '_' + slug(ano) : ''}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.status(200).send('﻿' + csv);
  } catch (e) {
    return json(res, 500, { error: 'exception', message: String(e && e.message || e) });
  }
}

// Pagina em blocos de 1000 (limite padrão do PostgREST) até esgotar — sem
// isso, cidades grandes (ex.: Sorocaba tem milhares) vinham cortadas.
async function buscarTodosLeads(headers, cidade, ano) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    let url = `${SB_URL}/rest/v1/leads?select=nome_completo,creci,telefone_base` +
      `&cidade=eq.${encodeURIComponent(cidade)}&ativo=eq.true&telefone_base=not.is.null&telefone_base=neq.` +
      `&order=nome_completo.asc&offset=${offset}&limit=${pageSize}`;
    if (ano) url += `&ano_inscricao=eq.${encodeURIComponent(ano)}`;
    const r = await fetch(url, { headers });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`Falha ao consultar leads (HTTP ${r.status}): ${t.slice(0, 300)}`);
    }
    const page = await r.json();
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

function montarCsvGoogleContatos(leads, cidade) {
  const HEADER = [
    'First Name', 'Middle Name', 'Last Name', 'Phonetic First Name', 'Phonetic Middle Name',
    'Phonetic Last Name', 'Name Prefix', 'Name Suffix', 'Nickname', 'File As',
    'Organization Name', 'Organization Title', 'Organization Department', 'Birthday',
    'Notes', 'Photo', 'Labels', 'Phone 1 - Label', 'Phone 1 - Value'
  ];

  const linhas = leads.map((l) => {
    const nomeTitulo = tituloCaso(l.nome_completo);
    const partes = nomeTitulo.split(' ');
    const firstName = partes[0] || '';
    const lastName = partes.slice(1).join(' ');
    const telefone = formatarTelefoneE164Br(l.telefone_base);
    if (!telefone) return null; // nunca deveria acontecer (filtro já exige telefone), defesa extra

    return [
      firstName, '', lastName, '', '', '', '', '', '',
      nomeTitulo,
      '',
      'Corretor de Imóveis',
      '',
      '',
      `CRECI ${l.creci || ''} — ${cidade}`,
      '',
      `Corretores ${cidade}`,
      'Mobile',
      telefone
    ];
  }).filter(Boolean);

  return [HEADER.join(','), ...linhas.map((l) => l.map(csvCell).join(','))].join('\n');
}

function tituloCaso(nome) {
  const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return String(nome || '').trim().toLowerCase().split(/\s+/).map((w, i) => {
    if (i > 0 && minusculas.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function formatarTelefoneE164Br(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const semPais = digits.startsWith('55') ? digits.slice(2) : digits;
  if (semPais.length < 10) return '';
  const ddd = semPais.slice(0, 2);
  const resto = semPais.slice(2);
  const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
  const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
  return `+55 ${ddd} ${meio}-${fim}`;
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
}

function json(res, status, obj) { res.status(status).send(JSON.stringify(obj)); }
async function supabaseErr(res, r) {
  const t = await r.text().catch(() => '');
  return json(res, 502, { error: 'supabase', status: r.status, message: t.slice(0, 400) });
}
