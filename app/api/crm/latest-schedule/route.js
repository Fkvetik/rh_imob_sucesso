const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse, normPhone } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');
exports.dynamic = 'force-dynamic';
async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation = u.searchParams.get('operation') || '';
    const telefone = normPhone(u.searchParams.get('telefone_norm') || '');
    if(!operation || !telefone) return jsonResponse({ ok:false, error:'operation e telefone_norm são obrigatórios.' }, 400);
    const rows = await sbFetch(`/rest/v1/crm_agendamentos?select=*&operation=eq.${q(operation)}&telefone_norm=eq.${q(telefone)}&order=created_at.desc&limit=1`, { method:'GET' });
    return jsonResponse({ ok:true, agendamento: (rows && rows[0]) || null });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}
module.exports = { GET };
