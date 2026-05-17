const { assertAuth } = require('../../../../lib/crmAuth');
const { jsonResponse } = require('../../../../lib/crmUtils');
const { sbFetch, q } = require('../../../../lib/supabaseRest');
exports.dynamic = 'force-dynamic';

function normalizeItem(x, i){
  return {
    id: x.id || null,
    titulo: String(x.title || x.titulo || ('Mensagem '+(i+1))).trim() || ('Mensagem '+(i+1)),
    texto: String(x.text || x.texto || ''),
    tipo_acao: String(x.action || x.tipo_acao || 'MENSAGEM_LEAD'),
    operador_destino_nome: String(x.operatorName || x.operador_destino_nome || ''),
    operador_destino_telefone: String(x.operatorPhone || x.operador_destino_telefone || '').replace(/\D+/g,''),
    operador_destino_funcao: String(x.operatorRole || x.operador_destino_funcao || ''),
    texto_operador: String(x.operatorText || x.texto_operador || ''),
    ativo: x.active === undefined ? (x.ativo === undefined ? true : !!x.ativo) : !!x.active,
    ordem: Number(x.ordem || (i+1)*10)
  };
}

async function GET(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const u = new URL(req.url);
    const operation = u.searchParams.get('operation') || '';
    if(!operation) return jsonResponse({ ok:false, error:'operation é obrigatório.' }, 400);
    const rows = await sbFetch(`/rest/v1/crm_respostas_rapidas?select=id,operation,titulo,texto,tipo_acao,operador_destino_nome,operador_destino_telefone,operador_destino_funcao,texto_operador,ativo,ordem,updated_at&operation=eq.${q(operation)}&ativo=eq.true&order=ordem.asc,created_at.asc`, { method:'GET' });
    return jsonResponse({ ok:true, items: rows || [] });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}

async function POST(req){
  const auth = assertAuth(req); if(auth) return auth;
  try{
    const body = await req.json();
    const operation = body.operation || '';
    const items = Array.isArray(body.items) ? body.items.map(normalizeItem) : [];
    if(!operation) return jsonResponse({ ok:false, error:'operation é obrigatório.' }, 400);
    await sbFetch('/rest/v1/rpc/rpc_crm_salvar_respostas_rapidas', { method:'POST', body:JSON.stringify({ p_operation: operation, p_items: items }) });
    return jsonResponse({ ok:true, saved: items.length });
  }catch(e){ return jsonResponse({ ok:false, error:e.message }, 500); }
}
module.exports = { GET, POST };
