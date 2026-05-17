const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse, normPhone } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');

exports.dynamic = 'force-dynamic';

async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation = u.searchParams.get('operation') || 'NOVOS_TALENTOS';
    const limit = Math.min(Number(u.searchParams.get('limit')||120), 300);
    const status = u.searchParams.get('status') || '';
    const bucket = u.searchParams.get('bucket') || '';
    const term = (u.searchParams.get('q') || '').trim();
    let path = `/rest/v1/crm_leads?select=id,operation,lead_id,telefone_norm,telefone_display,nome,origem,campanha,status_atendimento,bucket,fase_funil,humano,agenda_status,operador,cidade,bairro,profissao,idade,ultima_mensagem,ultima_direcao,ultima_atividade_em,updated_at&operation=eq.${q(operation)}&order=ultima_atividade_em.desc.nullslast,updated_at.desc&limit=${limit}`;
    if(status) path += `&status_atendimento=eq.${q(status)}`;
    if(bucket) path += `&bucket=eq.${q(bucket)}`;
    if(term){
      const phone = normPhone(term);
      const safeTerm = term.replace(/[,%]/g,' ');
      path += phone.length >= 6 ? `&or=(telefone_norm.ilike.*${q(phone)}*,nome.ilike.*${q(safeTerm)}*)` : `&nome=ilike.*${q(safeTerm)}*`;
    }
    const leads = await sbFetch(path, { method:'GET' });
    return jsonResponse({ ok:true, leads: leads || [] });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}
module.exports = { GET };
