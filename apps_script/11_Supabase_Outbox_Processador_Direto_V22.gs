/**
 * 11_Supabase_Outbox_Processador_Direto_V22.gs  — RH IMOB CRM
 * Processador "direto" da fila crm_outbox:
 *   • Usa REST puro do Supabase (sem RPC de lock).
 *   • Chama a Z-API com credenciais resolvidas genericamente.
 *   • Suporta N operações — sem lista hardcoded.
 *
 * Alteração principal v22:
 *   • rh24_getZapiCreds_()  ordem de busca genérica por operation_key.
 *   • Validação de operação via ap_isOperacaoValida_() (01_Core.gs).
 *   • Removido check ['NOVOS_TALENTOS','CORRETORES_CRECI'].indexOf().
 *
 * Nomes internos mantêm prefixo rh24_ para compatibilidade com
 * chamadas que existem em outros arquivos.
 */

var RH24_PROCESSADOR_BUILD = 'RHIMOB_CRM_OUTBOX_PROCESSADOR_V22_2026_05_17';

/* ══════════════════════════════════════════════════════════════════
   ENTRY POINT — acionado por trigger a cada 1 min
   ══════════════════════════════════════════════════════════════════ */

function rh24_processarOutboxPendentes() {
  var inicio  = Date.now();
  var LIMITE  = 15;  // itens por rodada
  var enviados = 0, erros = 0, ignorados = 0;
  var log = [];

  var items;
  try {
    items = crmSupabaseFetch_(
      '/rest/v1/crm_outbox' +
      '?select=*&status=eq.PENDENTE' +
      '&or=(destino_tipo.eq.LEAD,destino_tipo.eq.OPERADOR,destino_tipo.is.null)' +
      '&order=criado_em.asc&limit=' + LIMITE,
      'get'
    );
  } catch (e) {
    Logger.log('[rh24] Erro ao buscar outbox: ' + e.message);
    return { ok: false, error: e.message };
  }

  if (!items || !items.length) {
    return { ok: true, total: 0, enviados: 0, erros: 0, ms: Date.now() - inicio };
  }

  for (var i = 0; i < items.length; i++) {
    var res = rh24_processarItem_(items[i]);
    if      (res.enviado)   enviados++;
    else if (res.ignorado)  ignorados++;
    else                    erros++;
    log.push({ id: res.id, status: res.status });

    /* Pausa curta para não sobrecarregar Z-API */
    if (i < items.length - 1) Utilities.sleep(350);
  }

  return {
    ok:        true,
    build:     RH24_PROCESSADOR_BUILD,
    total:     items.length,
    enviados:  enviados,
    erros:     erros,
    ignorados: ignorados,
    ms:        Date.now() - inicio,
    log:       log
  };
}

/* ══════════════════════════════════════════════════════════════════
   PROCESSAMENTO DE ITEM INDIVIDUAL
   ══════════════════════════════════════════════════════════════════ */

function rh24_processarItem_(item) {
  var id          = item && item.id;
  var operation   = ap_normOperation(item && (item.operation || ''));
  var raw         = rh24_parseRaw_(item && item.raw_payload);
  var destinoTipo = String(item.destino_tipo || raw.destino_tipo || 'LEAD').toUpperCase();
  var isOperador  = destinoTipo === 'OPERADOR';
  var phone       = ap_normPhone(item.telefone_norm || item.telefone_display || raw.telefone_norm || '');
  var leadPhone   = ap_normPhone(item.lead_telefone_norm || raw.lead_telefone_norm || phone);
  var texto       = ap_normText(item.message_text || raw.message_text || '');
  var operador    = ap_normText(item.operador || AP_DEFAULT_OPERATOR);

  var base = {
    id:           id,
    operation:    operation,
    destino_tipo: destinoTipo,
    phone:        phone,
    enviado:      false,
    ignorado:     false,
    status:       'INICIADO'
  };

  try {
    if (!id)        throw new Error('Item sem id.');
    if (!operation) throw new Error('Operação ausente no item id=' + id);
    /* ✅ Validação dinâmica — não hardcoded */
    if (!ap_isOperacaoValida_(operation)) throw new Error('Operação não cadastrada: ' + operation);
    if (!phone)     throw new Error('Telefone ausente no item id=' + id);
    if (!texto)     throw new Error('Mensagem vazia no item id=' + id);

    /* Whitelist de campanha só aplica para mensagens ao lead */
    if (!isOperador && ap_campaignMapHasData_(operation) && !ap_isCampaignPhone_(operation, phone)) {
      rh24_marcarStatus_(id, 'CANCELADO_FORA_CAMPANHA', 'Telefone fora da campanha.');
      crmSupabaseQuarentena_(operation, phone, 'CRM_OUTBOX', 'FORA_CAMPANHA_OUTBOX', texto, item);
      base.status   = 'CANCELADO_FORA_CAMPANHA';
      base.ignorado = true;
      return base;
    }

    /* Marca PROCESSANDO para evitar duplo envio */
    rh24_marcarStatus_(id, 'PROCESSANDO', '');

    /* Obtém credenciais Z-API para esta operação */
    var creds = rh24_getZapiCreds_(operation);
    if (!creds.url) throw new Error('Credenciais Z-API não configuradas para ' + operation);

    /* Envia via Z-API */
    var zapiRes = rh24_enviarZapi_(creds, phone, texto);
    var enviado = !!(zapiRes && zapiRes.zapiMessageId);
    var msgId   = enviado ? zapiRes.zapiMessageId : '';
    var errMsg  = enviado ? '' : (zapiRes && zapiRes.error ? zapiRes.error : 'Resposta inesperada da Z-API');

    /* Marca resultado */
    rh24_marcarResultado_(id, enviado, errMsg, {
      destino_tipo:       destinoTipo,
      lead_telefone_norm: leadPhone,
      zapi_message_id:    msgId,
      zapi_response:      zapiRes || {}
    });

    /* Registra evento CRM */
    if (enviado) {
      try {
        crmSupabaseFetch_('/rest/v1/crm_eventos', 'post', [{
          operation:    operation,
          telefone_norm: leadPhone || phone,
          evento_tipo:  isOperador ? 'ENCAMINHADO_OPERADOR_ENVIADO' : 'MENSAGEM_ENVIADA_OUTBOX',
          evento_texto: isOperador
            ? 'Mensagem enviada ao operador ' + (raw.operador_destino_nome || phone)
            : 'Mensagem enviada pelo CRM (outbox)',
          operador:     operador,
          evento_em:    new Date().toISOString(),
          raw_payload:  { outbox_id: id, destino_tipo: destinoTipo, zapi_msg_id: msgId }
        }], { Prefer: 'return=minimal' });
      } catch (_) {}
    }

    base.enviado = enviado;
    base.status  = enviado ? 'ENVIADO_ZAPI' : 'ERRO_ZAPI';
    base.msg_id  = msgId;
    base.error   = errMsg;
    return base;

  } catch (e) {
    var msg = String(e.message || e);
    Logger.log('[rh24] ERRO item ' + id + ': ' + msg);
    try { rh24_marcarResultado_(id, false, msg, { destino_tipo: destinoTipo }); } catch (_) {}
    base.status = 'ERRO_PROCESSAMENTO';
    base.error  = msg;
    return base;
  }
}

/* ══════════════════════════════════════════════════════════════════
   RESOLUÇÃO DE CREDENCIAIS Z-API — GENÉRICA POR OPERATION_KEY
   ══════════════════════════════════════════════════════════════════
 *
 * Ordem de tentativa para operation_key = "MINHA_OP":
 *
 *  1. ZAPI_SEND_URL_MINHA_OP           (URL completa pronta)
 *  2. ZAPI_INSTANCE_ID_MINHA_OP + ZAPI_TOKEN_MINHA_OP  (monta URL)
 *  3. ZAPI_SEND_URL_<label_short>      (ex: ZAPI_SEND_URL_NT)
 *  4. ZAPI_INSTANCE_ID_<label_short> + ZAPI_TOKEN_<label_short>
 *  5. Aliases históricos (CBTNT_*, CBT3_*, CBTCRECI_*)
 *  6. ZAPI_SEND_URL (global fallback)
 *
 * Retorna { url, token, instanceId } ou { url: '' } se não achou.
 * ══════════════════════════════════════════════════════════════════ */

function rh24_getZapiCreds_(operation) {
  var p    = PropertiesService.getScriptProperties().getProperties();
  var op   = String(operation || '').toUpperCase();
  var url  = '';
  var tok  = '';
  var inst = '';

  /* Descobre label_short para tentativas alternativas */
  var short = op;
  try {
    var ops = ap_getOperacoesAtivas_();
    for (var i = 0; i < ops.length; i++) {
      if (ops[i].operation_key === op) { short = (ops[i].label_short || op).toUpperCase(); break; }
    }
  } catch (_) {}

  /* ── 1. URL direta por operation_key ── */
  url = p['ZAPI_SEND_URL_' + op] || '';
  if (url) return { url: url, token: p['ZAPI_TOKEN_' + op] || p['ZAPI_CLIENT_TOKEN'] || '', instanceId: '' };

  /* ── 2. instanceId + token por operation_key ── */
  inst = p['ZAPI_INSTANCE_ID_' + op] || '';
  tok  = p['ZAPI_TOKEN_'       + op] || '';
  if (inst && tok) {
    return {
      url: 'https://api.z-api.io/instances/' + inst + '/token/' + tok + '/send-text',
      token: p['ZAPI_CLIENT_TOKEN'] || tok,
      instanceId: inst
    };
  }

  /* ── 3. URL direta por label_short ── */
  if (short && short !== op) {
    url = p['ZAPI_SEND_URL_' + short] || '';
    if (url) return { url: url, token: p['ZAPI_TOKEN_' + short] || p['ZAPI_CLIENT_TOKEN'] || '', instanceId: '' };
  }

  /* ── 4. instanceId + token por label_short ── */
  if (short && short !== op) {
    inst = p['ZAPI_INSTANCE_ID_' + short] || '';
    tok  = p['ZAPI_TOKEN_'       + short] || '';
    if (inst && tok) {
      return {
        url: 'https://api.z-api.io/instances/' + inst + '/token/' + tok + '/send-text',
        token: p['ZAPI_CLIENT_TOKEN'] || tok,
        instanceId: inst
      };
    }
  }

  /* ── 5. Aliases históricos (compatibilidade retroativa) ── */
  var aliases = rh24_aliasesHistoricos_(op, short, p);
  if (aliases.url) return aliases;

  /* ── 6. Fallback global ── */
  url = p['ZAPI_SEND_URL'] || p['ZAPI_URL'] || '';
  if (url) {
    return {
      url: url,
      token: p['ZAPI_TOKEN'] || p['ZAPI_CLIENT_TOKEN'] || '',
      instanceId: p['ZAPI_INSTANCE_ID'] || ''
    };
  }

  return { url: '', token: '', instanceId: '' };
}

/**
 * Aliases históricos — nomes reais usados nas Script Properties do projeto.
 *
 * NT    → CBTNT_ZAPI_INSTANCE_ID  /  CBTNT_ZAPI_TOKEN  /  CBTNT_ZAPI_CLIENT_TOKEN
 * CRECI → CBT3_ZAPI_INSTANCE_ID   /  CBT3_TOKEN         /  CBT3_ZAPI_CLIENT_TOKEN
 *
 * Caso migre para o padrão novo (ZAPI_INSTANCE_ID_NOVOS_TALENTOS etc.)
 * basta adicionar as propriedades novas — este bloco deixa de ser acionado.
 */
function rh24_aliasesHistoricos_(op, short, p) {
  /* ── NT / NOVOS_TALENTOS ── */
  if (op === 'NOVOS_TALENTOS' || short === 'NT') {
    var instNT = p['CBTNT_ZAPI_INSTANCE_ID'] || '';
    var tokNT  = p['CBTNT_ZAPI_TOKEN']       || '';
    var ctNT   = p['CBTNT_ZAPI_CLIENT_TOKEN']|| p['ZAPI_CLIENT_TOKEN'] || tokNT;
    if (instNT && tokNT) return {
      url: 'https://api.z-api.io/instances/' + instNT + '/token/' + tokNT + '/send-text',
      token: ctNT,
      instanceId: instNT
    };
  }

  /* ── CRECI / CORRETORES_CRECI ── */
  /* Atenção: a propriedade do token é CBT3_TOKEN (sem _ZAPI_) */
  if (op === 'CORRETORES_CRECI' || short === 'CRECI') {
    var instCR = p['CBT3_ZAPI_INSTANCE_ID'] || '';
    var tokCR  = p['CBT3_TOKEN']            || p['CBT3_ZAPI_TOKEN'] || '';
    var ctCR   = p['CBT3_ZAPI_CLIENT_TOKEN']|| p['ZAPI_CLIENT_TOKEN'] || tokCR;
    if (instCR && tokCR) return {
      url: 'https://api.z-api.io/instances/' + instCR + '/token/' + tokCR + '/send-text',
      token: ctCR,
      instanceId: instCR
    };
  }

  return { url: '' };
}

/* ══════════════════════════════════════════════════════════════════
   ENVIO VIA Z-API
   ══════════════════════════════════════════════════════════════════ */

function rh24_enviarZapi_(creds, phone, texto) {
  var payload = JSON.stringify({ phone: phone, message: texto });
  var options = {
    method:      'post',
    contentType: 'application/json',
    payload:     payload,
    muteHttpExceptions: true,
    headers:     {}
  };
  if (creds.token) options.headers['Client-Token'] = creds.token;

  try {
    var resp = UrlFetchApp.fetch(creds.url, options);
    var code = resp.getResponseCode();
    var body;
    try { body = JSON.parse(resp.getContentText()); } catch (_) { body = { raw: resp.getContentText() }; }
    if (code >= 200 && code < 300 && body.zapiMessageId) return body;
    body.error = body.error || body.message || ('HTTP ' + code);
    return body;
  } catch (e) {
    return { zapiMessageId: null, error: String(e.message || e) };
  }
}

/* ══════════════════════════════════════════════════════════════════
   CONTROLE DE STATUS NO SUPABASE
   ══════════════════════════════════════════════════════════════════ */

function rh24_marcarStatus_(id, status, obs) {
  try {
    crmSupabaseFetch_(
      '/rest/v1/crm_outbox?id=eq.' + encodeURIComponent(id),
      'patch',
      { status: status, obs_interna: obs || null, updated_at: new Date().toISOString() },
      { Prefer: 'return=minimal' }
    );
  } catch (e) {
    Logger.log('[rh24_marcarStatus_] ' + e.message);
  }
}

function rh24_marcarResultado_(id, enviado, errMsg, payload) {
  payload = payload || {};
  var patch = {
    status:          enviado ? 'ENVIADO' : 'ERRO',
    enviado:         !!enviado,
    zapi_message_id: payload.zapi_message_id || null,
    error_message:   errMsg || null,
    zapi_response:   payload.zapi_response || null,
    updated_at:      new Date().toISOString()
  };
  if (payload.lead_telefone_norm) patch.lead_telefone_norm = payload.lead_telefone_norm;
  if (payload.destino_tipo)       patch.destino_tipo       = payload.destino_tipo;
  try {
    crmSupabaseFetch_(
      '/rest/v1/crm_outbox?id=eq.' + encodeURIComponent(id),
      'patch', patch,
      { Prefer: 'return=minimal' }
    );
  } catch (e) {
    Logger.log('[rh24_marcarResultado_] ' + e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════
   UTILITÁRIOS
   ══════════════════════════════════════════════════════════════════ */

function rh24_parseRaw_(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw)); } catch (e) { return {}; }
}

/* ══════════════════════════════════════════════════════════════════
   TRIGGERS
   ══════════════════════════════════════════════════════════════════ */

function painel_60_instalar_trigger_outbox() {
  /* Remove triggers duplicados antes de criar */
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'rh24_processarOutboxPendentes') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('rh24_processarOutboxPendentes')
    .timeBased().everyMinutes(1).create();
  return { ok: true, mensagem: 'Trigger de 1 min instalado para rh24_processarOutboxPendentes.' };
}

function painel_61_remover_trigger_outbox() {
  var removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'rh24_processarOutboxPendentes') {
      ScriptApp.deleteTrigger(t);
      removidos++;
    }
  });
  return { ok: true, removidos: removidos };
}

function painel_62_processar_outbox_agora() {
  return rh24_processarOutboxPendentes();
}

/* ══════════════════════════════════════════════════════════════════
   DEBUG
   ══════════════════════════════════════════════════════════════════ */

function painel_63_credenciais_debug() {
  var ops = ap_getOperacoesAtivas_();
  var result = { ok: true, build: RH24_PROCESSADOR_BUILD, operacoes: [] };
  ops.forEach(function(o) {
    var creds = rh24_getZapiCreds_(o.operation_key);
    result.operacoes.push({
      operation_key: o.operation_key,
      label_short:   o.label_short,
      url_configurada: creds.url ? 'SIM (' + creds.url.slice(0, 50) + '...)' : 'NÃO',
      token_presente: !!(creds.token)
    });
  });
  return result;
}

function painel_64_outbox_info() {
  return {
    ok:    true,
    build: RH24_PROCESSADOR_BUILD,
    pendentes: painel_41_supabase_puxar_outbox({ limit: 5 })
  };
}
