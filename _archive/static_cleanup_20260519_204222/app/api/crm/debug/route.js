const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse, cleanEnv } = require('../../../../lib/crmUtils');
const { sbFetch } = require('../../../../lib/supabaseRest');
exports.dynamic = 'force-dynamic';

async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  const out = { ok:true, generated_at:new Date().toISOString(), env:{ CRM_SUPABASE_URL:!!cleanEnv('CRM_SUPABASE_URL'), CRM_SUPABASE_SERVICE_ROLE_KEY:!!cleanEnv('CRM_SUPABASE_SERVICE_ROLE_KEY'), CRM_PANEL_TOKEN:!!cleanEnv('CRM_PANEL_TOKEN'), CRM_ALLOWED_ORIGIN:cleanEnv('CRM_ALLOWED_ORIGIN','*'), CRM_LOCAL_BYPASS:cleanEnv('CRM_LOCAL_BYPASS','') }, supabase:{} };
  try{ out.supabase.rpc = await sbFetch('/rest/v1/rpc/rpc_crm_debug_resumo',{method:'POST',body:'{}'}); }catch(e){ out.supabase.rpc_error = e.message; }
  try{ out.supabase.campanhas = await sbFetch('/rest/v1/crm_campanhas?select=operation,label,status,updated_at&order=operation.asc',{method:'GET'}); }catch(e){ out.supabase.campanhas_error = e.message; }
  try{ out.supabase.outbox_pendentes = await sbFetch('/rest/v1/crm_outbox?select=id,operation,telefone_norm,status,created_at&status=eq.PENDENTE&limit=20',{method:'GET'}); }catch(e){ out.supabase.outbox_error = e.message; }
  return jsonResponse(out);
}
module.exports = { GET };
