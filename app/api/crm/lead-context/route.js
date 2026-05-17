const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse } = require('../../../../lib/crmUtils');
const { sbFetch } = require('../../../../lib/supabaseRest');
exports.dynamic = 'force-dynamic';
async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const data = await sbFetch('/rest/v1/rpc/rpc_get_lead_context',{method:'POST', body:JSON.stringify({ p_operation:u.searchParams.get('operation'), p_telefone_norm:u.searchParams.get('telefone_norm') })});
    return jsonResponse({ok:true,data});
  }catch(e){ return jsonResponse({ok:false,error:e.message},500); }
}
module.exports={GET};
