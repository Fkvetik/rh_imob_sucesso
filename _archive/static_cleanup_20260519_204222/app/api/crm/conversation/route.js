const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse, dedupMessages } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');
exports.dynamic = 'force-dynamic';

async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation = u.searchParams.get('operation');
    const telefone = u.searchParams.get('telefone_norm');
    if(!operation || !telefone) return jsonResponse({ ok:false, error:'operation e telefone_norm são obrigatórios.' }, 400);
    const path = `/rest/v1/crm_mensagens?select=id,operation,telefone_norm,direction,message_text,message_type,source,message_at,status_envio,operador,created_at&operation=eq.${q(operation)}&telefone_norm=eq.${q(telefone)}&order=message_at.asc,created_at.asc&limit=600`;
    const rows = await sbFetch(path, { method:'GET' });
    const messages = dedupMessages(rows || []);
    return jsonResponse({ ok:true, messages, total:messages.length, original_total:(rows||[]).length });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}
module.exports = { GET };
