const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');

exports.dynamic = 'force-dynamic';

async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation    = u.searchParams.get('operation') || '';
    const telefone_norm = u.searchParams.get('telefone_norm') || '';
    const agendamento_id = u.searchParams.get('agendamento_id') || '';
    if(!operation || !telefone_norm)
      return jsonResponse({ ok:false, error:'operation e telefone_norm obrigatórios' }, 400);
    let path = `/rest/v1/crm_agenda_lembretes_log?select=id,operation,telefone_norm,agendamento_id,tipo,status,enviado_em,erro,created_at&operation=eq.${q(operation)}&telefone_norm=eq.${q(telefone_norm)}&order=created_at.desc&limit=60`;
    if(agendamento_id) path += `&agendamento_id=eq.${q(agendamento_id)}`;
    const reminders = await sbFetch(path, { method:'GET' });
    return jsonResponse({ ok:true, reminders: reminders || [] });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}
module.exports = { GET };
