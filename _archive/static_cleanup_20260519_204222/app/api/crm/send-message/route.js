const crypto = require('crypto');
const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse, normPhone } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');
exports.dynamic = 'force-dynamic';

async function POST(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const body = await req.json();
    const operation = body.operation || '';
    const leadTelefone = normPhone(body.telefone_norm || body.telefone || '');
    const destinoTipo = String(body.destino_tipo || 'LEAD').toUpperCase();
    const destinoTelefone = destinoTipo === 'OPERADOR' ? normPhone(body.telefone_destino || body.operador_destino_telefone || '') : leadTelefone;
    const message_text = String(body.message_text || '').trim();
    const operador = String(body.operador || 'Operador').trim();
    if(!operation || !leadTelefone || !message_text) return jsonResponse({ ok:false, error:'operation, telefone_norm e message_text são obrigatórios.' }, 400);
    if(destinoTipo === 'OPERADOR' && !destinoTelefone) return jsonResponse({ ok:false, error:'telefone_destino do operador é obrigatório.' }, 400);

    const external_id = body.external_id || crypto.createHash('sha256').update([operation,leadTelefone,destinoTelefone,message_text,Date.now()].join('|')).digest('hex').slice(0,40);
    const raw = {
      origem:'CRM_SITE', destino_tipo:destinoTipo, lead_telefone_norm:leadTelefone,
      operador_destino_nome: body.operador_destino_nome || '',
      operador_destino_funcao: body.operador_destino_funcao || '',
      lead_message_text: body.lead_message_text || '',
      quick_action: body.quick_action || '', quick_title: body.quick_title || ''
    };
    let data;
    try{
      data = await sbFetch('/rest/v1/rpc/rpc_crm_enfileirar_resposta', {
        method:'POST',
        body: JSON.stringify({
          p_operation:operation,
          p_telefone_norm:destinoTelefone,
          p_message_text:message_text,
          p_operador:operador,
          p_external_id:external_id,
          p_origem: destinoTipo === 'OPERADOR' ? 'CRM_OPERADOR' : 'CRM_SITE',
          p_raw_payload: raw
        })
      });
    }catch(rpcErr){
      const payload = [{
        operation,
        telefone_norm:destinoTelefone,
        telefone_display:destinoTelefone,
        message_text,
        operador,
        external_id,
        status:'PENDENTE',
        status_envio:'PENDENTE',
        origem: destinoTipo === 'OPERADOR' ? 'CRM_OPERADOR' : 'CRM_SITE',
        source: destinoTipo === 'OPERADOR' ? 'CRM_OPERADOR' : 'CRM_SITE',
        destino_tipo:destinoTipo,
        lead_telefone_norm:leadTelefone,
        operador_destino_nome: body.operador_destino_nome || '',
        operador_destino_funcao: body.operador_destino_funcao || '',
        raw_payload: raw,
        created_at:new Date().toISOString()
      }];
      data = await sbFetch('/rest/v1/crm_outbox?on_conflict=external_id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(payload) });
    }

    if(destinoTipo !== 'OPERADOR'){
      try{
        const now = new Date().toISOString();
        await sbFetch(`/rest/v1/crm_leads?operation=eq.${q(operation)}&telefone_norm=eq.${q(leadTelefone)}`, { method:'PATCH', body:JSON.stringify({ ultima_mensagem:message_text, ultima_direcao:'OUT', ultima_atividade_em:now, status_atendimento:'EM_ATENDIMENTO', bucket:'EM_ATENDIMENTO', operador }) });
      }catch(e){}
    }else{
      try{
        await sbFetch('/rest/v1/crm_eventos', { method:'POST', body:JSON.stringify([{ operation, telefone_norm:leadTelefone, evento_tipo:'ENCAMINHADO_OPERADOR', evento_texto:'Atendimento direcionado para '+(body.operador_destino_nome || destinoTelefone), operador, evento_em:new Date().toISOString(), raw_payload:raw }]) });
      }catch(e){}
    }
    return jsonResponse({ ok:true, status:'PENDENTE', destino_tipo:destinoTipo, message:'Mensagem enviada para a operação.', outbox:data });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}
module.exports = { POST };
