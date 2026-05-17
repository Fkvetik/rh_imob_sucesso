/**
 * RH IMOB CRM V21 — 09_Supabase_Agenda_Lembretes.gs
 *
 * Lembretes automáticos em 4 estágios com texto editável via crm_agenda_mensagens_modelos.
 *
 * Tipos de lembrete:
 *   LEMBRETE_24H           — ~24h antes (janela 23h20 a 24h40)
 *   LEMBRETE_MANHA         — manhã do dia (7h–9h30, agendamento é hoje e falta > 90min)
 *   LEMBRETE_PREVIO_RANDOM — 60–90 min antes (janela aleatória nesse intervalo)
 *   LEMBRETE_INICIO        — 1–5 min antes
 *
 * Texto: lido de crm_agenda_mensagens_modelos (editável pelo painel CRM).
 *        Fallback hardcoded se o modelo não estiver cadastrado.
 *
 * Tabela de agendamentos: crm_agenda (tenta; fallback crm_agendamentos para retrocompatibilidade).
 * Tabela de log:          crm_agenda_lembretes_log
 *
 * Propriedades do Script obrigatórias:
 *   CRM_SUPABASE_URL, CRM_SUPABASE_SERVICE_ROLE_KEY
 *   + credenciais Z-API por operação (veja rh09_enviarMensagemOperacao_)
 */

var RH09_CFG = {
  BATCH:          50,
  TZ:             'America/Sao_Paulo',
  REAGENDAR_REGEX: /(reagendar|remarcar|outro dia|outro horario|outro horário|nao posso|não posso|mudar horario|mudar horário)/i
};

// Cache de modelos — recarregado a cada execução do gatilho
var _rh09ModelCache = null;

/* ──────────────────────────────────────────────────────────────
   FUNÇÕES PÚBLICAS (chamadas pelo menu / gatilho)
────────────────────────────────────────────────────────────── */

function painel_50_agenda_debug_lembretes() {
  var pendentes = rh09_buscarAgendamentosParaLembrete_();
  var agora = new Date();
  var debug = pendentes.slice(0, 8).map(function(a) {
    var dt = rh09_dataAgendamento_(a);
    var diffMin = dt ? Math.round((dt.getTime() - agora.getTime()) / 60000) : null;
    return {
      operation: a.operation, telefone_norm: a.telefone_norm,
      data: a.data_agendamento, hora: a.hora_agendamento,
      diffMin: diffMin,
      tipos_agora: rh09_tiposNesteMomento_(a)
    };
  });
  var out = { ok: true, pendentes: pendentes.length, debug: debug, gerado_em: agora.toISOString() };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function painel_51_agenda_debug_modelos() {
  _rh09ModelCache = null;
  var ops = rh09_buscarOperacoesAtivas_();
  var out = { ok: true, operacoes: ops.map(function(o){ return o.operation_key; }), modelos: {} };
  ops.forEach(function(op) {
    ['LEMBRETE_24H','LEMBRETE_MANHA','LEMBRETE_PREVIO_RANDOM','LEMBRETE_INICIO'].forEach(function(tipo) {
      var k = op.operation_key + '|' + tipo;
      out.modelos[k] = rh09_textoModelo_(op.operation_key, tipo) ? 'CONFIGURADO' : 'USANDO FALLBACK';
    });
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function painel_52_agenda_instalar_gatilho_15min() {
  painel_53_agenda_remover_gatilho_lembretes_();
  ScriptApp.newTrigger('painel_54_agenda_processar_agora')
    .timeBased().everyMinutes(15).create();
  return { ok: true, trigger: 'painel_54_agenda_processar_agora', intervalo: '15 minutos' };
}

function painel_53_agenda_remover_gatilho_lembretes_() {
  var nomes = [
    'painel_54_agenda_processar_agora',
    'painel_54_agenda_processar_agora_teste' // nome legado
  ];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (nomes.indexOf(t.getHandlerFunction ? t.getHandlerFunction() : '') >= 0)
      ScriptApp.deleteTrigger(t);
  });
}

function painel_54_agenda_processar_agora() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Agenda lembretes já está rodando — skipping.');
    return { ok: true, skipped: true };
  }
  _rh09ModelCache = null; // limpa cache a cada execução

  try {
    var enviados = 0, erros = 0;
    var ags = rh09_buscarAgendamentosParaLembrete_();

    ags.forEach(function(a) {
      var tipos = rh09_tiposNesteMomento_(a);
      tipos.forEach(function(tipo) {
        try {
          if (rh09_lembreteJaRegistrado_(a, tipo)) return;
          var texto = rh09_textoLembrete_(a, tipo);
          if (!texto) { Logger.log('Texto vazio para ' + tipo + ' / ' + a.telefone_norm); return; }
          rh09_enviarMensagemOperacao_(a.operation, a.telefone_norm, texto);
          rh09_registrarMensagem_(a, texto, tipo);
          rh09_registrarLembrete_(a, tipo, 'ENVIADO', texto);
          enviados++;
        } catch (e) {
          erros++;
          try { rh09_registrarLembrete_(a, tipo, 'ERRO', String(e.message || e)); } catch (_) {}
          Logger.log('Erro lembrete ' + tipo + ' / ' + a.telefone_norm + ': ' + e.message);
        }
      });
    });

    var reag = rh09_processarReagendamentos_();
    var out = {
      ok: true,
      lembretes_enviados: enviados,
      erros: erros,
      reagendamentos: reag,
      agendamentos_verificados: ags.length,
      gerado_em: new Date().toISOString()
    };
    Logger.log(JSON.stringify(out, null, 2));
    return out;
  } finally {
    lock.releaseLock();
  }
}

/* ──────────────────────────────────────────────────────────────
   LÓGICA DE TIPOS — quais lembretes disparar agora
────────────────────────────────────────────────────────────── */

function rh09_tiposNesteMomento_(a) {
  var dt = rh09_dataAgendamento_(a);
  if (!dt) return [];
  var agora = Date.now();
  var diffMin = Math.round((dt.getTime() - agora) / 60000);
  var tipos = [];

  // LEMBRETE_24H — janela: 23h20 até 24h40 antes
  if (diffMin >= 23 * 60 + 20 && diffMin <= 24 * 60 + 40) {
    tipos.push('LEMBRETE_24H');
  }

  // LEMBRETE_MANHA — manhã do dia, entre 7h e 9h30, agendamento ainda longe (> 90min)
  var hojeStr = Utilities.formatDate(new Date(agora), RH09_CFG.TZ, 'yyyy-MM-dd');
  var dataStr = String(a.data_agendamento || '').slice(0, 10);
  if (hojeStr === dataStr && diffMin > 90) {
    var hAtual = rh09_horaAtual_();
    if (hAtual >= 7 && hAtual < 9.5) tipos.push('LEMBRETE_MANHA');
  }

  // LEMBRETE_PREVIO_RANDOM — janela 60 a 90 min antes
  if (diffMin >= 60 && diffMin <= 90) {
    tipos.push('LEMBRETE_PREVIO_RANDOM');
  }

  // LEMBRETE_INICIO — 1 a 5 min antes
  if (diffMin >= 1 && diffMin <= 5) {
    tipos.push('LEMBRETE_INICIO');
  }

  return tipos;
}

function rh09_horaAtual_() {
  try {
    var s = Utilities.formatDate(new Date(), RH09_CFG.TZ, 'HH:mm');
    var p = s.split(':');
    return Number(p[0]) + Number(p[1]) / 60;
  } catch (_) {
    return new Date().getHours();
  }
}

/* ──────────────────────────────────────────────────────────────
   MODELOS DE TEXTO — lê do Supabase, fallback hardcoded
────────────────────────────────────────────────────────────── */

function rh09_carregarModelosSeNecessario_() {
  if (_rh09ModelCache !== null) return;
  _rh09ModelCache = {};
  try {
    var rows = rh09_supabaseRest_(
      '/rest/v1/crm_agenda_mensagens_modelos?select=operation,tipo,texto_modelo,ativo&ativo=eq.true&limit=200',
      'get'
    );
    (rows || []).forEach(function(m) {
      _rh09ModelCache[m.operation + '|' + m.tipo] = String(m.texto_modelo || '');
    });
    Logger.log('Modelos carregados: ' + Object.keys(_rh09ModelCache).length);
  } catch (e) {
    Logger.log('Aviso: falha ao carregar modelos (' + e.message + '). Usando fallbacks.');
  }
}

function rh09_textoModelo_(operation, tipo) {
  rh09_carregarModelosSeNecessario_();
  return _rh09ModelCache[operation + '|' + tipo] || '';
}

function rh09_textoLembrete_(a, tipo) {
  var dataBR = rh09_dataBR_(a.data_agendamento);
  var hora   = String(a.hora_agendamento || '').slice(0, 5);
  var nome   = String(a.nome || a.telefone_norm || '');
  var priNome = nome.trim().split(/\s+/)[0] || nome;
  var diaSem  = rh09_diaSemana_(a.data_agendamento);

  // 1) Tenta texto do Supabase (editado pelo painel)
  var modelo = rh09_textoModelo_(a.operation, tipo);
  if (modelo) {
    return modelo
      .replace(/\{primeiro_nome\}/g,        priNome)
      .replace(/\{nome\}/g,                 nome)
      .replace(/\{hora_agendamento\}/g,     hora)
      .replace(/\{data_agendamento\}/g,     dataBR)
      .replace(/\{dia_semana_agendamento\}/g, diaSem);
  }

  // 2) Fallback hardcoded por tipo
  var fallbacks = {
    LEMBRETE_24H:
      'Olá, ' + priNome + '! Passando para confirmar nossa reunião de ' +
      diaSem + ', ' + dataBR + ' às ' + hora +
      '. Se precisar reagendar, me avise por aqui.',

    LEMBRETE_MANHA:
      'Bom dia, ' + priNome + '! Hoje é o dia da nossa reunião às ' + hora +
      '. Qualquer dúvida pode me chamar aqui.',

    LEMBRETE_PREVIO_RANDOM:
      'Olá, ' + priNome + '! Nossa reunião começa em breve, hoje às ' + hora +
      '. Até já! 😊',

    LEMBRETE_INICIO:
      '⏰ ' + priNome + ', nossa reunião é agora às ' + hora + '! Pode entrar.'
  };

  return fallbacks[tipo] || '';
}

/* ──────────────────────────────────────────────────────────────
   BUSCAR AGENDAMENTOS
────────────────────────────────────────────────────────────── */

function rh09_buscarAgendamentosParaLembrete_() {
  var hoje = new Date();
  var start = Utilities.formatDate(new Date(hoje.getTime() - 2 * 60 * 60 * 1000), 'GMT', 'yyyy-MM-dd');
  var end   = Utilities.formatDate(new Date(hoje.getTime() + 25 * 60 * 60 * 1000), 'GMT', 'yyyy-MM-dd');

  var campos = 'id,operation,telefone_norm,data_agendamento,hora_agendamento,operador,status,observacao';
  var filtro = 'status=eq.AGENDADO&data_agendamento=gte.' + encodeURIComponent(start) +
               '&data_agendamento=lte.' + encodeURIComponent(end) +
               '&order=data_agendamento.asc,hora_agendamento.asc&limit=' + RH09_CFG.BATCH;

  // Tabela nova: crm_agenda
  try {
    var data = rh09_supabaseRest_('/rest/v1/crm_agenda?select=' + campos + '&' + filtro, 'get');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    // Fallback retrocompatível: crm_agendamentos
    Logger.log('crm_agenda falhou (' + e.message + '). Tentando crm_agendamentos...');
    try {
      var data2 = rh09_supabaseRest_('/rest/v1/crm_agendamentos?select=' + campos + '&' + filtro, 'get');
      return Array.isArray(data2) ? data2 : [];
    } catch (e2) {
      Logger.log('crm_agendamentos também falhou: ' + e2.message);
      return [];
    }
  }
}

/* ──────────────────────────────────────────────────────────────
   REAGENDAMENTO — detecta intenção e oferece slots
────────────────────────────────────────────────────────────── */

function rh09_processarReagendamentos_() {
  var since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  var rows = rh09_supabaseRest_(
    '/rest/v1/crm_mensagens?select=id,operation,telefone_norm,message_text,message_at' +
    '&direction=eq.IN&message_at=gte.' + encodeURIComponent(since) +
    '&order=message_at.desc&limit=150',
    'get'
  ) || [];

  var enviados = 0;
  rows.forEach(function(m) {
    if (!RH09_CFG.REAGENDAR_REGEX.test(String(m.message_text || ''))) return;
    var pseudo = { operation: m.operation, telefone_norm: m.telefone_norm, id: m.id };
    if (rh09_lembreteJaRegistrado_(pseudo, 'REAGENDAR_OPCOES')) return;
    var slots = rh09_buscarSlotsOperacao_(m.operation);
    var texto = 'Sem problema! As próximas opções disponíveis são:\n\n' +
                '1) ' + slots.slot1 + '\n' +
                '2) ' + slots.slot2 + '\n\n' +
                'Qual data fica melhor para você?';
    try {
      rh09_enviarMensagemOperacao_(m.operation, m.telefone_norm, texto);
      rh09_registrarMensagem_(pseudo, texto, 'REAGENDAR_OPCOES');
      rh09_registrarLembrete_(pseudo, 'REAGENDAR_OPCOES', 'ENVIADO', texto);
      enviados++;
    } catch (e) {
      Logger.log('Erro reagendamento ' + m.telefone_norm + ': ' + e.message);
    }
  });
  return enviados;
}

function rh09_buscarSlotsOperacao_(operation) {
  var p = PropertiesService.getScriptProperties();
  return {
    slot1: p.getProperty('SLOT1_' + operation) || 'próximo horário disponível (a confirmar)',
    slot2: p.getProperty('SLOT2_' + operation) || 'segundo horário disponível (a confirmar)'
  };
}

/* ──────────────────────────────────────────────────────────────
   OPERAÇÕES ATIVAS — lê crm_operacoes (com fallback)
────────────────────────────────────────────────────────────── */

function rh09_buscarOperacoesAtivas_() {
  try {
    var rows = rh09_supabaseRest_(
      '/rest/v1/crm_operacoes?select=operation_key,label,label_short&ativo=eq.true&order=ordem.asc',
      'get'
    );
    if (Array.isArray(rows) && rows.length) return rows;
  } catch (_) {}
  // Fallback se tabela crm_operacoes ainda não existir
  return [
    { operation_key: 'NOVOS_TALENTOS',   label: 'Novos Talentos',   label_short: 'NT'    },
    { operation_key: 'CORRETORES_CRECI', label: 'Corretores CRECI', label_short: 'CRECI' }
  ];
}

/* ──────────────────────────────────────────────────────────────
   ENVIO Z-API — genérico por operação
────────────────────────────────────────────────────────────── */

function rh09_enviarMensagemOperacao_(operation, telefone, texto) {
  var p    = PropertiesService.getScriptProperties().getProperties();
  var op   = String(operation || '').toUpperCase();

  // Convenções de nomes de propriedade suportadas (em ordem de prioridade):
  //   ZAPI_SEND_URL_{OP}            — URL completa legada
  //   ZAPI_INSTANCE_ID_{OP} + ZAPI_TOKEN_{OP}   — instância por operação
  //   CBTNT_ZAPI_INSTANCE_ID / CBTNT_ZAPI_TOKEN — Novos Talentos (legado)
  //   CBT3_ZAPI_INSTANCE_ID  / CBT3_ZAPI_TOKEN  — Corretores CRECI (legado)
  //   ZAPI_INSTANCE_ID / ZAPI_TOKEN              — fallback global

  var sendUrl     = p['ZAPI_SEND_URL_' + op] || p['ZAPI_SEND_TEXT_URL_' + op] || '';
  var clientToken = p['ZAPI_CLIENT_TOKEN_' + op] || '';

  if (!sendUrl) {
    // Monta URL pelo padrão z-api.io
    var candidatos = [
      { inst: p['ZAPI_INSTANCE_ID_' + op],   tok: p['ZAPI_TOKEN_' + op],   ct: p['ZAPI_CLIENT_TOKEN_' + op]   },
      { inst: p['CBTNT_ZAPI_INSTANCE_ID'],    tok: p['CBTNT_ZAPI_TOKEN'],   ct: p['CBTNT_ZAPI_CLIENT_TOKEN']   }, // NT legado
      { inst: p['CBT3_ZAPI_INSTANCE_ID'],     tok: p['CBT3_ZAPI_TOKEN'],    ct: p['CBT3_ZAPI_CLIENT_TOKEN']    }, // CRECI legado
      { inst: p['ZAPI_INSTANCE_ID'],          tok: p['ZAPI_TOKEN'],         ct: p['ZAPI_CLIENT_TOKEN']         }  // fallback global
    ];

    var cred = null;
    for (var i = 0; i < candidatos.length; i++) {
      if (candidatos[i].inst && candidatos[i].tok) { cred = candidatos[i]; break; }
    }
    if (!cred) {
      throw new Error(
        'Credenciais Z-API não encontradas para ' + operation + '.\n' +
        'Configure: ZAPI_SEND_URL_' + op + ' OU (ZAPI_INSTANCE_ID_' + op + ' + ZAPI_TOKEN_' + op + ')\n' +
        'nas Propriedades do Script.'
      );
    }
    sendUrl     = 'https://api.z-api.io/instances/' +
                  encodeURIComponent(cred.inst) + '/token/' +
                  encodeURIComponent(cred.tok)  + '/send-text';
    clientToken = cred.ct || '';
  }

  var headers = { 'Content-Type': 'application/json' };
  if (clientToken) headers['Client-Token'] = clientToken;

  var res = UrlFetchApp.fetch(sendUrl, {
    method: 'post',
    muteHttpExceptions: true,
    headers: headers,
    payload: JSON.stringify({ phone: telefone, message: texto })
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Z-API HTTP ' + code + ' para ' + operation + ': ' + res.getContentText().slice(0, 500));
  }
  return res.getContentText();
}

/* ──────────────────────────────────────────────────────────────
   REGISTRO NO SUPABASE
────────────────────────────────────────────────────────────── */

function rh09_registrarMensagem_(a, texto, source) {
  var now   = new Date();
  var dedup = rh09_sha_([
    a.operation, a.telefone_norm, 'OUT',
    rh09_normText_(texto),
    Utilities.formatDate(now, 'GMT', 'yyyyMMddHHmm')
  ].join('|'));

  rh09_supabaseRest_(
    '/rest/v1/crm_mensagens?on_conflict=operation,telefone_norm,dedup_key',
    'post',
    [{
      operation:    a.operation,
      lead_id:      a.lead_id || null,
      telefone_norm: a.telefone_norm,
      direction:    'OUT',
      message_text: texto,
      message_type: 'text',
      source:       'AGENDA_' + source,
      source_id:    String(a.id || 'agenda'),
      message_at:   now.toISOString(),
      dedup_key:    dedup,
      status_envio: 'ENVIADO',
      operador:     a.operador || 'AGENDA_AUTO'
    }],
    { Prefer: 'resolution=merge-duplicates,return=minimal' }
  );
}

function rh09_lembreteJaRegistrado_(a, tipo) {
  var agid = a.id ? '&agendamento_id=eq.' + encodeURIComponent(a.id) : '';
  var rows  = rh09_supabaseRest_(
    '/rest/v1/crm_agenda_lembretes_log?select=id' +
    '&operation=eq.' + encodeURIComponent(a.operation) +
    '&telefone_norm=eq.' + encodeURIComponent(a.telefone_norm) +
    '&tipo=eq.' + encodeURIComponent(tipo) + agid + '&limit=1',
    'get'
  );
  return !!(rows && rows.length > 0);
}

function rh09_registrarLembrete_(a, tipo, status, detalhe) {
  rh09_supabaseRest_(
    '/rest/v1/crm_agenda_lembretes_log?on_conflict=operation,telefone_norm,agendamento_id,tipo',
    'post',
    [{
      operation:      a.operation,
      telefone_norm:  a.telefone_norm,
      agendamento_id: a.id || null,
      tipo:           tipo,
      status:         status,
      enviado_em:     status === 'ENVIADO' ? new Date().toISOString() : null,
      detalhe:        String(detalhe || '').slice(0, 1000)
    }],
    { Prefer: 'resolution=merge-duplicates,return=minimal' }
  );
}

/* ──────────────────────────────────────────────────────────────
   UTILITÁRIOS
────────────────────────────────────────────────────────────── */

function rh09_dataAgendamento_(a) {
  if (!a || !a.data_agendamento || !a.hora_agendamento) return null;
  var t     = String(a.hora_agendamento).slice(0, 5);
  var parts = String(a.data_agendamento).split('-');
  if (parts.length !== 3) return null;
  var hp = t.split(':');
  return new Date(
    Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]),
    Number(hp[0] || 0), Number(hp[1] || 0), 0
  );
}

function rh09_dataBR_(v) {
  var p = String(v || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(v || '');
}

function rh09_diaSemana_(v) {
  try {
    var p = String(v || '').split('-');
    if (p.length !== 3) return '';
    var d    = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
    var dias = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    return dias[d.getDay()] || '';
  } catch (_) { return ''; }
}

function rh09_normText_(v) {
  return String(v || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function rh09_sha_(raw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/* ──────────────────────────────────────────────────────────────
   SUPABASE REST — camada de transporte
────────────────────────────────────────────────────────────── */

function rh09_supabaseRest_(path, method, payload, extraHeaders) {
  var props = PropertiesService.getScriptProperties();
  var url   = (props.getProperty('CRM_SUPABASE_URL') || props.getProperty('SUPABASE_URL') || '').replace(/\/$/, '');
  var key   = props.getProperty('CRM_SUPABASE_SERVICE_ROLE_KEY') || props.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key)
    throw new Error('Configure CRM_SUPABASE_URL e CRM_SUPABASE_SERVICE_ROLE_KEY nas Propriedades do Script.');

  var headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  if (extraHeaders) Object.keys(extraHeaders).forEach(function(k) { headers[k] = extraHeaders[k]; });

  var opt = { method: method || 'get', muteHttpExceptions: true, headers: headers };
  if (payload !== undefined && payload !== null) opt.payload = JSON.stringify(payload);

  var res  = UrlFetchApp.fetch(url + path, opt);
  var code = res.getResponseCode();
  var txt  = res.getContentText() || '';

  if (code < 200 || code >= 300)
    throw new Error('Supabase HTTP ' + code + ' em ' + path + ' => ' + txt.slice(0, 500));

  try { return txt ? JSON.parse(txt) : null; } catch (_) { return txt; }
}
