const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse, normPhone } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');
exports.dynamic = 'force-dynamic';

async function POST(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const body = await req.json();
    const operation = body.operation || '';
    const telefone = normPhone(body.telefone_norm || '');
    const data_agendamento = body.data_agendamento || '';
    const hora_agendamento = body.hora_agendamento || '';
    const operador = body.operador || '';
    const status = body.status || 'AGENDADO';
    const observacao = body.observacao || '';
    if(!operation || !telefone || !data_agendamento || !hora_agendamento) return jsonResponse({ ok:false, error:'operation, telefone_norm, data_agendamento e hora_agendamento são obrigatórios.' },400);
    let lead_id = null;
    try{
      const lead = await sbFetch(`/rest/v1/crm_leads?select=id&operation=eq.${q(operation)}&telefone_norm=eq.${q(telefone)}&limit=1`, { method:'GET' });
      lead_id = lead && lead[0] && lead[0].id;
    }catch(e){}
    const payload = [{ operation, lead_id, telefone_norm:telefone, data_agendamento, hora_agendamento, operador, status, observacao, raw_snapshot:{ origem:'CRM_SITE' } }];
    const data = await sbFetch('/rest/v1/crm_agendamentos', { method:'POST', body:JSON.stringify(payload) });
    await sbFetch(`/rest/v1/crm_leads?operation=eq.${q(operation)}&telefone_norm=eq.${q(telefone)}`, { method:'PATCH', body:JSON.stringify({ status_atendimento:'AGENDADO', bucket:'AGENDADO', agenda_status:'AGENDADO', operador, updated_at:new Date().toISOString() }) });
    try{ await sbFetch('/rest/v1/crm_eventos', { method:'POST', body:JSON.stringify([{ operation, lead_id, telefone_norm:telefone, evento_tipo:'AGENDAMENTO_CRIADO', evento_texto:`Agendamento confirmado para ${data_agendamento} ${hora_agendamento}`, operador, evento_em:new Date().toISOString() }]) }); }catch(e){}
    return jsonResponse({ ok:true, data, agendamento: data && data[0] ? data[0] : { operation, telefone_norm:telefone, data_agendamento, hora_agendamento, operador, status, observacao } });
  }catch(e){ return jsonResponse({ ok:false, error:e.message },500); }
}
module.exports = { POST };
