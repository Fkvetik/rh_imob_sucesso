/**
 * RH IMOB • Novos Talentos
 * Gestão no padrão da Plataforma Corretores
 *
 * Abas:
 * - CONFIG_SUPABASE_NT
 * - CONTAS_MODELO_NT
 * - USUARIOS_MODELO_NT
 * - MENSAGEM_NT
 * - CONSUMOS_ESPELHO_NT
 * - RELATORIO_OPERADORES_NT
 * - LOG_SUPABASE_NT
 *
 * Propriedades do Script:
 * SUPABASE_URL = URL do Supabase Novos Talentos
 * SUPABASE_SERVICE_ROLE_KEY = service_role do Supabase Novos Talentos
 *
 * Não colocar service_role em HTML/GitHub/Vercel.
 */

const RHIMOB_NT_CORRETORES = {
  BUILD: 'RHIMOB_NT_PADRAO_CORRETORES_V10_2026_05_07',
  TZ: 'America/Sao_Paulo',
  PRODUCT_CODE: 'NOVOS_TALENTOS',
  SHEETS: {
    CONFIG: 'CONFIG_SUPABASE_NT',
    CONTAS: 'CONTAS_MODELO_NT',
    USUARIOS: 'USUARIOS_MODELO_NT',
    MENSAGEM: 'MENSAGEM_NT',
    CONSUMOS: 'CONSUMOS_ESPELHO_NT',
    RELATORIO: 'RELATORIO_OPERADORES_NT',
    LOG: 'LOG_SUPABASE_NT'
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('RH IMOB • Novos Talentos')
    .addItem('1. Preparar padrão Corretores', 'setupPadraoCorretoresNovosTalentos')
    .addItem('2. Sincronizar contas/usuários/mensagens', 'syncPadraoCorretoresNovosTalentos')
    .addItem('3. Atualizar consumos e relatório', 'atualizarRelatorioPadraoCorretoresNovosTalentos')
    .addItem('4. Processar tudo', 'processarTudoPadraoCorretoresNovosTalentos')
    .addToUi();
}

function setupPadraoCorretoresNovosTalentos() {
  const ss = SpreadsheetApp.getActive();

  ensureSheet_(ss, RHIMOB_NT_CORRETORES.SHEETS.CONFIG, [
    'CHAVE','VALOR_VISIVEL','OBSERVACAO'
  ], [
    ['TARGET_SPREADSHEET_ID', ss.getId(), 'Planilha operacional Novos Talentos.'],
    ['SUPABASE_URL', 'CONFIGURADO NAS PROPRIEDADES', 'Não salvar chave sensível em célula.'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'CONFIGURADO NAS PROPRIEDADES', 'Nunca salvar em célula.'],
    ['VERSION', RHIMOB_NT_CORRETORES.BUILD, 'Versão do script.']
  ]);

  ensureSheet_(ss, RHIMOB_NT_CORRETORES.SHEETS.CONTAS, [
    'conta_id','nome_empresa','telefone','usuarios_contratados','limite_leads','data_inicio','data_fim','status','observacao','updated_at','SYNC_STATUS','SYNC_ERROR'
  ]);

  ensureSheet_(ss, RHIMOB_NT_CORRETORES.SHEETS.USUARIOS, [
    'user_id','conta_id','nome','email','senha_temporaria','perfil','status','telefone','auth_user_id','criar_auth','updated_at','OBSERVACAO','SYNC_STATUS','SYNC_ERROR'
  ]);

  ensureSheet_(ss, RHIMOB_NT_CORRETORES.SHEETS.MENSAGEM, [
    'TEXTO','FRASE_KEY','CONTA_ID','ESCOPO','STATUS','PRIORIDADE','IS_DEFAULT','IS_FAVORITE','PLACEHOLDERS','OBSERVACAO','UPDATED_AT','SYNC_STATUS','SYNC_ERROR'
  ]);

  ensureSheet_(ss, RHIMOB_NT_CORRETORES.SHEETS.CONSUMOS, [
    'consumo_id','conta_id','produto_codigo','talento_key','usuario_id','auth_user_id','operador_nome','origem','created_at'
  ]);

  ensureSheet_(ss, RHIMOB_NT_CORRETORES.SHEETS.RELATORIO, [
    'data_consumo','conta_id','operador_nome','email_login','total_consumos'
  ]);

  ensureSheet_(ss, RHIMOB_NT_CORRETORES.SHEETS.LOG, [
    'quando','tipo','linha','id','status','erro','build'
  ]);

  log_('SETUP', 0, 'PADRAO_CORRETORES_NT', 'OK', '');
}

function processarTudoPadraoCorretoresNovosTalentos() {
  setupPadraoCorretoresNovosTalentos();
  syncPadraoCorretoresNovosTalentos();
  atualizarRelatorioPadraoCorretoresNovosTalentos();
}

function syncPadraoCorretoresNovosTalentos() {
  setupPadraoCorretoresNovosTalentos();
  syncContas_();
  syncUsuarios_();
  syncMensagens_();
}

function atualizarRelatorioPadraoCorretoresNovosTalentos() {
  setupPadraoCorretoresNovosTalentos();

  const ss = SpreadsheetApp.getActive();
  const shConsumos = ss.getSheetByName(RHIMOB_NT_CORRETORES.SHEETS.CONSUMOS);
  const shRel = ss.getSheetByName(RHIMOB_NT_CORRETORES.SHEETS.RELATORIO);

  const consumos = supaGet_('/rest/v1/nt_talento_consumos?select=consumo_id,conta_id,produto_codigo,talento_key,usuario_id,auth_user_id,operador_nome,origem,created_at&produto_codigo=eq.NOVOS_TALENTOS&order=created_at.desc&limit=5000');

  clearBelowHeader_(shConsumos);
  if (consumos.length) {
    shConsumos.getRange(2, 1, consumos.length, 9).setValues(consumos.map(r => [
      r.consumo_id, r.conta_id, r.produto_codigo, r.talento_key, r.usuario_id,
      r.auth_user_id, r.operador_nome, r.origem, r.created_at
    ]));
  }

  const rel = supaGet_('/rest/v1/nt_relatorio_operadores_v10?select=data_consumo,conta_id,operador_nome,email_login,total_consumos&order=data_consumo.desc&limit=5000');

  clearBelowHeader_(shRel);
  if (rel.length) {
    shRel.getRange(2, 1, rel.length, 5).setValues(rel.map(r => [
      r.data_consumo, r.conta_id, r.operador_nome, r.email_login, r.total_consumos
    ]));
  }

  log_('RELATORIO', 0, 'CONSUMOS_ESPELHO_NT', 'OK', '');
}

function syncContas_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(RHIMOB_NT_CORRETORES.SHEETS.CONTAS);
  const rows = sheetObjects_(sh);
  const idx = headerIndex_(sh);

  rows.forEach(item => {
    const row = item.data;
    const n = item.rowNumber;

    if (!clean_(row.conta_id) || !clean_(row.nome_empresa)) return;

    try {
      const limite = toInt_(row.limite_leads, 0);
      const usuarios = toInt_(row.usuarios_contratados, 1);

      const payload = [{
        conta_id: clean_(row.conta_id),
        produto_codigo: RHIMOB_NT_CORRETORES.PRODUCT_CODE,
        nome_conta: clean_(row.nome_empresa),
        plano_tipo: 'EMPRESARIAL',
        status: clean_(row.status) || 'ATIVA',
        limite_total: limite,
        limite_por_usuario: usuarios ? Math.ceil(limite / usuarios) : limite,
        usuarios_contratados: usuarios,
        observacao: clean_(row.observacao),
        updated_at: new Date().toISOString()
      }];

      supaUpsert_('nt_contas', 'conta_id', payload);

      setCell_(sh, n, idx.updated_at, now_());
      setCell_(sh, n, idx.SYNC_STATUS, 'OK');
      setCell_(sh, n, idx.SYNC_ERROR, '');
      log_('CONTA', n, row.conta_id, 'OK', '');
    } catch (e) {
      setCell_(sh, n, idx.SYNC_STATUS, 'ERRO');
      setCell_(sh, n, idx.SYNC_ERROR, String(e.message || e));
      log_('CONTA', n, row.conta_id, 'ERRO', String(e.stack || e));
    }
  });
}

function syncUsuarios_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(RHIMOB_NT_CORRETORES.SHEETS.USUARIOS);
  const rows = sheetObjects_(sh);
  const idx = headerIndex_(sh);

  rows.forEach(item => {
    const row = item.data;
    const n = item.rowNumber;

    if (!clean_(row.conta_id) || !clean_(row.email)) return;

    try {
      let authId = clean_(row.auth_user_id);
      const email = clean_(row.email).toLowerCase();

      if (isYes_(row.criar_auth) && !authId) {
        const senha = clean_(row.senha_temporaria);
        if (!senha || senha.indexOf('CRIADA') >= 0) throw new Error('Informe senha_temporaria para criar Auth.');

        const auth = createAuthUser_(email, senha);
        authId = auth.id;
        setCell_(sh, n, idx.auth_user_id, authId);
        setCell_(sh, n, idx.senha_temporaria, 'CRIADA_NO_SUPABASE_AUTH');
      }

      if (!authId) throw new Error('auth_user_id vazio. Crie no Auth ou marque criar_auth.');

      const userId = clean_(row.user_id) || makeUserId_(row.conta_id, row.email);

      const payload = [{
        usuario_seed_id: userId,
        conta_id: clean_(row.conta_id),
        produto_codigo: RHIMOB_NT_CORRETORES.PRODUCT_CODE,
        auth_user_id: authId,
        nome: clean_(row.nome),
        email_login: email,
        senha_temporaria: '',
        perfil: clean_(row.perfil) || 'OPERADOR',
        status: clean_(row.status) || 'ATIVO',
        observacao: clean_(row.OBSERVACAO),
        updated_at: new Date().toISOString()
      }];

      supaUpsert_('nt_usuarios_conta', 'usuario_seed_id', payload);

      setCell_(sh, n, idx.user_id, userId);
      setCell_(sh, n, idx.updated_at, now_());
      setCell_(sh, n, idx.SYNC_STATUS, 'OK');
      setCell_(sh, n, idx.SYNC_ERROR, '');
      log_('USUARIO', n, email, 'OK', '');
    } catch (e) {
      setCell_(sh, n, idx.SYNC_STATUS, 'ERRO');
      setCell_(sh, n, idx.SYNC_ERROR, String(e.message || e));
      log_('USUARIO', n, row.email, 'ERRO', String(e.stack || e));
    }
  });
}

function syncMensagens_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(RHIMOB_NT_CORRETORES.SHEETS.MENSAGEM);
  const rows = sheetObjects_(sh);
  const idx = headerIndex_(sh);

  rows.forEach(item => {
    const row = item.data;
    const n = item.rowNumber;

    if (!clean_(row.TEXTO)) return;

    try {
      const fraseKey = clean_(row.FRASE_KEY) || ('FRASE_NT_' + n);
      const payload = [{
        frase_id: fraseKey,
        produto_codigo: RHIMOB_NT_CORRETORES.PRODUCT_CODE,
        plano_tipo: 'EMPRESARIAL',
        titulo: fraseKey,
        texto: clean_(row.TEXTO),
        prioridade: toInt_(row.PRIORIDADE, n),
        status: clean_(row.STATUS) || 'ATIVA'
      }];

      supaUpsert_('nt_frases_abordagem', 'frase_id', payload);

      setCell_(sh, n, idx.UPDATED_AT, now_());
      setCell_(sh, n, idx.SYNC_STATUS, 'OK');
      setCell_(sh, n, idx.SYNC_ERROR, '');
      log_('MENSAGEM', n, fraseKey, 'OK', '');
    } catch (e) {
      setCell_(sh, n, idx.SYNC_STATUS, 'ERRO');
      setCell_(sh, n, idx.SYNC_ERROR, String(e.message || e));
      log_('MENSAGEM', n, row.FRASE_KEY, 'ERRO', String(e.stack || e));
    }
  });
}

/* Helpers */

function ensureSheet_(ss, name, headers, seedRows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  }

  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);

  if (seedRows && sh.getLastRow() < 2) {
    sh.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
  }

  return sh;
}

function sheetObjects_(sh) {
  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const obj = {};
    let has = false;
    headers.forEach((h, c) => {
      if (!h) return;
      obj[h] = values[r][c];
      if (values[r][c]) has = true;
    });
    if (has) rows.push({ rowNumber: r + 1, data: obj });
  }
  return rows;
}

function headerIndex_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const idx = {};
  headers.forEach((h, i) => { if (h) idx[h] = i + 1; });
  return idx;
}

function supaConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!url) throw new Error('SUPABASE_URL não configurada.');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  return { url: url.replace(/\/+$/, ''), key };
}

function supaHeaders_(extra) {
  const cfg = supaConfig_();
  return Object.assign({
    apikey: cfg.key,
    Authorization: 'Bearer ' + cfg.key,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }, extra || {});
}

function supaGet_(path) {
  const cfg = supaConfig_();
  const res = UrlFetchApp.fetch(cfg.url + path, {
    method: 'get',
    muteHttpExceptions: true,
    headers: supaHeaders_()
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('Supabase GET HTTP ' + code + ': ' + body);
  return JSON.parse(body || '[]');
}

function supaUpsert_(table, conflict, rows) {
  const cfg = supaConfig_();
  const url = cfg.url + '/rest/v1/' + table + '?on_conflict=' + encodeURIComponent(conflict);

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    payload: JSON.stringify(rows),
    headers: supaHeaders_({ Prefer: 'resolution=merge-duplicates,return=minimal' })
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('Supabase UPSERT ' + table + ' HTTP ' + code + ': ' + body);
}

function createAuthUser_(email, password) {
  const cfg = supaConfig_();
  const res = UrlFetchApp.fetch(cfg.url + '/auth/v1/admin/users', {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    payload: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { origem: 'RH_IMOB_NOVOS_TALENTOS' }
    }),
    headers: supaHeaders_()
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code >= 200 && code < 300) return JSON.parse(body);
  throw new Error('Erro ao criar Auth. HTTP ' + code + ': ' + body);
}

function setCell_(sh, row, col, value) {
  if (!col) return;
  sh.getRange(row, col).setValue(value);
}

function clearBelowHeader_(sh) {
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
}

function log_(tipo, linha, id, status, erro) {
  const ss = SpreadsheetApp.getActive();
  const sh = ensureSheet_(ss, RHIMOB_NT_CORRETORES.SHEETS.LOG, ['quando','tipo','linha','id','status','erro','build']);
  sh.appendRow([now_(), tipo, linha, id, status, erro, RHIMOB_NT_CORRETORES.BUILD]);
}

function makeUserId_(conta, email) {
  return ('USR_' + clean_(conta) + '_' + clean_(email).split('@')[0])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function clean_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function toInt_(v, fallback) {
  const n = Number(String(v || '').replace(/\D+/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function isYes_(v) {
  return ['SIM','S','TRUE','1','YES'].indexOf(clean_(v).toUpperCase()) >= 0;
}

function now_() {
  return Utilities.formatDate(new Date(), RHIMOB_NT_CORRETORES.TZ, 'yyyy-MM-dd HH:mm:ss');
}
