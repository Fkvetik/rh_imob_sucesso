/**
 * 01_Core.gs  — RH IMOB CRM
 * Constantes globais, utilitários de normalização e registro dinâmico
 * de operações.  Todos os outros arquivos dependem deste.
 *
 * Alteração principal v22+:
 *   • ap_getOperacoesAtivas_()  lê crm_operacoes no Supabase (cache por execução)
 *   • ap_isOperacaoValida_()    substitui os checks hardcoded indexOf
 *   • ap_normOperation()        aceita qualquer operation_key cadastrada
 *
 * NÃO há mais lista hardcoded ['NOVOS_TALENTOS','CORRETORES_CRECI'].
 * Para adicionar uma frente nova basta inserir em crm_operacoes — sem
 * alterar nenhum código.
 */

var RH01_CORE_BUILD = 'RHIMOB_CRM_CORE_V22_2026_05_17';

/* ── Operador padrão ──────────────────────────────────────────────── */
var AP_DEFAULT_OPERATOR = 'SITE_SUPABASE';

/* ── Cache de operações (por execução) ───────────────────────────── */
var _rh01_opCache = null;   // array de { operation_key, label, label_short, cor }
var _rh01_opSet   = null;   // Set de keys válidas (para isOperacaoValida_)

/**
 * Retorna array de operações ativas vindas do Supabase.
 * Lê uma vez por execução; usa fallback se a tabela não existir ainda.
 */
function ap_getOperacoesAtivas_() {
  if (_rh01_opCache) return _rh01_opCache;

  try {
    var rows = crmSupabaseFetch_(
      '/rest/v1/crm_operacoes?select=operation_key,label,label_short,cor,ordem' +
      '&ativo=eq.true&order=ordem.asc',
      'get'
    );
    if (Array.isArray(rows) && rows.length) {
      _rh01_opCache = rows;
      _rh01_opSet   = null;  // recria abaixo
      return _rh01_opCache;
    }
  } catch (e) {
    Logger.log('[ap_getOperacoesAtivas_] fallback: ' + e.message);
  }

  // Fallback hardcoded para não quebrar enquanto a tabela não existe
  _rh01_opCache = [
    { operation_key: 'NOVOS_TALENTOS',   label: 'Novos Talentos',   label_short: 'NT',    cor: '#4f46e5', ordem: 10 },
    { operation_key: 'CORRETORES_CRECI', label: 'Corretores CRECI', label_short: 'CRECI', cor: '#0284c7', ordem: 20 }
  ];
  return _rh01_opCache;
}

/**
 * Retorna true se a operation_key estiver cadastrada e ativa.
 * Usado em todos os guards que antes faziam indexOf hardcoded.
 */
function ap_isOperacaoValida_(op) {
  if (!op) return false;
  if (!_rh01_opSet) {
    _rh01_opSet = {};
    ap_getOperacoesAtivas_().forEach(function(o) { _rh01_opSet[o.operation_key] = true; });
  }
  return !!_rh01_opSet[String(op).toUpperCase()];
}

/**
 * Normaliza uma string para operation_key.
 * Aceita qualquer chave cadastrada; retorna '' se inválida.
 */
function ap_normOperation(raw) {
  if (!raw) return '';
  var key = String(raw).toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
  // Atalhos de compatibilidade histórica
  if (key === 'NT')       key = 'NOVOS_TALENTOS';
  if (key === 'CRECI')    key = 'CORRETORES_CRECI';
  // Aceita qualquer operação cadastrada
  return ap_isOperacaoValida_(key) ? key : '';
}

/**
 * Retorna label curto de uma operação (ex: 'NT', 'CRECI').
 */
function ap_opShort(op) {
  var ops = ap_getOperacoesAtivas_();
  for (var i = 0; i < ops.length; i++) {
    if (ops[i].operation_key === op) return ops[i].label_short || op;
  }
  return op ? op.slice(0, 6) : '?';
}

/* ── Normalização de telefone ─────────────────────────────────────── */
/**
 * Recebe qualquer formato de telefone e retorna somente dígitos,
 * com DDI 55 prefixado se brasileiro.
 */
function ap_normPhone(raw) {
  if (!raw) return '';
  var digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  // Remove DDI duplicado
  if (digits.length > 11 && digits.slice(0, 2) === '55') {
    var local = digits.slice(2);
    if (local.length === 10 || local.length === 11) digits = local;
  }
  // Celular BR: 11 dígitos (DDD + 9 + 8)
  if (digits.length === 11 && digits[2] === '9') return '55' + digits;
  // Fixo BR: 10 dígitos
  if (digits.length === 10) return '55' + digits;
  // Já completo com DDI
  if (digits.length >= 12) return digits;
  return digits;
}

/**
 * Variante que mantém DDI para comparações internacionais.
 */
function ap_normPhoneIntl(raw) {
  return ap_normPhone(raw);
}

/* ── Normalização de texto ────────────────────────────────────────── */
function ap_normText(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

function ap_normName(raw) {
  var s = ap_normText(raw);
  if (!s) return '';
  return s.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function ap_primNome(fullName) {
  var s = ap_normText(fullName);
  if (!s) return '';
  return s.split(/\s+/)[0];
}

/* ── Script Properties ────────────────────────────────────────────── */
function crmGetScriptProp_(key) {
  try {
    return PropertiesService.getScriptProperties().getProperty(key) || '';
  } catch (e) {
    return '';
  }
}

function crmSetScriptProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

/* ── HTTP para Supabase ───────────────────────────────────────────── */
/**
 * Função base de acesso ao Supabase REST/RPC.
 * Usada por 06, 09, 10, 11 e qualquer outro arquivo.
 *
 * @param {string} path   Ex: '/rest/v1/crm_leads?...'
 * @param {string} method 'get' | 'post' | 'patch' | 'delete'
 * @param {*}      body   Objeto JS (será serializado como JSON)
 * @param {Object} extraHeaders  Cabeçalhos adicionais (ex: { Prefer: '...' })
 * @returns {*} Resposta parseada (array, objeto ou null)
 */
function crmSupabaseFetch_(path, method, body, extraHeaders) {
  var props = PropertiesService.getScriptProperties();
  var url   = (props.getProperty('CRM_SUPABASE_URL') || '').replace(/\/$/, '');
  var key   = props.getProperty('CRM_SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) {
    throw new Error('Configure CRM_SUPABASE_URL e CRM_SUPABASE_SERVICE_ROLE_KEY nas Propriedades do Script.');
  }
  var headers = {
    apikey:        key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  };
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function(k) { headers[k] = extraHeaders[k]; });
  }
  var options = {
    method:            method || 'get',
    headers:           headers,
    muteHttpExceptions: true
  };
  if (body !== undefined && body !== null) {
    options.payload = JSON.stringify(body);
  }
  var res  = UrlFetchApp.fetch(url + path, options);
  var code = res.getResponseCode();
  var txt  = res.getContentText() || '';
  if (code < 200 || code >= 300) {
    throw new Error('Supabase HTTP ' + code + ' em ' + path + ' => ' + txt.slice(0, 400));
  }
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return txt; }
}

/* ── Mapa de campanha (whitelist de telefones) ───────────────────── */
/**
 * Retorna true se a operação tiver dados de campanha carregados
 * na planilha (cache_campanha_* ou similar).
 */
function ap_campaignMapHasData_(operation) {
  // Leitura lazy da planilha de campanha, se existir.
  // Se não houver planilha configurada, retorna false (sem restrição).
  try {
    var ssId = crmGetScriptProp_('CAMPANHA_SHEET_ID_' + operation) ||
               crmGetScriptProp_('CAMPANHA_SHEET_ID');
    if (!ssId) return false;
    // Cache simples por execução
    if (!_rh01_campaignMap) _rh01_campaignMap = {};
    if (_rh01_campaignMap[operation] === undefined) {
      _rh01_campaignMap[operation] = rh01_carregarCampanha_(ssId, operation);
    }
    return !!(Object.keys(_rh01_campaignMap[operation] || {}).length);
  } catch (e) {
    return false;
  }
}

var _rh01_campaignMap = null;

function rh01_carregarCampanha_(ssId, operation) {
  try {
    var ss    = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName(operation) || ss.getSheets()[0];
    var data  = sheet.getDataRange().getValues();
    var map   = {};
    for (var i = 1; i < data.length; i++) {
      var phone = ap_normPhone(String(data[i][0] || ''));
      if (phone) map[phone] = true;
    }
    return map;
  } catch (e) {
    return {};
  }
}

/**
 * Verifica se o telefone está na campanha.
 * Se não houver campanha carregada, libera por padrão.
 */
function ap_isCampaignPhone_(operation, phone) {
  if (!_rh01_campaignMap || !_rh01_campaignMap[operation]) return true;
  return !!_rh01_campaignMap[operation][ap_normPhone(phone)];
}

/* ── Utilitários de data ──────────────────────────────────────────── */
function ap_brDate(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  return Utilities.formatDate(d, 'America/Sao_Paulo', 'dd/MM/yyyy');
}

function ap_brTime(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  return Utilities.formatDate(d, 'America/Sao_Paulo', 'HH:mm');
}

function ap_brDateTime(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  return Utilities.formatDate(d, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
}

/* ── Debug ────────────────────────────────────────────────────────── */
function painel_01_core_info() {
  var ops = ap_getOperacoesAtivas_();
  return {
    ok:    true,
    build: RH01_CORE_BUILD,
    operacoes: ops.map(function(o) {
      return o.operation_key + ' (' + o.label_short + ')';
    }),
    total_operacoes: ops.length,
    ap_normOperation_NOVOS_TALENTOS:   ap_normOperation('NOVOS_TALENTOS'),
    ap_normOperation_CORRETORES_CRECI: ap_normOperation('CORRETORES_CRECI'),
    ap_normOperation_NT:               ap_normOperation('NT'),
    ap_normOperation_invalido:         ap_normOperation('INVALIDO_XYZ')
  };
}
