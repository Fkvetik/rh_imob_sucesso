/**
 * RH IMOB • Novos Talentos
 * RESET DE SENHA SUPABASE AUTH pela planilha
 *
 * Use quando o site mostrar:
 * Invalid login credentials
 *
 * A planilha pode estar com e-mail/UID correto, mas a senha real do Supabase Auth pode estar diferente.
 *
 * Propriedades necessárias:
 * SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 *
 * Aba usada:
 * ADMIN_USUARIOS_NT
 *
 * Como preencher:
 * ACAO = RESETAR_SENHA
 * email_login = e-mail do usuário
 * senha_temporaria = nova senha temporária
 * auth_user_id = UID do Supabase Auth
 * PROCESSAR = SIM
 *
 * Depois de resetar, o script troca senha_temporaria por:
 * SENHA_REDEFINIDA_NO_SUPABASE_AUTH
 */

const RHIMOB_NT_RESET = {
  BUILD: 'RHIMOB_NT_RESET_SENHA_AUTH_V1_2026_05_07',
  TIMEZONE: 'America/Sao_Paulo',
  SHEET: 'ADMIN_USUARIOS_NT',
  LOG: 'ADMIN_LOG_NT'
};

function processarResetSenhaNovosTalentos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(RHIMOB_NT_RESET.SHEET);
  if (!sh) throw new Error('Aba ADMIN_USUARIOS_NT não encontrada.');

  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return { ok: true, total: 0 };

  const header = values[0];
  const idx = {};
  header.forEach((h, i) => { if (h) idx[h] = i; });

  const required = ['ACAO', 'email_login', 'senha_temporaria', 'auth_user_id', 'PROCESSAR', 'RESULTADO', 'ERRO', 'ULTIMA_EXECUCAO'];
  required.forEach((c) => {
    if (idx[c] == null) throw new Error('Coluna obrigatória ausente: ' + c);
  });

  let ok = 0;
  let erro = 0;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const processar = isYesReset_(row[idx.PROCESSAR]);
    const acao = cleanReset_(row[idx.ACAO]).toUpperCase();

    if (!processar || acao !== 'RESETAR_SENHA') continue;

    const linha = r + 1;
    const email = cleanReset_(row[idx.email_login]).toLowerCase();
    const senha = cleanReset_(row[idx.senha_temporaria]);
    const uid = cleanReset_(row[idx.auth_user_id]);

    try {
      if (!uid) throw new Error('auth_user_id obrigatório para resetar senha.');
      if (!email) throw new Error('email_login obrigatório.');
      if (!senha || senha === 'SENHA_REDEFINIDA_NO_SUPABASE_AUTH' || senha === 'CRIADA_NO_SUPABASE_AUTH') {
        throw new Error('Preencha uma nova senha temporária antes de processar.');
      }

      resetarSenhaAuthPorUid_(uid, senha);

      sh.getRange(linha, idx.RESULTADO + 1).setValue('OK: senha redefinida no Supabase Auth');
      sh.getRange(linha, idx.ERRO + 1).setValue('');
      sh.getRange(linha, idx.ULTIMA_EXECUCAO + 1).setValue(nowReset_());
      sh.getRange(linha, idx.senha_temporaria + 1).setValue('SENHA_REDEFINIDA_NO_SUPABASE_AUTH');
      sh.getRange(linha, idx.PROCESSAR + 1).setValue('NÃO');

      logReset_('RESET_SENHA', linha, email, 'OK', '');
      ok++;
    } catch (e) {
      sh.getRange(linha, idx.RESULTADO + 1).setValue('ERRO');
      sh.getRange(linha, idx.ERRO + 1).setValue(String(e && e.message ? e.message : e));
      sh.getRange(linha, idx.ULTIMA_EXECUCAO + 1).setValue(nowReset_());
      logReset_('RESET_SENHA', linha, email, 'ERRO', String(e && e.stack ? e.stack : e));
      erro++;
    }
  }

  return { ok: true, resetados: ok, erros: erro };
}

function resetarSenhaAuthPorUid_(uid, password) {
  const cfg = getResetConfig_();
  const url = cfg.url + '/auth/v1/admin/users/' + encodeURIComponent(uid);

  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    muteHttpExceptions: true,
    contentType: 'application/json',
    payload: JSON.stringify({
      password: password,
      email_confirm: true
    }),
    headers: {
      apikey: cfg.key,
      Authorization: 'Bearer ' + cfg.key,
      'Content-Type': 'application/json'
    }
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Erro ao resetar senha no Supabase Auth. HTTP ' + code + ': ' + body.slice(0, 1200));
  }
}

function getResetConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');

  if (!url) throw new Error('SUPABASE_URL não configurada nas Propriedades do Script.');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada nas Propriedades do Script.');

  return {
    url: url.replace(/\/+$/, ''),
    key: key
  };
}

function logReset_(tipo, linha, id, resultado, erro) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(RHIMOB_NT_RESET.LOG);
  if (!sh) {
    sh = ss.insertSheet(RHIMOB_NT_RESET.LOG);
    sh.getRange(1, 1, 1, 8).setValues([['quando','tipo','linha','acao','id','resultado','erro','build']]);
    sh.setFrozenRows(1);
  }
  sh.appendRow([nowReset_(), tipo, linha, 'RESETAR_SENHA', id, resultado, erro, RHIMOB_NT_RESET.BUILD]);
}

function cleanReset_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function isYesReset_(v) {
  return ['SIM', 'S', 'TRUE', '1', 'PROCESSAR'].indexOf(cleanReset_(v).toUpperCase()) >= 0;
}

function nowReset_() {
  return Utilities.formatDate(new Date(), RHIMOB_NT_RESET.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}
