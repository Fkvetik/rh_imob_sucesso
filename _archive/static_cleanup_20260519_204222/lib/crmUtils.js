function cleanEnv(name, fallback=''){
  const v = process.env[name];
  if(v === undefined || v === null) return fallback;
  return String(v).trim();
}
function jsonResponse(data, status=200, headers={}){
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json; charset=utf-8', ...headers }});
}
function normPhone(v){ return String(v||'').replace(/\D+/g,''); }
function normalizeText(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
function minuteKey(dateLike){
  const d = dateLike ? new Date(dateLike) : new Date();
  if(Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0,16);
}
function dedupMessages(messages){
  const seen = new Set();
  const out = [];
  for(const m of (messages||[])){
    const key = [String(m.direction||'').toUpperCase(), normalizeText(m.message_text||m.texto||''), minuteKey(m.message_at || m.created_at)].join('|');
    if(seen.has(key)) continue;
    seen.add(key); out.push(m);
  }
  return out.sort((a,b)=> new Date(a.message_at||a.created_at||0) - new Date(b.message_at||b.created_at||0));
}
module.exports = { cleanEnv, jsonResponse, normPhone, dedupMessages, normalizeText };
