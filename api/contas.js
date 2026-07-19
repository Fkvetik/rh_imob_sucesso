// Vercel Function — leitura e administração de contas/planos/usuários da
// Plataforma Novos Talentos (nt_contas, nt_planos, nt_usuarios_conta).
// Protegido por token: /api/contas?token=SEU_TOKEN

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const token = req.query.token || '';
  const ADMIN_TOKEN = process.env.LEADS_ADMIN_TOKEN;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!ADMIN_TOKEN || !SERVICE_KEY) {
    res.status(500).send(JSON.stringify({ error: 'config', message: 'Faltam variáveis de ambiente na Vercel.' }));
    return;
  }
  if (token !== ADMIN_TOKEN) {
    res.status(401).send(JSON.stringify({ error: 'auth', message: 'Token inválido.' }));
    return;
  }

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (body.acao === 'alterar_status_usuario') {
        if (!body.usuario_id || !body.status) {
          res.status(400).send(JSON.stringify({ error: 'validacao', message: 'usuario_id e status são obrigatórios.' }));
          return;
        }
        // A RPC nt_admin_alterar_status_usuario_v15 exige sessão de usuário autenticado
        // (checa auth.uid() internamente) — não aceita chamada via service_role puro.
        // Faz o UPDATE direto na tabela; service_role já contorna as políticas de RLS.
        const r = await fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?usuario_id=eq.${encodeURIComponent(body.usuario_id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: body.status, updated_at: new Date().toISOString() })
        });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          res.status(502).send(JSON.stringify({ error: 'supabase', status: r.status, message: t.slice(0, 300) }));
          return;
        }
        res.status(200).send(JSON.stringify({ ok: true }));
        return;
      }
      res.status(400).send(JSON.stringify({ error: 'acao_invalida' }));
      return;
    }

    const [rContas, rPlanos, rUsuarios] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/nt_relatorio_contas_v10?select=*&order=nome_conta.asc`, { headers }),
      fetch(`${SB_URL}/rest/v1/nt_planos?select=*`, { headers }),
      fetch(`${SB_URL}/rest/v1/nt_usuarios_conta?select=usuario_id,conta_id,nome,email_login,perfil,status&order=nome.asc`, { headers })
    ]);

    if (!rContas.ok || !rPlanos.ok || !rUsuarios.ok) {
      res.status(502).send(JSON.stringify({ error: 'supabase', message: 'Falha ao consultar Supabase.' }));
      return;
    }

    const contas = await rContas.json();
    const planos = await rPlanos.json();
    const usuarios = await rUsuarios.json();

    res.status(200).send(JSON.stringify({ ok: true, contas, planos, usuarios }));
  } catch (e) {
    res.status(500).send(JSON.stringify({ error: 'exception', message: String(e && e.message || e) }));
  }
}
