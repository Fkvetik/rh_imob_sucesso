const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');
exports.dynamic = 'force-dynamic';

function isoDate(d){ return d.toISOString().slice(0,10); }

async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation = u.searchParams.get('operation') || 'NOVOS_TALENTOS';
    const limit = Math.min(Number(u.searchParams.get('limit')||180), 300);
    const hoje = new Date();
    const de = u.searchParams.get('from') || isoDate(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()-1));
    const ate = u.searchParams.get('to') || isoDate(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()+14));
    const rows = await sbFetch(`/rest/v1/crm_agendamentos?select=id,operation,lead_id,telefone_norm,data_agendamento,hora_agendamento,operador,status,observacao,created_at,updated_at&operation=eq.${q(operation)}&data_agendamento=gte.${q(de)}&data_agendamento=lte.${q(ate)}&order=data_agendamento.asc,hora_agendamento.asc&limit=${limit}`, { method:'GET' });
    let leadsByPhone = {};
    const phones = Array.from(new Set((rows||[]).map(r=>r.telefone_norm).filter(Boolean))).slice(0,200);
    if(phones.length){
      try{
        const list = phones.map(x=>'"'+String(x).replace(/"/g,'')+'"').join(',');
        const leads = await sbFetch(`/rest/v1/crm_leads?select=operation,telefone_norm,nome,telefone_display,status_atendimento,bucket,ultima_mensagem&operation=eq.${q(operation)}&telefone_norm=in.(${list})`, { method:'GET' });
        (leads||[]).forEach(l=>{ leadsByPhone[l.telefone_norm]=l; });
      }catch(e){}
    }
    const agenda = (rows||[]).map(r=>({ ...r, lead: leadsByPhone[r.telefone_norm] || null }));
    return jsonResponse({ ok:true, agenda });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}
module.exports = { GET };
