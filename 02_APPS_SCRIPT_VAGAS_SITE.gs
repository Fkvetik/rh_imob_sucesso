/**
 * RH IMOB • Site público • Vagas dinâmicas
 * Fonte: aba VAGAS_SITE
 * Destino: Supabase public.site_vagas_publicas
 * Segurança: SUPABASE_URL_NT e SUPABASE_SERVICE_ROLE_KEY_NT ficam apenas em Propriedades do Script.
 */

const VAGAS_SITE_CFG = {
  sheetName: 'VAGAS_SITE',
  table: 'site_vagas_publicas',
  build: 'RHIMOB_SITE_VAGAS_DINAMICAS_2026_05_08',
  headers: [
    'vaga_id','titulo','categoria','localidade','cidade','estado_uf','modalidade','remuneracao','horario',
    'resumo','destaques','detalhes','requisitos','atividades','selo','prioridade','status','whatsapp_destino',
    'created_at','updated_at','SYNC_STATUS','SYNC_ERROR'
  ]
};

function VAGAS_SITE_setup() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(VAGAS_SITE_CFG.sheetName);
  if (!sh) sh = ss.insertSheet(VAGAS_SITE_CFG.sheetName);
  const current = sh.getRange(1, 1, 1, VAGAS_SITE_CFG.headers.length).getValues()[0];
  const precisaCabecalho = VAGAS_SITE_CFG.headers.some((h, i) => current[i] !== h);
  if (precisaCabecalho) {
    sh.getRange(1, 1, 1, VAGAS_SITE_CFG.headers.length).setValues([VAGAS_SITE_CFG.headers]);
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() < 2) VAGAS_SITE_popularModelos_(sh);
  SpreadsheetApp.getUi().alert('Aba VAGAS_SITE criada/validada. Edite as vagas e rode VAGAS_SITE_syncSupabase.');
}

function VAGAS_SITE_syncSupabase() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(VAGAS_SITE_CFG.sheetName);
  if (!sh) throw new Error('Aba VAGAS_SITE não encontrada. Rode VAGAS_SITE_setup primeiro.');

  const props = PropertiesService.getScriptProperties();
  const supabaseUrl = props.getProperty('SUPABASE_URL_NT') || props.getProperty('SUPABASE_URL');
  const serviceKey = props.getProperty('SUPABASE_SERVICE_ROLE_KEY_NT') || props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('Configure SUPABASE_URL_NT e SUPABASE_SERVICE_ROLE_KEY_NT nas Propriedades do Script.');

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, lido: 0, enviado: 0 };
  const headers = values[0].map(String);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  const payload = [];
  const rowNumbers = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const titulo = cell_(row, idx, 'titulo');
    if (!titulo) continue;
    const status = cell_(row, idx, 'status') || 'ATIVA';
    const vagaId = cell_(row, idx, 'vaga_id') || slugVaga_(titulo + '-' + (cell_(row, idx, 'localidade') || cell_(row, idx, 'cidade') || ''));
    const item = {
      vaga_id: vagaId,
      titulo,
      categoria: cell_(row, idx, 'categoria') || 'Vagas',
      localidade: cell_(row, idx, 'localidade'),
      cidade: cell_(row, idx, 'cidade'),
      estado_uf: cell_(row, idx, 'estado_uf'),
      modalidade: cell_(row, idx, 'modalidade'),
      remuneracao: cell_(row, idx, 'remuneracao'),
      horario: cell_(row, idx, 'horario'),
      resumo: cell_(row, idx, 'resumo'),
      destaques: cell_(row, idx, 'destaques'),
      detalhes: cell_(row, idx, 'detalhes'),
      requisitos: cell_(row, idx, 'requisitos'),
      atividades: cell_(row, idx, 'atividades'),
      selo: cell_(row, idx, 'selo'),
      prioridade: Number(cell_(row, idx, 'prioridade') || 100),
      status,
      whatsapp_destino: cell_(row, idx, 'whatsapp_destino') || 'MARIANA',
      updated_at: new Date().toISOString()
    };
    if (cell_(row, idx, 'created_at')) item.created_at = new Date(cell_(row, idx, 'created_at')).toISOString();
    payload.push(item);
    rowNumbers.push(r + 1);
  }

  if (!payload.length) return { ok: true, lido: values.length - 1, enviado: 0 };
  const endpoint = supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + VAGAS_SITE_CFG.table + '?on_conflict=vaga_id';
  const res = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      Prefer: 'resolution=merge-duplicates,return=minimal'
    }
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    const msg = 'Supabase HTTP ' + code + ': ' + res.getContentText();
    marcarSync_(sh, rowNumbers, 'ERRO', msg, idx);
    throw new Error(msg);
  }
  marcarSync_(sh, rowNumbers, 'OK', '', idx, now);
  return { ok: true, lido: values.length - 1, enviado: payload.length, build: VAGAS_SITE_CFG.build };
}

function VAGAS_SITE_popularModelos_(sh) {
  const rows = [
    ['corretor-locacao-alto-padrao','Corretor(a) de Locação – Alto Padrão','Locação','São Paulo/SP','São Paulo','SP','Autônomo','Comissão sobre locações','Horário comercial com agenda flexível','Atuação com imóveis de alto padrão e atendimento consultivo.','Carteira de imóveis de alto padrão\nAtendimento a clientes qualificados\nApoio operacional da imobiliária','Prospecção, atendimento, visita e negociação de locações.','Experiência comercial\nBoa comunicação\nPerfil consultivo','Captação e atendimento de locação','Locação',10,'ATIVA','MARIANA','','','',''],
    ['corretor-terceiros-alto-padrao','Corretor(a) de Imóveis – Terceiros Alto Padrão','Vendas terceiros','São Paulo/SP','São Paulo','SP','Autônomo','Comissionamento compatível com alto padrão','Rotina comercial alinhada à operação','Venda de imóveis de terceiros com foco consultivo.','Imóveis de alto padrão\nCarteira de terceiros\nRelacionamento com compradores e proprietários','Captação, apresentação e negociação de imóveis.','Experiência no mercado imobiliário\nCRECI ativo desejável','Terceiros',20,'ATIVA','MARIANA','','','','']
  ];
  sh.getRange(2, 1, rows.length, VAGAS_SITE_CFG.headers.length).setValues(rows);
}

function cell_(row, idx, name) {
  const i = idx[name];
  if (i === undefined) return '';
  return String(row[i] == null ? '' : row[i]).trim();
}

function slugVaga_(value) {
  return String(value || 'vaga')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'vaga';
}

function marcarSync_(sh, rows, status, error, idx, updatedAt) {
  rows.forEach((rowNumber) => {
    if (idx.SYNC_STATUS !== undefined) sh.getRange(rowNumber, idx.SYNC_STATUS + 1).setValue(status);
    if (idx.SYNC_ERROR !== undefined) sh.getRange(rowNumber, idx.SYNC_ERROR + 1).setValue(error || '');
    if (updatedAt && idx.updated_at !== undefined) sh.getRange(rowNumber, idx.updated_at + 1).setValue(updatedAt);
  });
}
