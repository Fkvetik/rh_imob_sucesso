// Vercel Function — leitura segura dos leads (site_leads) para o admin.
// A chave de serviço fica só no servidor (env var), nunca no cliente.
// Protegido por token: /api/leads?token=SEU_TOKEN

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const token = req.query.token || '';
  const ADMIN_TOKEN = process.env.LEADS_ADMIN_TOKEN;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!ADMIN_TOKEN || !SERVICE_KEY) {
    res.status(500).send(JSON.stringify({ error: 'config', message: 'Faltam variáveis de ambiente LEADS_ADMIN_TOKEN e/ou SUPABASE_SERVICE_KEY na Vercel.' }));
    return;
  }
  if (token !== ADMIN_TOKEN) {
    res.status(401).send(JSON.stringify({ error: 'auth', message: 'Token inválido.' }));
    return;
  }

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/site_leads?select=*&order=created_at.desc&limit=500`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      res.status(502).send(JSON.stringify({ error: 'supabase', status: r.status, message: t.slice(0, 300) }));
      return;
    }
    const data = await r.json();
    res.status(200).send(JSON.stringify({ ok: true, count: Array.isArray(data) ? data.length : 0, leads: data }));
  } catch (e) {
    res.status(500).send(JSON.stringify({ error: 'exception', message: String(e && e.message || e) }));
  }
}
