const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');

exports.dynamic = 'force-dynamic';

const FALLBACK = [
  { nome:'Fernando', telefone_norm:'', funcao:'Coordenador' },
  { nome:'Marcela',  telefone_norm:'5511948740857', funcao:'Atendimento' },
  { nome:'Mariana',  telefone_norm:'', funcao:'Atendimento' }
];

async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation = u.searchParams.get('operation') || '';
    let path = `/rest/v1/crm_operadores?select=id,nome,telefone_norm,funcao,operacoes,ativo&order=nome.asc`;
    let ops = null;
    try{ ops = await sbFetch(path, { method:'GET' }); }catch(e){ ops = null; }
    let items = Array.isArray(ops) && ops.length
      ? ops.filter(o => o.ativo !== false)
      : FALLBACK;
    if(operation && Array.isArray(ops) && ops.length){
      items = items.filter(o => !o.operacoes || o.operacoes.includes(operation));
    }
    return jsonResponse({ ok:true, operadores:items });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}
module.exports = { GET };
