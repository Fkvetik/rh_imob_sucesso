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
    const status_atendimento = body.status_atendimento || body.status || '';
    const operador = body.operador || '';
    if(!operation || !telefone || !status_atendimento) return jsonResponse({ ok:false, error:'operation, telefone_norm e status são obrigatórios.' },400);
    const patch = { status_atendimento, updated_at:new Date().toISOString() };
    if(operador) patch.operador = operador;
    if(status_atendimento === 'AGENDADO') { patch.bucket = 'AGENDADO'; patch.agenda_status = 'AGENDADO'; }
    if(status_atendimento === 'EM_ATENDIMENTO') patch.bucket = 'EM_ATENDIMENTO';
    if(status_atendimento === 'DESCARTADO') patch.bucket = 'DESCARTADO';
    const data = await sbFetch(`/rest/v1/crm_leads?operation=eq.${q(operation)}&telefone_norm=eq.${q(telefone)}`, { method:'PATCH', body:JSON.stringify(patch) });
    try{ await sbFetch('/rest/v1/crm_eventos', { method:'POST', body:JSON.stringify([{ operation, telefone_norm:telefone, evento_tipo:'STATUS_ALTERADO', evento_texto:'Status alterado para '+status_atendimento, operador, evento_em:new Date().toISOString() }]) }); }catch(e){}
    return jsonResponse({ ok:true, data });
  }catch(e){ return jsonResponse({ ok:false, error:e.message },500); }
}
module.exports = { POST };
