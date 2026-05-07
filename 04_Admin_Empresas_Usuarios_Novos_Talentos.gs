/**
 * RH IMOB • Plataforma Novos Talentos
 * ADMIN v1 — Empresas, usuários e login via planilha
 *
 * Objetivo:
 * - Ler ADMIN_EMPRESAS_NT e criar/atualizar nt_contas no Supabase.
 * - Ler ADMIN_USUARIOS_NT e criar/atualizar nt_usuarios_conta no Supabase.
 * - Opcionalmente criar o login no Supabase Auth quando CRIAR_AUTH = SIM.
 *
 * Segurança:
 * - NÃO coloque service_role no HTML, GitHub ou Vercel.
 * - Este arquivo lê SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY das Propriedades do Script.
 *
 * Propriedades necessárias:
 * SUPABASE_URL = https://SEU-PROJETO.supabase.co
 * SUPABASE_SERVICE_ROLE_KEY = service_role do Supabase
 *
 * Funções principais:
 * - setupAdminNovosTalentos
 * - processarAdminEmpresasNovosTalentos
 * - processarAdminUsuariosNovosTalentos
 * - processarAdminTudoNovosTalentos
 */

const RHIMOB_NT_ADMIN = {
  BUILD: 'RHIMOB_NT_ADMIN_EMPRESAS_USUARIOS_V1_2026_05_07',
  TIMEZONE: 'America/Sao_Paulo',
  PRODUCT_CODE: 'NOVOS_TALENTOS',

  SHEETS: {
    EMPRESAS: 'ADMIN_EMPRESAS_NT',
    USUARIOS: 'ADMIN_USUARIOS_NT',
    LOG: 'ADMIN_LOG_NT'
  },

  HEADERS: {
    EMPRESAS: [
      'ACAO',
      'conta_id',
      'nome_conta',
      'plano_tipo',
      'status',
      'limite_total',
      'limite_por_usuario',
      'usuarios_contratados',
      'observacao',
      'PROCESSAR',
      'RESULTADO',
      'ERRO',
      'ULTIMA_EXECUCAO',
      'produto_codigo',
      'created_at',
      'updated_at'
    ],

    USUARIOS: [
      'ACAO',
      'usuario_seed_id',
      'conta_id',
      'nome',
      'email_login',
      'senha_temporaria',
      'perfil',
      'status',
      'observacao',
      'CRIAR_AUTH',
      'auth_user_id',
      'PROCESSAR',
      'RESULTADO',
      'ERRO',
      'ULTIMA_EXECUCAO',
      'produto_codigo',
      'email_confirmado',
      'updated_at'
    ],

    LOG: [
      'quando',
      'tipo',
      'linha',
      'acao',
      'id',
      'resultado',
      'erro',
      'build'
    ]
  }
};

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('RH IMOB • Admin NT')
      .addItem('1. Preparar abas admin', 'setupAdminNovosTalentos')
      .addItem('2. Processar empresas', 'processarAdminEmpresasNovosTalentos')
      .addItem('3. Processar usuários/logins', 'processarAdminUsuariosNovosTalentos')
      .addItem('4. Processar tudo', 'processarAdminTudoNovosTalentos')
      .addSeparator()
      .addItem('Testar conexão Supabase', 'testarConexaoAdminNovosTalentos')
      .addToUi();
  } catch (err) {
    Logger.log('onOpen ignorado: ' + err);
  }
}

/**
 * Cria/valida cabeçalhos.
 * Não insere senha, não cria login e não altera dados existentes.
 */
function setupAdminNovosTalentos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheetAdmin_(ss, RHIMOB_NT_ADMIN.SHEETS.EMPRESAS, RHIMOB_NT_ADMIN.HEADERS.EMPRESAS);
  ensureSheetAdmin_(ss, RHIMOB_NT_ADMIN.SHEETS.USUARIOS, RHIMOB_NT_ADMIN.HEADERS.USUARIOS);
  ensureSheetAdmin_(ss, RHIMOB_NT_ADMIN.SHEETS.LOG, RHIMOB_NT_ADMIN.HEADERS.LOG);

  logAdmin_('SETUP', 0, 'setup', 'ADMIN', 'OK', '');
  return { ok: true, build: RHIMOB_NT_ADMIN.BUILD };
}

/**
 * Testa se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão funcionando.
 */
function testarConexaoAdminNovosTalentos() {
  const cfg = getSupaAdminConfig_();

  const res = UrlFetchApp.fetch(cfg.url + '/rest/v1/nt_contas?select=conta_id&limit=1', {
    method: 'get',
    muteHttpExceptions: true,
    headers: supaHeadersAdmin_()
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  logAdmin_('TESTE', 0, 'testar_conexao', 'Supabase', 'HTTP ' + code, body.slice(0, 500));

  if (code < 200 || code >= 300) {
    throw new Error('Falha de conexão Supabase. HTTP ' + code + ': ' + body);
  }

  return { ok: true, http: code };
}

/**
 * Processa empresas marcadas com PROCESSAR = SIM.
 */
function processarAdminEmpresasNovosTalentos() {
  setupAdminNovosTalentos();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(RHIMOB_NT_ADMIN.SHEETS.EMPRESAS);
  const data = getSheetObjectsAdmin_(sh);
  const idx = getHeaderIndexAdmin_(sh);

  let ok = 0;
  let fail = 0;

  data.rows.forEach((item) => {
    const rowNumber = item.__rowNumber;
    const row = item.data;

    if (!isYesAdmin_(row.PROCESSAR)) return;

    try {
      const payload = buildContaPayloadAdmin_(row);

      if (!payload.conta_id) throw new Error('conta_id obrigatório.');
      if (!payload.nome_conta) throw new Error('nome_conta obrigatório.');

      upsertSupaAdmin_('nt_contas', 'conta_id', [payload]);

      writeCellAdmin_(sh, rowNumber, idx.RESULTADO, 'OK: empresa criada/atualizada');
      writeCellAdmin_(sh, rowNumber, idx.ERRO, '');
      writeCellAdmin_(sh, rowNumber, idx.ULTIMA_EXECUCAO, nowAdmin_());
      writeCellAdmin_(sh, rowNumber, idx.PROCESSAR, 'NÃO');

      logAdmin_('EMPRESA', rowNumber, row.ACAO || 'CRIAR_ATUALIZAR', payload.conta_id, 'OK', '');
      ok++;
    } catch (err) {
      writeCellAdmin_(sh, rowNumber, idx.RESULTADO, 'ERRO');
      writeCellAdmin_(sh, rowNumber, idx.ERRO, String(err && err.message ? err.message : err));
      writeCellAdmin_(sh, rowNumber, idx.ULTIMA_EXECUCAO, nowAdmin_());

      logAdmin_('EMPRESA', rowNumber, row.ACAO || '', row.conta_id || '', 'ERRO', String(err && err.stack ? err.stack : err));
      fail++;
    }
  });

  return { ok: true, empresas_ok: ok, empresas_erro: fail };
}

/**
 * Processa usuários marcados com PROCESSAR = SIM.
 *
 * Se CRIAR_AUTH = SIM e auth_user_id estiver vazio:
 * - cria usuário no Supabase Auth usando email_login e senha_temporaria;
 * - grava auth_user_id de volta na planilha;
 * - cria/atualiza nt_usuarios_conta.
 *
 * Se auth_user_id já estiver preenchido:
 * - apenas cria/atualiza vínculo em nt_usuarios_conta.
 */
function processarAdminUsuariosNovosTalentos() {
  setupAdminNovosTalentos();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(RHIMOB_NT_ADMIN.SHEETS.USUARIOS);
  const data = getSheetObjectsAdmin_(sh);
  const idx = getHeaderIndexAdmin_(sh);

  let ok = 0;
  let fail = 0;

  data.rows.forEach((item) => {
    const rowNumber = item.__rowNumber;
    const row = item.data;

    if (!isYesAdmin_(row.PROCESSAR)) return;

    try {
      let authUserId = cleanAdmin_(row.auth_user_id);
      const email = cleanAdmin_(row.email_login).toLowerCase();

      if (!email) throw new Error('email_login obrigatório.');
      if (!row.conta_id) throw new Error('conta_id obrigatório.');
      if (!row.nome) throw new Error('nome obrigatório.');

      if (isYesAdmin_(row.CRIAR_AUTH) && !authUserId) {
        const password = cleanAdmin_(row.senha_temporaria);
        if (!password || password === 'CRIAR_SENHA_NO_SUPABASE_AUTH' || password === 'TROCAR_ANTES_DE_PROCESSAR') {
          throw new Error('Preencha senha_temporaria para criar o login ou informe auth_user_id existente.');
        }

        const authResp = criarUsuarioAuthAdmin_(email, password, isYesAdmin_(row.email_confirmado));
        authUserId = authResp.id;

        if (!authUserId) throw new Error('Supabase Auth não retornou ID do usuário.');

        writeCellAdmin_(sh, rowNumber, idx.auth_user_id, authUserId);

        /**
         * Por segurança, depois que o usuário é criado, removemos a senha da planilha.
         */
        writeCellAdmin_(sh, rowNumber, idx.senha_temporaria, 'CRIADA_NO_SUPABASE_AUTH');
      }

      const payload = buildUsuarioPayloadAdmin_(row, authUserId);

      if (!payload.usuario_seed_id) throw new Error('usuario_seed_id obrigatório.');
      if (!payload.auth_user_id) throw new Error('auth_user_id obrigatório. Crie no Auth ou informe manualmente.');

      upsertSupaAdmin_('nt_usuarios_conta', 'usuario_seed_id', [payload]);

      writeCellAdmin_(sh, rowNumber, idx.RESULTADO, 'OK: usuário/login vinculado');
      writeCellAdmin_(sh, rowNumber, idx.ERRO, '');
      writeCellAdmin_(sh, rowNumber, idx.ULTIMA_EXECUCAO, nowAdmin_());
      writeCellAdmin_(sh, rowNumber, idx.PROCESSAR, 'NÃO');

      logAdmin_('USUARIO', rowNumber, row.ACAO || 'CRIAR_ATUALIZAR', payload.usuario_seed_id, 'OK', '');
      ok++;
    } catch (err) {
      writeCellAdmin_(sh, rowNumber, idx.RESULTADO, 'ERRO');
      writeCellAdmin_(sh, rowNumber, idx.ERRO, String(err && err.message ? err.message : err));
      writeCellAdmin_(sh, rowNumber, idx.ULTIMA_EXECUCAO, nowAdmin_());

      logAdmin_('USUARIO', rowNumber, row.ACAO || '', row.usuario_seed_id || '', 'ERRO', String(err && err.stack ? err.stack : err));
      fail++;
    }
  });

  return { ok: true, usuarios_ok: ok, usuarios_erro: fail };
}

/**
 * Processa empresas primeiro e usuários depois.
 */
function processarAdminTudoNovosTalentos() {
  const empresas = processarAdminEmpresasNovosTalentos();
  const usuarios = processarAdminUsuariosNovosTalentos();

  return {
    ok: true,
    empresas,
    usuarios
  };
}

/* =========================================================
 * Build payloads
 * ========================================================= */

function buildContaPayloadAdmin_(row) {
  return {
    conta_id: normalizeIdAdmin_(row.conta_id),
    produto_codigo: cleanAdmin_(row.produto_codigo) || RHIMOB_NT_ADMIN.PRODUCT_CODE,
    nome_conta: cleanAdmin_(row.nome_conta),
    plano_tipo: cleanAdmin_(row.plano_tipo) || 'EMPRESARIAL',
    status: cleanAdmin_(row.status) || 'ATIVA',
    limite_total: toIntAdmin_(row.limite_total, 0),
    limite_por_usuario: toIntAdmin_(row.limite_por_usuario, 0),
    usuarios_contratados: toIntAdmin_(row.usuarios_contratados, 1),
    observacao: cleanAdmin_(row.observacao),
    created_at: cleanAdmin_(row.created_at) || nowIsoAdmin_(),
    updated_at: nowIsoAdmin_()
  };
}

function buildUsuarioPayloadAdmin_(row, authUserId) {
  return {
    usuario_seed_id: normalizeIdAdmin_(row.usuario_seed_id),
    conta_id: normalizeIdAdmin_(row.conta_id),
    produto_codigo: cleanAdmin_(row.produto_codigo) || RHIMOB_NT_ADMIN.PRODUCT_CODE,
    auth_user_id: cleanAdmin_(authUserId),
    nome: cleanAdmin_(row.nome),
    email_login: cleanAdmin_(row.email_login).toLowerCase(),
    senha_temporaria: '',
    perfil: cleanAdmin_(row.perfil) || 'OPERADOR',
    status: cleanAdmin_(row.status) || 'ATIVO',
    observacao: cleanAdmin_(row.observacao),
    updated_at: nowIsoAdmin_()
  };
}

/* =========================================================
 * Supabase helpers
 * ========================================================= */

function getSupaAdminConfig_() {
  const props = PropertiesService.getScriptProperties();

  const rawUrl = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');

  if (!rawUrl) throw new Error('Propriedade SUPABASE_URL não configurada.');
  if (!key) throw new Error('Propriedade SUPABASE_SERVICE_ROLE_KEY não configurada.');

  return {
    url: rawUrl.replace(/\/+$/, ''),
    key
  };
}

function supaHeadersAdmin_(extra) {
  const cfg = getSupaAdminConfig_();

  return Object.assign({
    apikey: cfg.key,
    Authorization: 'Bearer ' + cfg.key,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }, extra || {});
}

function upsertSupaAdmin_(table, conflict, rows) {
  const cfg = getSupaAdminConfig_();
  const url = cfg.url + '/rest/v1/' + encodeURIComponent(table) + '?on_conflict=' + encodeURIComponent(conflict);

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    payload: JSON.stringify(rows),
    headers: supaHeadersAdmin_({
      Prefer: 'resolution=merge-duplicates,return=minimal'
    })
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Erro Supabase ' + table + '. HTTP ' + code + ': ' + body.slice(0, 1500));
  }
}

/**
 * Cria usuário no Supabase Auth via endpoint admin.
 * Requer service_role.
 */
function criarUsuarioAuthAdmin_(email, password, emailConfirmado) {
  const cfg = getSupaAdminConfig_();
  const url = cfg.url + '/auth/v1/admin/users';

  const payload = {
    email: email,
    password: password,
    email_confirm: !!emailConfirmado,
    user_metadata: {
      origem: 'RH_IMOB_NOVOS_TALENTOS',
      criado_via: 'ADMIN_USUARIOS_NT'
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: supaHeadersAdmin_()
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code >= 200 && code < 300) {
    return JSON.parse(body);
  }

  /**
   * Se o e-mail já existir, o Supabase normalmente retorna erro.
   * Nesse caso, informe o auth_user_id manualmente na planilha e rode de novo.
   */
  throw new Error('Erro ao criar usuário Auth. HTTP ' + code + ': ' + body.slice(0, 1500));
}

/* =========================================================
 * Sheet helpers
 * ========================================================= */

function ensureSheetAdmin_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getMaxColumns() < header.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), header.length - sh.getMaxColumns());
  }

  const current = sh.getRange(1, 1, 1, header.length).getDisplayValues()[0];

  if (current.join('|') !== header.join('|')) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }

  return sh;
}

function getHeaderIndexAdmin_(sh) {
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const idx = {};
  header.forEach((h, i) => {
    if (h) idx[h] = i + 1;
  });
  return idx;
}

function getSheetObjectsAdmin_(sh) {
  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return { header: values[0] || [], rows: [] };

  const header = values[0];
  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const obj = {};
    let hasData = false;

    header.forEach((h, c) => {
      if (!h) return;
      obj[h] = values[r][c];
      if (values[r][c]) hasData = true;
    });

    if (hasData) {
      rows.push({
        __rowNumber: r + 1,
        data: obj
      });
    }
  }

  return { header, rows };
}

function writeCellAdmin_(sh, row, col, value) {
  if (!col) return;
  sh.getRange(row, col).setValue(value);
}

function logAdmin_(tipo, linha, acao, id, resultado, erro) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheetAdmin_(ss, RHIMOB_NT_ADMIN.SHEETS.LOG, RHIMOB_NT_ADMIN.HEADERS.LOG);

  sh.appendRow([
    nowAdmin_(),
    tipo,
    linha,
    acao,
    id,
    resultado,
    erro,
    RHIMOB_NT_ADMIN.BUILD
  ]);
}

/* =========================================================
 * Utils
 * ========================================================= */

function cleanAdmin_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function isYesAdmin_(value) {
  const v = cleanAdmin_(value).toUpperCase();
  return ['SIM', 'S', 'YES', 'Y', 'TRUE', '1', 'PROCESSAR'].indexOf(v) >= 0;
}

function toIntAdmin_(value, fallback) {
  const n = Number(String(value || '').replace(/\D+/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeIdAdmin_(value) {
  return cleanAdmin_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_:-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function nowAdmin_() {
  return Utilities.formatDate(new Date(), RHIMOB_NT_ADMIN.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function nowIsoAdmin_() {
  return new Date().toISOString();
}
