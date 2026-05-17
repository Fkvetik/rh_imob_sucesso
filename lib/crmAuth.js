const { cleanEnv, jsonResponse } = require('./crmUtils');

function assertAuth(req){
  const isLocal = req.headers.get('host')?.includes('localhost') || req.headers.get('host')?.includes('127.0.0.1');
  const localBypass = cleanEnv('CRM_LOCAL_BYPASS','SIM').toUpperCase() === 'SIM';
  if(isLocal && localBypass) return null;
  const expected = cleanEnv('CRM_PANEL_TOKEN');
  const got = (req.headers.get('x-crm-token') || '').trim();
  if(!expected) return jsonResponse({ ok:false, error:'CRM_PANEL_TOKEN não configurado no servidor.' }, 500);
  if(got !== expected) return jsonResponse({ ok:false, error:'Token operacional inválido.' }, 401);
  return null;
}
module.exports = { assertAuth };
