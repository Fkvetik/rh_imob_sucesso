/**
 * 10_Supabase_Outbox_Operador_V15.gs
 * Patch complementar para o orquestrador 06.
 * Permite crm_outbox com destino_tipo = OPERADOR sem bloquear por whitelist da campanha.
 * Mantém validação de campanha para mensagens normais ao lead.
 */

var RH10_OUTBOX_OPERADOR_BUILD = 'RHIMOB_CRM_OUTBOX_OPERADOR_V15_2026_05_16';

function painel_55_supabase_debug_outbox_operador_v15() {
  return {
    ok: true,
    build: RH10_OUTBOX_OPERADOR_BUILD,
    pendentes: painel_41_supabase_puxar_outbox({ limit: 10 })
  };
}

function crmSupabaseProcessarOutboxItem_(item) {
  var id = item && item.id;
  var operation = ap_normOperation(item && item.operation || '');
  var raw = rh10_parseRawPayload_(item && item.raw_payload);
  var destinoTipo = String(item.destino_tipo || raw.destino_tipo || 'LEAD').toUpperCase();
  var isOperador = destinoTipo === 'OPERADOR' || String(item.origem || '').toUpperCase().indexOf('OPERADOR') >= 0;
  var phone = ap_normPhone(item && (item.telefone_norm || item.telefone_display) || '');
  var leadPhone = ap_normPhone(item && item.lead_telefone_norm || raw.lead_telefone_norm || phone);
  var texto = ap_normText(item && item.message_text || '');
  var operador = ap_normText(item && item.operador || AP_DEFAULT_OPERATOR || 'SITE_SUPABASE');

  var base = {
    id: id,
    build: RH10_OUTBOX_OPERADOR_BUILD,
    operation: operation,
    destino_tipo: destinoTipo,
    telefone_destino: phone,
    lead_telefone: leadPhone,
    operador: operador,
    enviado: false,
    cancelado: false,
    status: 'INICIADO'
  };

  try {
    if (!id) throw new Error('Item sem id.');
    if (!operation || !ap_isOperacaoValida_(operation)) throw new Error('Operação inválida: ' + operation);
    if (!phone) throw new Error('Telefone de destino inválido.');
    if (!texto) throw new Error('Mensagem vazia.');

    // Mensagem para lead continua protegida pela whitelist da campanha.
    // Mensagem para operador é notificação interna e pode ir para telefone fora da campanha.
    if (!isOperador && ap_campaignMapHasData_(operation) && !ap_isCampaignPhone_(operation, phone)) {
      crmSupabaseQuarentena_(operation, phone, 'CRM_OUTBOX', 'FORA_CAMPANHA_OUTBOX', texto, item);
      rh10_marcarResultado_(id, false, 'Telefone fora da campanha oficial; envio bloqueado.', { destino_tipo: destinoTipo });
      base.status = 'CANCELADO_FORA_CAMPANHA';
      base.cancelado = true;
      return base;
    }

    var locked = rh10_marcarProcessando_(id);
    if (locked && locked.ok === false) {
      base.status = 'NAO_DISPONIVEL';
      base.error = locked.message || 'Não foi possível travar item.';
      return base;
    }

    var send = api_sendZapiMessage({
      operation: operation,
      telefone: phone,
      texto: texto,
      operador: operador,
      client_temp_id: item.external_id || item.request_id || id
    });

    var enviado = !!(send && send.enviado);
    var msgId = send && send.msg_id ? send.msg_id : '';
    var error = enviado ? '' : (send && (send.error || send.message) ? (send.error || send.message) : 'Falha desconhecida no envio');

    rh10_marcarResultado_(id, enviado, error, {
      destino_tipo: destinoTipo,
      lead_telefone_norm: leadPhone,
      zapi_message_id: msgId,
      zapi_response: send || {}
    });

    if (enviado) {
      try {
        crmSupabaseFetch_('/rest/v1/crm_eventos', 'post', [{
          operation: operation,
          telefone_norm: leadPhone || phone,
          evento_tipo: isOperador ? 'ENCAMINHADO_OPERADOR_ENVIADO' : 'OPERADOR_RESPONDEU',
          evento_texto: isOperador ? ('Mensagem enviada ao operador: ' + (raw.operador_destino_nome || phone)) : 'Mensagem enviada ao lead pelo CRM',
          operador: operador,
          evento_em: new Date().toISOString(),
          raw_payload: { outbox_id: id, destino_tipo: destinoTipo, telefone_destino: phone, lead_telefone_norm: leadPhone }
        }], { Prefer: 'return=minimal' });
      } catch (_) {}
    }

    base.enviado = enviado;
    base.status = enviado ? 'ENVIADO_ZAPI' : 'ERRO_ZAPI';
    base.msg_id = msgId;
    base.error = error;
    return base;
  } catch (e) {
    var msg = String(e && e.message || e);
    try { rh10_marcarResultado_(id, false, msg, { error: msg, destino_tipo: destinoTipo }); } catch (_) {}
    base.status = 'ERRO_PROCESSAMENTO';
    base.error = msg;
    return base;
  }
}

function rh10_parseRawPayload_(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw)); } catch (e) { return {}; }
}

function rh10_marcarProcessando_(id) {
  try {
    var r1 = crmSupabaseRpc_('rpc_crm_outbox_marcar_processando', { p_id: id, p_locked_by: 'apps_script_v15' });
    return r1 && r1.data ? r1.data : { ok: true };
  } catch (e1) {
    try {
      var r2 = crmSupabaseRpc_('rpc_crm_outbox_marcar_processando', { p_id: id });
      return r2 && r2.data ? r2.data : { ok: true };
    } catch (e2) {
      return { ok: false, message: String(e2 && e2.message || e2) };
    }
  }
}

function rh10_marcarResultado_(id, enviado, error, payload) {
  payload = payload || {};
  try {
    return crmSupabaseRpc_('rpc_crm_outbox_marcar_resultado', {
      p_id: id,
      p_enviado: !!enviado,
      p_zapi_message_id: payload.zapi_message_id || '',
      p_error: error || '',
      p_zapi_response: payload
    });
  } catch (e1) {
    return crmSupabaseRpc_('rpc_crm_outbox_marcar_resultado', {
      p_id: id,
      p_ok: !!enviado,
      p_error: error || '',
      p_raw_payload: payload
    });
  }
}
