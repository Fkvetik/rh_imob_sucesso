// Vercel Function PÚBLICA — preços dos planos da Plataforma Novos Talentos
// para as páginas de marketing (sem token; qualquer visitante lê).
// Só GET. Retorna apenas campos comerciais seguros — nunca limites internos,
// ids ou timestamps. Alimentado pelo painel admin (aba Contas → Planos).

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const PRODUTO = 'NOVOS_TALENTOS';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // cache curto na borda: preço muda raramente, mas não queremos servir muito velho
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

  if (req.method !== 'GET') {
    res.status(405).send(JSON.stringify({ error: 'metodo', message: 'Somente GET.' }));
    return;
  }

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) {
    res.status(500).send(JSON.stringify({ error: 'config', message: 'Configuração ausente.' }));
    return;
  }

  try {
    const auth = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
    const [r, rCount] = await Promise.all([
      fetch(
        `${SB_URL}/rest/v1/nt_planos?select=modo_integracao,nome_comercial,preco_mensal,descricao_comercial,limite_total_padrao` +
        `&produto_codigo=eq.${PRODUTO}&status=eq.ATIVO&modo_integracao=not.is.null&order=preco_mensal.asc`,
        { headers: auth }
      ),
      // contagem de talentos públicos ativos (para os números da página não ficarem congelados)
      fetch(
        `${SB_URL}/rest/v1/nt_talentos_publicos?select=talento_key&ativo=eq.true&produto_codigo=eq.${PRODUTO}`,
        { headers: { ...auth, Prefer: 'count=exact', Range: '0-0' } }
      )
    ]);
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      res.status(502).send(JSON.stringify({ error: 'supabase', status: r.status, message: t.slice(0, 200) }));
      return;
    }
    const rows = await r.json();
    const planos = (Array.isArray(rows) ? rows : []).map(p => ({
      modo_integracao: p.modo_integracao,
      nome_comercial: p.nome_comercial,
      preco_mensal: p.preco_mensal,
      descricao_comercial: p.descricao_comercial,
      volume_ilimitado: p.limite_total_padrao == null
    }));
    var totalTalentos = null;
    if (rCount && rCount.ok) {
      await rCount.text().catch(() => {});
      var cr = rCount.headers.get('content-range') || '';
      var n = parseInt((cr.split('/')[1] || ''), 10);
      if (isFinite(n)) totalTalentos = n;
    }
    var precos = planos.map(p => Number(p.preco_mensal)).filter(v => isFinite(v) && v > 0);
    var precoMin = precos.length ? Math.min.apply(null, precos) : null;
    res.status(200).send(JSON.stringify({ ok: true, planos, total_talentos: totalTalentos, preco_min: precoMin }));
  } catch (e) {
    res.status(500).send(JSON.stringify({ error: 'exception', message: String(e && e.message || e) }));
  }
}
