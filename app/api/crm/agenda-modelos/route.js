const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');

exports.dynamic = 'force-dynamic';

/* ── GET — lista modelos de uma operação ──────────────────────── */
async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation = u.searchParams.get('operation') || '';
    if(!operation) return jsonResponse({ ok:false, error:'operation é obrigatório.' }, 400);
    const rows = await sbFetch(
      `/rest/v1/crm_agenda_mensagens_modelos?select=id,operation,tipo,titulo,texto_modelo,ativo,offset_min_min,offset_min_max,updated_at&operation=eq.${q(operation)}&order=tipo.asc`,
      { method:'GET' }
    );
    return jsonResponse({ ok:true, modelos: rows || [] });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

/* ── PATCH — atualiza texto_modelo e/ou ativo ─────────────────── */
async function PATCH(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const body = await req.json();
    const operation = body.operation || '';
    const tipo      = body.tipo      || '';
    if(!operation || !tipo)
      return jsonResponse({ ok:false, error:'operation e tipo são obrigatórios.' }, 400);

    const updates = { updated_at: new Date().toISOString() };
    if(body.texto_modelo !== undefined) updates.texto_modelo = String(body.texto_modelo);
    if(body.ativo        !== undefined) updates.ativo        = !!body.ativo;
    if(body.titulo       !== undefined) updates.titulo       = String(body.titulo);

    if(Object.keys(updates).length === 1)
      return jsonResponse({ ok:false, error:'Nenhum campo para atualizar.' }, 400);

    await sbFetch(
      `/rest/v1/crm_agenda_mensagens_modelos?operation=eq.${q(operation)}&tipo=eq.${q(tipo)}`,
      { method:'PATCH', body: JSON.stringify(updates) }
    );
    return jsonResponse({ ok:true, operation, tipo, updates });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

module.exports = { GET, PATCH };
