const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');

exports.dynamic = 'force-dynamic';

/* ── GET — lista operações ativas ─────────────────────────────── */
async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const rows = await sbFetch(
      `/rest/v1/crm_operacoes?select=operation_key,label,label_short,cor,ativo,ordem&ativo=eq.true&order=ordem.asc`,
      { method:'GET' }
    );
    return jsonResponse({ ok:true, operacoes: rows || [] });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

/* ── POST — cadastra ou atualiza operação ─────────────────────── */
async function POST(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const body = await req.json();
    const { operation_key, label, label_short, cor, ativo, ordem } = body;
    if(!operation_key || !label || !label_short)
      return jsonResponse({ ok:false, error:'operation_key, label e label_short são obrigatórios.' }, 400);
    const payload = {
      operation_key,
      label,
      label_short,
      cor:   cor   || null,
      ativo: ativo !== false,
      ordem: Number(ordem||10),
      updated_at: new Date().toISOString()
    };
    const rows = await sbFetch(
      `/rest/v1/crm_operacoes?select=operation_key,label,label_short,cor,ativo,ordem&on_conflict=operation_key`,
      { method:'POST', body: JSON.stringify(payload) }
    );
    const op = Array.isArray(rows) ? rows[0] : rows;
    return jsonResponse({ ok:true, operacao: op || payload });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

/* ── PATCH — ativa / desativa operação ────────────────────────── */
async function PATCH(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const body = await req.json();
    const { operation_key, ...fields } = body;
    if(!operation_key)
      return jsonResponse({ ok:false, error:'operation_key é obrigatório.' }, 400);
    const updates = { updated_at: new Date().toISOString() };
    if(fields.label       !== undefined) updates.label       = String(fields.label);
    if(fields.label_short !== undefined) updates.label_short = String(fields.label_short);
    if(fields.cor         !== undefined) updates.cor         = fields.cor;
    if(fields.ativo       !== undefined) updates.ativo       = !!fields.ativo;
    if(fields.ordem       !== undefined) updates.ordem       = Number(fields.ordem);
    await sbFetch(
      `/rest/v1/crm_operacoes?operation_key=eq.${q(operation_key)}`,
      { method:'PATCH', body: JSON.stringify(updates) }
    );
    return jsonResponse({ ok:true, operation_key, updates });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

module.exports = { GET, POST, PATCH };
