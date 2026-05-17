/**
 * 06_Supabase_Orquestrador.gs  — RH IMOB CRM
 * Ponto de entrada dos webhooks Z-API → Supabase.
 * Roteamento de mensagens recebidas, salvamento de leads e eventos.
 *
 * Alteração principal v22+:
 *   • Validação de operação usa ap_isOperacaoValida_() — dinâmico.
 *   • Suporte a N operações sem alteração de código.
 *   • Remove guard hardcoded ['NOVOS_TALENTOS','CORRETORES_CRECI'].indexOf().
 */

var RH06_ORQUESTRADOR_BUILD = 'RHIMOB_CRM_ORQUESTRADOR_V22_2026_05_17';

/* ══════════════════════════════════════════════════════════════════
   ENTRY POINT — doPost (Web App)
   ══════════════════════════════════════════════════════════════════ */

function doPost(e) {
  var result = { ok: false, build: RH06_ORQUESTRADOR_BUILD };
  try {
    var body    = JSON.parse(e.postData.contents || '{}');
    var params  = e.parameter || {};

    /* Operação vem no query-string (?operation=NOVOS_TALENTOS) ou no corpo */
    var operation = ap_normOperation(
      params.operation || body.operation || params.op || body.op || ''
    );

    if (!operation) {
      result.error = 'Operação ausente ou inválida.';
      result.hint  = 'Passe ?operation=NOVOS_TALENTOS (ou qualquer chave ativa em crm_operacoes) na URL.';
      return rh06_jsonOut_(result, 400);
    }

    /* Roteamento por tipo de evento Z-API */
    var tipo = String(body.type || body.tipo || '').toUpperCase();

    if (tipo === 'MESSAGE' || tipo === 'MENSAGEM' || tipo === 'RECEIVED_MESSAGE') {
      result = rh06_processarMensagem_(operation, body, params);
    } else if (tipo === 'STATUS' || tipo === 'MESSAGE_STATUS') {
      result = rh06_processarStatus_(operation, body);
    } else if (tipo === 'QRCODE' || tipo === 'CONNECTION') {
      result = { ok: true, ignorado: true, tipo: tipo };
    } else {
      /* Tipo desconhecido — tenta processar como mensagem */
      result = rh06_processarMensagem_(operation, body, params);
    }
  } catch (err) {
    result.error = String(err.message || err);
    Logger.log('[doPost] ERRO: ' + result.error);
  }
  return rh06_jsonOut_(result);
}

/* ══════════════════════════════════════════════════════════════════
   PROCESSAMENTO DE MENSAGEM RECEBIDA
   ══════════════════════════════════════════════════════════════════ */

function rh06_processarMensagem_(operation, body, params) {
  params = params || {};

  /* ── Extrai campos do payload Z-API ── */
  var phone     = ap_normPhone(
    body.phone || body.telefone || body.from ||
    (body.chatId ? body.chatId.replace('@s.whatsapp.net','').replace('@c.us','') : '') || ''
  );
  var nome      = ap_normName(body.senderName || body.pushName || body.nome || '');
  var texto     = ap_normText(body.text || body.body || body.message || body.mensagem || '');
  var msgId     = String(body.messageId || body.id || body.msgId || '');
  var fromMe    = !!(body.fromMe || body.isFromMe || body.from_me);
  var ts        = body.momment || body.timestamp || body.ts ||
                  Math.floor(Date.now() / 1000);
  var tsIso     = rh06_tsToIso_(ts);

  /* Ignora mensagens enviadas pelo próprio número (eco do chatbot) */
  if (fromMe) return { ok: true, ignorado: true, motivo: 'fromMe' };

  /* Dedup por messageId (delegado para 08_Conversa_Dedup) */
  if (msgId) {
    var duplo = rh08_isDuplicado_(operation, msgId);
    if (duplo) return { ok: true, ignorado: true, motivo: 'dedup', msgId: msgId };
  }

  if (!phone) return { ok: false, error: 'Telefone ausente no payload.' };

  /* ── Upsert do lead em crm_leads ── */
  var leadPayload = {
    operation:           operation,
    telefone_norm:       phone,
    telefone_display:    phone,
    ultima_mensagem:     texto ? texto.slice(0, 300) : '(mídia)',
    ultima_direcao:      'IN',
    ultima_atividade_em: tsIso,
    updated_at:          new Date().toISOString()
  };
  if (nome) {
    leadPayload.nome = nome;
  }

  try {
    crmSupabaseFetch_(
      '/rest/v1/crm_leads?on_conflict=operation,telefone_norm',
      'post',
      leadPayload,
      { Prefer: 'resolution=merge-duplicates,return=minimal' }
    );
  } catch (e) {
    Logger.log('[rh06] Erro upsert lead: ' + e.message);
  }

  /* ── Salva mensagem em crm_mensagens (tabela correta) ── */
  var mediaType = rh06_detectaMedia_(body);
  var msgPayload = {
    operation:    operation,
    telefone_norm: phone,
    external_id:  msgId || null,
    direction:    'IN',
    message_text: texto,
    message_type: mediaType ? mediaType.toUpperCase() : 'TEXT',
    source:       'ZAPI',
    message_at:   tsIso,
    operador:     AP_DEFAULT_OPERATOR
  };
  try {
    crmSupabaseFetch_('/rest/v1/crm_mensagens', 'post', msgPayload,
      { Prefer: 'return=minimal' });
  } catch (e) {
    Logger.log('[rh06] Erro salvar mensagem: ' + e.message);
  }

  /* ── Salva evento ── */
  try {
    crmSupabaseFetch_('/rest/v1/crm_eventos', 'post', [{
      operation:    operation,
      telefone_norm: phone,
      evento_tipo:  'MENSAGEM_RECEBIDA',
      evento_texto: texto ? texto.slice(0, 200) : '(mídia)',
      operador:     AP_DEFAULT_OPERATOR,
      evento_em:    tsIso,
      raw_payload:  { msgId: msgId, fromMe: fromMe }
    }], { Prefer: 'return=minimal' });
  } catch (e) { /* não fatal */ }

  /* ── Verifica quarentena ── */
  if (ap_campaignMapHasData_(operation) && !ap_isCampaignPhone_(operation, phone)) {
    crmSupabaseQuarentena_(operation, phone, 'WEBHOOK', 'FORA_CAMPANHA', texto, body);
    return { ok: true, status: 'QUARENTENA', phone: phone };
  }

  /* ── Dispara chatbot (se houver resposta automática configurada) ── */
  try {
    rh06_tentarAutoResposta_(operation, phone, texto, nome);
  } catch (e) {
    Logger.log('[rh06] autoResposta: ' + e.message);
  }

  return {
    ok:        true,
    operation: operation,
    phone:     phone,
    msgId:     msgId,
    dedup:     false
  };
}

/* ══════════════════════════════════════════════════════════════════
   PROCESSAMENTO DE STATUS (leitura, entrega, etc.)
   ══════════════════════════════════════════════════════════════════ */

function rh06_processarStatus_(operation, body) {
  var msgId  = String(body.messageId || body.id || '');
  var status = String(body.status || body.ackName || body.tipo || '').toUpperCase();
  if (!msgId || !status) return { ok: true, ignorado: true, motivo: 'status_sem_msgId' };

  try {
    crmSupabaseFetch_(
      '/rest/v1/crm_mensagens?external_id=eq.' + encodeURIComponent(msgId) +
      '&operation=eq.' + operation,
      'patch',
      { status_envio: status },
      { Prefer: 'return=minimal' }
    );
  } catch (e) { /* não fatal */ }

  return { ok: true, operation: operation, msgId: msgId, status: status };
}

/* ══════════════════════════════════════════════════════════════════
   RESPOSTA AUTOMÁTICA (stub — personalize por operação)
   ══════════════════════════════════════════════════════════════════ */

function rh06_tentarAutoResposta_(operation, phone, texto, nome) {
  /* Lê configuração de auto-resposta no Script Properties */
  var ativo = crmGetScriptProp_('AUTO_RESPOSTA_ATIVA_' + operation);
  if (ativo !== 'true') return;

  var modeloKey = 'AUTO_RESPOSTA_TEXTO_' + operation;
  var modelo    = crmGetScriptProp_(modeloKey);
  if (!modelo) return;

  var mensagem = modelo
    .replace('{primeiro_nome}', ap_primNome(nome) || 'Olá')
    .replace('{nome}', nome || '');

  api_sendZapiMessage({
    operation: operation,
    telefone:  phone,
    texto:     mensagem,
    operador:  AP_DEFAULT_OPERATOR
  });
}

/* ══════════════════════════════════════════════════════════════════
   QUARENTENA
   ══════════════════════════════════════════════════════════════════ */

function crmSupabaseQuarentena_(operation, phone, origem, motivo, texto, rawPayload) {
  try {
    crmSupabaseFetch_('/rest/v1/crm_quarentena', 'post', [{
      operation:    operation,
      telefone_norm: ap_normPhone(phone),
      origem:       origem || 'WEBHOOK',
      motivo:       motivo || 'DESCONHECIDO',
      texto:        ap_normText(texto).slice(0, 500),
      raw_payload:  rawPayload || {},
      criado_em:    new Date().toISOString()
    }], { Prefer: 'return=minimal' });
  } catch (e) {
    Logger.log('[quarentena] ' + e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════
   UTILITÁRIOS
   ══════════════════════════════════════════════════════════════════ */

function rh06_tsToIso_(ts) {
  if (!ts) return new Date().toISOString();
  var n = Number(ts);
  /* Timestamp em segundos (Unix) ou milissegundos */
  var d = n > 1e12 ? new Date(n) : new Date(n * 1000);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

function rh06_detectaMedia_(body) {
  if (body.image   || body.imageUrl)    return 'image';
  if (body.audio   || body.audioUrl)    return 'audio';
  if (body.video   || body.videoUrl)    return 'video';
  if (body.document|| body.documentUrl) return 'document';
  if (body.sticker || body.stickerUrl)  return 'sticker';
  return null;
}

function rh06_jsonOut_(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════════════════════════════════════════════════════════
   OUTBOX: processa itens pendentes (chamado pelo 11 ou por trigger)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Busca até `limit` itens pendentes no crm_outbox.
 * Compatível com painel_41 em outros arquivos.
 */
function painel_41_supabase_puxar_outbox(opts) {
  opts = opts || {};
  var limit = opts.limit || 10;
  try {
    var rows = crmSupabaseFetch_(
      '/rest/v1/crm_outbox' +
      '?select=*&status=eq.PENDENTE&order=criado_em.asc&limit=' + limit,
      'get'
    );
    return { ok: true, total: (rows || []).length, items: rows || [] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ══════════════════════════════════════════════════════════════════
   DEBUG
   ══════════════════════════════════════════════════════════════════ */

function painel_06_orquestrador_info() {
  var ops = ap_getOperacoesAtivas_();
  return {
    ok:    true,
    build: RH06_ORQUESTRADOR_BUILD,
    operacoes_ativas: ops.map(function(o) { return o.operation_key; }),
    total_operacoes:  ops.length,
    ap_isValida_NT:    ap_isOperacaoValida_('NOVOS_TALENTOS'),
    ap_isValida_CRECI: ap_isOperacaoValida_('CORRETORES_CRECI'),
    ap_isValida_FAKE:  ap_isOperacaoValida_('FAKE_OP')
  };
}

/**
 * Simula um webhook POST de teste para uma operação ativa.
 * Execute manualmente no editor para testar o fluxo.
 */
function painel_06_teste_webhook_simulado() {
  var ops = ap_getOperacoesAtivas_();
  if (!ops.length) return { ok: false, error: 'Nenhuma operação ativa.' };
  var op = ops[0].operation_key;

  var fakeBody = {
    type:       'MESSAGE',
    phone:      '5511999990000',
    senderName: 'Teste Simulado',
    text:       'Olá, quero mais informações.',
    messageId:  'TESTE_' + Date.now(),
    fromMe:     false,
    momment:    Math.floor(Date.now() / 1000)
  };
  var fakeE = {
    postData:  { contents: JSON.stringify(fakeBody) },
    parameter: { operation: op }
  };
  var result = doPost(fakeE);
  var parsed;
  try { parsed = JSON.parse(result.getContent()); } catch (_) { parsed = {}; }
  return { ok: true, operation: op, resultado: parsed };
}
