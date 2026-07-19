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
      `${SB_URL}/rest/v1/site_leads?select=*&order=created_at.desc&limit=2000`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      res.status(502).send(JSON.stringify({ error: 'supabase', status: r.status, message: t.slice(0, 300) }));
      return;
    }
    const rows = await r.json();

    // Deduplica por session_id: cada blur/envio grava uma linha nova (foto do
    // formulário). Fundimos todas as linhas da mesma sessão preservando o valor
    // mais recente não-vazio de cada campo, e enviou_whatsapp=true se qualquer
    // linha marcou. Assim o painel mostra 1 lead completo por pessoa.
    const CAMPOS = ['nome','whatsapp','empresa','cidade','cargo_vaga','quantidade','urgencia','formato_contratacao','remuneracao','beneficios','exigencias','mensagem','origem','pagina'];
    const porSessao = new Map();
    const semSessao = [];
    // rows vem em created_at.desc (mais recente primeiro)
    for (const row of Array.isArray(rows) ? rows : []) {
      // agrupa pelo prefixo antes do "#" (cada gravação tem sufixo único)
      const sid = row.session_id ? String(row.session_id).split('#')[0] : null;
      if (!sid) { semSessao.push(row); continue; }
      let acc = porSessao.get(sid);
      if (!acc) {
        acc = { session_id: sid, created_at: row.created_at, updated_at: row.created_at, enviou_whatsapp: false };
        CAMPOS.forEach(c => { acc[c] = null; });
        porSessao.set(sid, acc);
      }
      // como iteramos do mais recente ao mais antigo, só preenche o que ainda está vazio
      CAMPOS.forEach(c => { if (!acc[c] && row[c]) acc[c] = row[c]; });
      if (row.enviou_whatsapp) acc.enviou_whatsapp = true;
      if (row.created_at > acc.updated_at) acc.updated_at = row.created_at;
      if (row.created_at < acc.created_at) acc.created_at = row.created_at;
    }
    const leads = [...porSessao.values(), ...semSessao]
      .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));

    res.status(200).send(JSON.stringify({ ok: true, count: leads.length, leads }));
  } catch (e) {
    res.status(500).send(JSON.stringify({ error: 'exception', message: String(e && e.message || e) }));
  }
}
