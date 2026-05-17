
/**
 * RH IMOB CRM V11 — 08_Supabase_Conversa_Completa_Dedup.gs
 * Objetivo: reconstruir crm_mensagens com conversa completa e sem duplicidade.
 * Não envia WhatsApp. Não altera funil. Apenas lê planilhas e faz upsert em crm_mensagens.
 */

var RH08_CFG = {
  TABS: ['PAINEL_TIMELINE','HUMANO_LOG','SENT_LOG','OUTBOX','INBOX'],
  BATCH: 100,
  OPERATIONS: ['NOVOS_TALENTOS','CORRETORES_CRECI']
};

/**
 * Verifica se uma mensagem com esse msgId ja foi processada.
 * Chamado pelo 06_Orquestrador para evitar processar duplicatas.
 * Retorna true se ja existe em crm_mensagens, false caso contrario.
 */
function rh08_isDuplicado_(operation, msgId) {
  if (!msgId) return false;
  try {
    var rows = crmSupabaseFetch_(
      '/rest/v1/crm_mensagens?select=id' +
      '&operation=eq.' + encodeURIComponent(operation) +
      '&external_id=eq.' + encodeURIComponent(msgId) +
      '&limit=1',
      'get'
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    Logger.log('[rh08_isDuplicado_] ' + e.message);
    return false; // em caso de erro, processa mesmo assim
  }
}

function painel_45_supabase_auditar_conversas(){
  var res = rh08_supabaseRpc_('rpc_crm_debug_resumo', {});
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

function painel_46_supabase_reconstruir_conversas_completas(){
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Outro processo de conversa está em execução.');
  try {
    var campanhas = rh08_getCampanhas_();
    var totalLidas = 0, totalEnviadas = 0, totalIgnoradas = 0;
    var fontes = rh08_getFontes_(campanhas);

    fontes.forEach(function(fonte){
      var ss;
      try { ss = SpreadsheetApp.openById(fonte.spreadsheetId); } catch(e){ Logger.log('Fonte ignorada: '+fonte.spreadsheetId+' '+e.message); return; }
      RH08_CFG.TABS.forEach(function(tab){
        var sh = ss.getSheetByName(tab);
        if (!sh) return;
        var values = sh.getDataRange().getDisplayValues();
        if (!values || values.length < 2) return;
        var headers = rh08_headers_(values[0]);
        var rows = [];
        for (var i=1; i<values.length; i++) {
          totalLidas++;
          var msg = rh08_rowToMessage_(values[i], headers, tab, i+1, fonte.operation);
          if (!msg || !msg.operation || !msg.telefone_norm || !msg.message_text) { totalIgnoradas++; continue; }
          rows.push(msg);
          if (rows.length >= RH08_CFG.BATCH) {
            totalEnviadas += rh08_upsertMensagens_(rows);
            rows = [];
          }
        }
        if (rows.length) totalEnviadas += rh08_upsertMensagens_(rows);
      });
    });
    try { rh08_supabaseRpc_('rpc_crm_limpar_duplicidades_mensagens', {}); } catch(e) { Logger.log('Limpeza dedup RPC ausente ou falhou: '+e.message); }
    var out = {ok:true, lidas:totalLidas, enviadas:totalEnviadas, ignoradas:totalIgnoradas, gerado_em:new Date().toISOString()};
    Logger.log(JSON.stringify(out, null, 2));
    return out;
  } finally { lock.releaseLock(); }
}

function painel_47_supabase_limpar_duplicidades_conversas(){
  var res = rh08_supabaseRpc_('rpc_crm_limpar_duplicidades_mensagens', {});
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

function painel_49_supabase_instalar_gatilho_conversas_completas_1min(){
  painel_49_supabase_remover_gatilho_conversas_completas_();
  ScriptApp.newTrigger('painel_46_supabase_reconstruir_conversas_completas').timeBased().everyMinutes(1).create();
  return {ok:true, trigger:'painel_46_supabase_reconstruir_conversas_completas', intervalo:'1 minuto'};
}

function painel_49_supabase_remover_gatilho_conversas_completas_(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction && t.getHandlerFunction() === 'painel_46_supabase_reconstruir_conversas_completas') ScriptApp.deleteTrigger(t);
  });
}

function rh08_getFontes_(campanhas){
  var fontes = [];
  try { fontes.push({spreadsheetId: SpreadsheetApp.getActive().getId(), operation:''}); } catch(e) {}
  campanhas.forEach(function(c){
    if (c.chatbot_spreadsheet_id) fontes.push({spreadsheetId:c.chatbot_spreadsheet_id, operation:c.operation});
    if (c.source_spreadsheet_id) fontes.push({spreadsheetId:c.source_spreadsheet_id, operation:c.operation});
  });
  var seen = {};
  return fontes.filter(function(f){ var k=f.spreadsheetId+'|'+(f.operation||''); if(seen[k]) return false; seen[k]=true; return true; });
}

function rh08_getCampanhas_(){
  try {
    var data = rh08_supabaseRest_('/rest/v1/crm_campanhas?select=operation,label,source_spreadsheet_id,source_sheet_name,chatbot_spreadsheet_id,status&status=eq.ATIVA', 'get');
    return Array.isArray(data) ? data : [];
  } catch(e) {
    Logger.log('Não consegui ler crm_campanhas: '+e.message);
    return RH08_CFG.OPERATIONS.map(function(op){ return {operation:op}; });
  }
}

function rh08_rowToMessage_(row, h, tab, rowNumber, fallbackOperation){
  var operation = rh08_pick_(row,h,['operation','operação','operacao','campanha_operation','tipo_operacao']) || fallbackOperation || '';
  operation = rh08_normOperation_(operation);
  var phone = rh08_pick_(row,h,['telefone_norm','telefone','phone','celular','whatsapp','numero','número','contato']);
  phone = rh08_normPhone_(phone);
  var text = rh08_pick_(row,h,['message_text','mensagem','texto','body','conteudo','conteúdo','ultima_mensagem','resposta']);
  if (!text) return null;
  var dir = rh08_pick_(row,h,['direction','direcao','direção','tipo','sentido','origem_direcao']);
  dir = rh08_normDirection_(dir, tab);
  var at = rh08_pick_(row,h,['message_at','created_at','data_hora','timestamp','momento','momment','data','horario','horário']);
  var dateObj = rh08_parseDate_(at) || new Date();
  var sourceId = rh08_pick_(row,h,['id','message_id','timeline_id','source_id','zapi_id']) || (tab+'_'+rowNumber);
  var dedup = rh08_dedupKey_(operation, phone, dir, text, dateObj);
  return {
    operation: operation,
    telefone_norm: phone,
    direction: dir,
    message_text: text,
    message_type: rh08_pick_(row,h,['message_type','tipo_mensagem']) || 'text',
    source: 'CONVERSA_COMPLETA_'+tab,
    source_row: rowNumber,
    source_id: String(sourceId),
    message_at: dateObj.toISOString(),
    dedup_key: dedup,
    status_envio: rh08_pick_(row,h,['status','status_envio']) || '',
    operador: rh08_pick_(row,h,['operador','atendente','usuario','usuário']) || '',
    raw_payload: {tab:tab, row:rowNumber}
  };
}

function rh08_upsertMensagens_(rows){
  if (!rows || !rows.length) return 0;
  rh08_supabaseRest_('/rest/v1/crm_mensagens?on_conflict=operation,telefone_norm,dedup_key', 'post', rows, {'Prefer':'resolution=merge-duplicates,return=minimal'});
  return rows.length;
}

function rh08_supabaseRpc_(fn, payload){ return rh08_supabaseRest_('/rest/v1/rpc/'+fn, 'post', payload || {}); }

function rh08_supabaseRest_(path, method, payload, extraHeaders){
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty('CRM_SUPABASE_URL') || props.getProperty('SUPABASE_URL') || '').replace(/\/$/,'');
  var key = props.getProperty('CRM_SUPABASE_SERVICE_ROLE_KEY') || props.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) throw new Error('Configure CRM_SUPABASE_URL e CRM_SUPABASE_SERVICE_ROLE_KEY nas Propriedades do Script.');
  var headers = {apikey:key, Authorization:'Bearer '+key, 'Content-Type':'application/json'};
  if (extraHeaders) Object.keys(extraHeaders).forEach(function(k){ headers[k]=extraHeaders[k]; });
  var opt = {method:method || 'get', muteHttpExceptions:true, headers:headers};
  if (payload !== undefined) opt.payload = JSON.stringify(payload);
  var res = UrlFetchApp.fetch(url + path, opt);
  var code = res.getResponseCode();
  var txt = res.getContentText() || '';
  if (code < 200 || code >= 300) throw new Error('Supabase HTTP '+code+' em '+path+' => '+txt.slice(0,500));
  try { return txt ? JSON.parse(txt) : null; } catch(e){ return txt; }
}

function rh08_headers_(row){ var o={}; row.forEach(function(v,i){ o[rh08_normHeader_(v)] = i; }); return o; }
function rh08_normHeader_(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,''); }
function rh08_pick_(row,h,names){ for(var i=0;i<names.length;i++){ var k=rh08_normHeader_(names[i]); if(h[k] !== undefined) return row[h[k]]; } return ''; }
function rh08_normPhone_(v){ return String(v||'').replace(/\D+/g,''); }
function rh08_normOperation_(v){ v=String(v||'').toUpperCase(); if(v.indexOf('CORRET')>=0 || v.indexOf('CRECI')>=0) return 'CORRETORES_CRECI'; if(v.indexOf('NOVOS')>=0 || v.indexOf('TALENT')>=0) return 'NOVOS_TALENTOS'; return v; }
function rh08_normDirection_(v, tab){ v=String(v||'').toUpperCase(); tab=String(tab||'').toUpperCase(); if(v==='IN'||v.indexOf('RECEB')>=0||v.indexOf('LEAD')>=0||tab==='INBOX') return 'IN'; if(v==='OUT'||v.indexOf('ENVI')>=0||v.indexOf('OPERADOR')>=0||tab==='OUTBOX'||tab==='SENT_LOG'||tab==='HUMANO_LOG') return 'OUT'; return tab==='INBOX' ? 'IN' : 'OUT'; }
function rh08_parseDate_(v){ if(!v) return null; if(Object.prototype.toString.call(v)==='[object Date]') return v; var s=String(v).trim(); var d=new Date(s); if(!isNaN(d.getTime())) return d; var m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/); if(m) return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]),Number(m[5]),Number(m[6]||0)); return null; }
function rh08_normalizeText_(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
function rh08_dedupKey_(op, phone, dir, text, dateObj){ var min = Utilities.formatDate(dateObj || new Date(), 'GMT', 'yyyyMMddHHmm'); var raw=[op,phone,dir,rh08_normalizeText_(text),min].join('|'); var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw); return bytes.map(function(b){ var v=(b<0?b+256:b).toString(16); return v.length===1?'0'+v:v; }).join(''); }
