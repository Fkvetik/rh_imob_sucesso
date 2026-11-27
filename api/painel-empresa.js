// Vercel Function — PAINEL DA EMPRESA (gestão self-service).
// A RH IMOB manda um link /painel-empresa?e=<slug>&t=<token> pro gestor da
// empresa. Ele vê TODAS as vagas da empresa dele e, em cada uma, clica em
// "Editar" e cai na tela de edição com prévia ao vivo (/editar-vaga?v&t).
//
// Autorização: token por empresa (HMAC do slug com um segredo do servidor).
// Não precisa de senha nem de tabela nova. Cada vaga tem seu edit_token (gerado
// aqui se ainda não existir), que autoriza a edição daquela vaga.
import crypto from 'crypto';

const SB   = 'https://pufxvskozfdvfscqnays.supabase.co';
const BASE = 'https://www.rhimob.com.br';
const TABELA = 'site_vagas_publicas';

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function slug(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function tokenEmpresa(sl){
  const secret = process.env.LEADS_ADMIN_TOKEN || '';
  return crypto.createHmac('sha256', secret).update('empresa:'+sl).digest('base64url').slice(0, 24);
}
function novoToken(){
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s=''; for(let i=0;i<24;i++) s+=a[Math.floor(Math.random()*a.length)];
  return s;
}

export default async function handler(req, res){
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const sl = slug(req.query.e || '');
  const t  = String(req.query.t || '');
  const SERVICE = process.env.SUPABASE_SERVICE_KEY;

  if (!sl || !SERVICE) { res.status(400).send(estado('Link inválido', 'Abra o link exatamente como a RH IMOB enviou.')); return; }
  if (t !== tokenEmpresa(sl)) { res.status(401).send(estado('Link inválido ou expirado', 'Peça um novo link à RH IMOB.')); return; }

  const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
  let vagas = [];
  try {
    const r = await fetch(`${SB}/rest/v1/${TABELA}?select=vaga_id,titulo,status,na_grade,localidade,cidade,estado_uf,responsavel_empresa,responsavel_nome,edit_token&order=status.asc,prioridade.asc&limit=200`, { headers });
    const data = await r.json();
    if (Array.isArray(data)) vagas = data.filter(v => slug(v.responsavel_empresa) === sl);
  } catch(_){}

  if (!vagas.length) { res.status(404).send(estado('Nenhuma vaga encontrada', 'Ainda não há vagas cadastradas para esta empresa.')); return; }

  // garante edit_token em cada vaga (gera e grava os que faltam)
  for (const v of vagas) {
    if (!v.edit_token) {
      v.edit_token = novoToken();
      try {
        await fetch(`${SB}/rest/v1/${TABELA}?vaga_id=eq.${encodeURIComponent(v.vaga_id)}`, {
          method:'PATCH', headers:{ ...headers, Prefer:'return=minimal' }, body: JSON.stringify({ edit_token: v.edit_token })
        });
      } catch(_){}
    }
  }

  const nomeEmpresa = vagas[0].responsavel_empresa || req.query.e;
  res.send(render(nomeEmpresa, vagas));
}

function estadoBadge(v){
  if ((v.status||'') !== 'ATIVA') return '<span class="bd off">Desativada</span>';
  return v.na_grade === false ? '<span class="bd fora">No ar (por link)</span>' : '<span class="bd on">No ar (na grade)</span>';
}

function render(nomeEmpresa, vagas){
  const linhas = vagas.map(v => {
    const local = v.localidade || [v.cidade, v.estado_uf].filter(Boolean).join('/') || '';
    const editar = `${BASE}/editar-vaga?v=${encodeURIComponent(v.vaga_id)}&t=${encodeURIComponent(v.edit_token)}`;
    const ver = `${BASE}/vaga/${encodeURIComponent(v.vaga_id)}`;
    return `<div class="row">
      <div class="info"><div class="tt">${esc(v.titulo||'(sem título)')} ${estadoBadge(v)}</div>
      <div class="mt">${esc(local)} · 👤 ${esc(v.responsavel_nome||'')}</div></div>
      <div class="ac">
        <a class="b b-ed" href="${editar}">✏️ Editar</a>
        <a class="b b-vr" href="${ver}" target="_blank" rel="noopener">👁 Ver</a>
      </div>
    </div>`;
  }).join('');
  const ativas = vagas.filter(v => (v.status||'')==='ATIVA').length;

  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Painel ${esc(nomeEmpresa)} — RH IMOB</title>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<style>
  :root{--roxo:#2b124d;--roxo2:#5a1fd4;--linha:#e8e4f2}
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f1fb;color:var(--roxo)}
  .top{background:linear-gradient(135deg,var(--roxo),var(--roxo2));color:#fff;padding:22px 20px}
  .top .wrap{max-width:840px;margin:0 auto}
  .top .k{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fb923c;margin-bottom:6px}
  .top h1{margin:0;font-size:clamp(22px,4vw,30px);font-weight:900}
  .top p{margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px}
  .wrap{max-width:840px;margin:0 auto;padding:22px 16px 60px}
  .row{background:#fff;border:1px solid var(--linha);border-radius:14px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .info{min-width:0;flex:1}
  .tt{font-size:15px;font-weight:800;line-height:1.3}
  .mt{font-size:12.5px;color:#8c809d;margin-top:3px}
  .bd{font-size:10.5px;font-weight:900;padding:2px 8px;border-radius:20px;margin-left:6px;white-space:nowrap}
  .bd.on{background:#dcfce7;color:#166534}.bd.fora{background:#dbeafe;color:#1e40af}.bd.off{background:#fee2e2;color:#991b1b}
  .ac{display:flex;gap:8px}
  .b{text-decoration:none;font-size:13px;font-weight:800;padding:9px 14px;border-radius:10px;white-space:nowrap}
  .b-ed{background:var(--roxo);color:#fff}
  .b-vr{background:#fff;border:1.5px solid var(--linha);color:var(--roxo)}
  .nota{font-size:12.5px;color:#8c809d;margin-top:16px;text-align:center}
</style></head><body>
  <div class="top"><div class="wrap">
    <div class="k">Painel de vagas</div>
    <h1>${esc(nomeEmpresa)}</h1>
    <p>${vagas.length} vaga(s) · ${ativas} no ar. Clique em <b>Editar</b> para alterar textos, fotos, benefícios e endereço — a mudança vai ao ar quando você salvar.</p>
  </div></div>
  <div class="wrap">
    ${linhas}
    <p class="nota">Dúvidas? Fale com a RH IMOB. Este painel é exclusivo da sua empresa.</p>
  </div>
</body></html>`;
}

function estado(h, p){
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/>
<title>${esc(h)} — RH IMOB</title>
<style>body{display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;font-family:Inter,sans-serif;background:#f4f1fb;color:#2b124d}
.c{max-width:420px;padding:40px}.c h1{font-size:22px;margin:0 0 10px}.c p{color:#6f6283;margin:0}</style>
</head><body><div class="c"><h1>${esc(h)}</h1><p>${esc(p)}</p></div></body></html>`;
}
