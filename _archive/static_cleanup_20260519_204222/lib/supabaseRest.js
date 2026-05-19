const { cleanEnv } = require('./crmUtils');

function supabaseConfig(){
  const url = cleanEnv('CRM_SUPABASE_URL').replace(/\/$/, '');
  const key = cleanEnv('CRM_SUPABASE_SERVICE_ROLE_KEY');
  if(!url || !key) throw new Error('CRM_SUPABASE_URL ou CRM_SUPABASE_SERVICE_ROLE_KEY ausente. Rode CONFIGURAR_SUPABASE.cmd.');
  return { url, key };
}
function headers(extra={}){
  const { key } = supabaseConfig();
  return { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation', ...extra };
}
async function sbFetch(path, opts={}){
  const { url } = supabaseConfig();
  const res = await fetch(url + path, { ...opts, headers: headers(opts.headers||{}) });
  const text = await res.text();
  let data = null; try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
  if(!res.ok){
    const msg = typeof data === 'object' ? (data.message || data.error || JSON.stringify(data)) : String(data||'');
    throw new Error('Supabase HTTP '+res.status+': '+msg);
  }
  return data;
}
function q(v){ return encodeURIComponent(v == null ? '' : String(v)); }
module.exports = { sbFetch, supabaseConfig, q };
