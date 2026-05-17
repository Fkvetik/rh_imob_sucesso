const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');

exports.dynamic = 'force-dynamic';

/* ── GET — lista notas de um lead ─────────────────────────────── */
async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation    = u.searchParams.get('operation')    || '';
    const telefone_norm = u.searchParams.get('telefone_norm') || '';
    if(!operation || !telefone_norm)
      return jsonResponse({ ok:false, error:'operation e telefone_norm são obrigatórios.' }, 400);
    const rows = await sbFetch(
      `/rest/v1/crm_notas?select=id,operation,telefone_norm,operador,nota,created_at&operation=eq.${q(operation)}&telefone_norm=eq.${q(telefone_norm)}&order=created_at.desc&limit=50`,
      { method:'GET' }
    );
    return jsonResponse({ ok:true, notes: rows || [] });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

/* ── POST — cria nova nota ────────────────────────────────────── */
async function POST(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const body = await req.json();
    const operation     = body.operation     || '';
    const telefone_norm = body.telefone_norm || '';
    const nota          = String(body.nota   || '').trim();
    const operador      = String(body.operador || '');
    if(!operation || !telefone_norm || !nota)
      return jsonResponse({ ok:false, error:'operation, telefone_norm e nota são obrigatórios.' }, 400);
    const rows = await sbFetch(
      `/rest/v1/crm_notas?select=id,operation,telefone_norm,operador,nota,created_at`,
      { method:'POST', body: JSON.stringify({ operation, telefone_norm, operador, nota }) }
    );
    const note = Array.isArray(rows) ? rows[0] : rows;
    return jsonResponse({ ok:true, note: note || { operation, telefone_norm, operador, nota, created_at: new Date().toISOString() } });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

/* ── DELETE — remove nota por id ─────────────────────────────── */
async function DELETE(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const id = u.searchParams.get('id') || '';
    if(!id) return jsonResponse({ ok:false, error:'id é obrigatório.' }, 400);
    await sbFetch(`/rest/v1/crm_notas?id=eq.${q(id)}`, { method:'DELETE' });
    return jsonResponse({ ok:true });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

module.exports = { GET, POST, DELETE };
