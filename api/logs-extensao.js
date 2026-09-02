// Vercel Function — leitura do log remoto (warn/error) da extensão, gravado
// pelo worker.js na tabela ext_debug_logs do projeto RHI (Pro), via a RPC
// rhi_log_extensao. Existe pra o admin ver/copiar erros sem precisar acessar
// o computador do operador que reclamou.
// Protegido pela MESMA senha de admin do painel admin-catho-coletor.html.
// Chamar como: /api/logs-extensao?token=SENHA_DE_ADMIN&login=...&nivel=...&limite=200

const SB_URL = 'https://tnzmxpoxvdlckmjwdala.supabase.co';

const COLETOR_URL = 'https://lrejfhsomfxyaoshmpzz.supabase.co';
const COLETOR_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWpmaHNvbWZ4eWFvc2htcHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTQxNzIsImV4cCI6MjEwMTY5MDE3Mn0.FfdMC8jJaWGTUxDVIh5TVcXrRBIWAaMXX6HZNLIQ28Y';

async function senhaDeAdminValida(senha) {
  if (!senha) return { valida: false, motivo: 'Senha não informada.' };
  try {
    const r = await fetch(`${COLETOR_URL}/rest/v1/rpc/rpc_admin_verificar_senha`, {
      method: 'POST',
      headers: { apikey: COLETOR_ANON_KEY, Authorization: `Bearer ${COLETOR_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_admin_password: senha, p_login: null })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { valida: false, motivo: `Falha ao verificar senha (HTTP ${r.status} do Coletor): ${t.slice(0, 200)}` };
    }
    const data = await r.json();
    if (data && data.ok === true) return { valida: true };
    return { valida: false, motivo: 'Senha de admin incorreta.' };
  } catch (e) {
    return { valida: false, motivo: 'Falha de rede ao verificar senha: ' + String(e && e.message || e) };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const token = req.query.token || '';
  const SERVICE_KEY = process.env.RHI_SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) return send(res, 500, { error: 'config', message: 'Falta RHI_SUPABASE_SERVICE_KEY na Vercel.' });

  const check = await senhaDeAdminValida(token);
  if (!check.valida) return send(res, 401, { error: 'auth', message: check.motivo });

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    const login = req.query.login || null;
    const nivel = req.query.nivel || null;
    const limite = Math.max(1, Math.min(500, parseInt(req.query.limite, 10) || 200));

    const r = await fetch(`${SB_URL}/rest/v1/rpc/rhi_listar_logs_extensao`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_login: login, p_nivel: nivel, p_limite: limite })
    });
    if (!r.ok) return supabaseErr(res, r);
    const logs = await r.json();
    return send(res, 200, { ok: true, logs });
  } catch (e) {
    return send(res, 500, { error: 'exception', message: String(e && e.message || e) });
  }
}

function send(res, status, obj) { res.status(status).send(JSON.stringify(obj)); }
async function supabaseErr(res, r) {
  const t = await r.text().catch(() => '');
  return send(res, 502, { error: 'supabase', status: r.status, message: t.slice(0, 400) });
}
