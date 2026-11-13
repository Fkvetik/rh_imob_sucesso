// Consultora IA — responde perguntas livres com o Claude (Haiku 5.5).
// A chave fica SÓ no servidor (env ANTHROPIC_API_KEY na Vercel). O cliente nunca a vê.
// Modelo híbrido: o chat só chama isto quando a pergunta foge do roteiro de botões.
// Proteções: só aceita chamadas vindas do próprio site, limita tamanho e faz rate-limit.

const SYSTEM = `Você é a Consultora IA da RH IMOB, especializada em recrutamento imobiliário. Fala português do Brasil, de forma calorosa, consultiva e CURTA (2 a 4 frases). Nunca diga que é um humano nem que é um robô. Seu objetivo é ajudar a empresa (que quer contratar corretores) a entender a oferta e seguir para a proposta ou para agendar uma reunião.

O QUE A RH IMOB OFERECE (use SÓ estes fatos; NUNCA invente preços, prazos ou números):
- BANCO (operação manual — o cliente/seu time filtra e aborda; é a entrada mais barata):
  • Novos Talentos (início de carreira; 90 mil+ candidatos em 180+ cidades): R$ 249/mês se já assina a Catho (integramos o login), ou R$ 649/mês com acesso completo.
  • Corretor com CRECI (CRECI ativo; 80 mil+ em 19 cidades): a partir de R$ 499/mês, por volume de contatos.
- EXTENSÃO RH IMOB Aceleradora (automatizada, já integrada ao banco — é o passo de escala): R$ 999/mês (R$ 899/mês no semestral, R$ 799/mês no anual), com 2 acessos e as bases inclusas. Roda no Chrome captando e abordando sozinha (Instagram, site do CRECI e outras ferramentas), sem parar — 2 operadores rendem o volume de 5 a 6 pessoas abordando na mão. Não é integrada à Catho.
- OPERAÇÃO COMPLETA (a RH IMOB faz tudo; só em São Paulo): a gente gera, aborda, qualifica e entrega os candidatos em entrevista (online ou presencial). Cerca de 5 contratações/mês, setup em 7 dias. R$ 1.999/mês se a empresa já tem assistente/RH para o retorno, ou R$ 3.499/mês com assistente dedicada da RH IMOB + headhunter.
- Cargos de liderança/gerente/SDR: a partir de R$ 1.500/mês. Outros perfis: em torno do salário da vaga (até ~70%).
- A partir de 6 posições por mês: operação sob medida.
- Fora de São Paulo: a operação feita pela nossa equipe não atende; o caminho é o banco + a extensão (o cliente opera, com a automação fazendo o trabalho).

REGRAS:
- Preço depende do contexto (cargo, região, estrutura). Se você ainda não sabe o que a pessoa precisa, faça 1 pergunta curta antes de dar número.
- Nunca invente valores/prazos que não estejam acima. Se perguntarem algo que você não tem, diga que um especialista confirma junto da proposta.
- A entrega é levar profissionais com aderência à reunião; a contratação depende da proposta da empresa. Em vagas CLT há reposição. Nunca prometa "contratação garantida".
- Não trabalhamos com estagiários (só corretores com CRECI e novos talentos).
- Não colete dados sensíveis. Sobre pagamento, diga apenas que se acerta no WhatsApp junto da proposta.
- Termine conduzindo: convide a pessoa a seguir (escolher região/cargo, ver as opções, pedir a proposta ou agendar uma reunião).
- Responda curto. Pode usar **negrito** e no máximo 1 emoji. Não use links a menos que necessário.`;

// Hosts autorizados a chamar o endpoint (bloqueia curl/bots sem origem do site).
const ALLOW = ["rhimob.com.br", "localhost", "127.0.0.1"];
function origemOk(req) {
  const o = String(req.headers["origin"] || "");
  const r = String(req.headers["referer"] || "");
  const alvo = o || r;
  if (!alvo) return false; // navegador real manda origin/referer; sem isso, barra
  return ALLOW.some(function (h) { return alvo.indexOf("://" + h) >= 0 || alvo.indexOf("." + h) >= 0; });
}

// Rate-limit best-effort por IP (em memória da instância; a trava forte é o limite de gasto na Console).
function rateOk(req) {
  try {
    const store = global.__iaHits || (global.__iaHits = new Map());
    if (store.size > 5000) store.clear();
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
    const now = Date.now();
    const arr = (store.get(ip) || []).filter(function (t) { return now - t < 60000; });
    if (arr.length >= 12) return false; // máx. 12 msgs/min por IP
    arr.push(now); store.set(ip, arr);
    return true;
  } catch (e) { return true; }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  if (!origemOk(req)) { res.status(403).json({ reply: "" }); return; }
  if (!rateOk(req)) { res.status(429).json({ reply: "" }); return; }
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) { res.status(200).json({ reply: "" }); return; }

    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const pergunta = String(body.pergunta || "").slice(0, 600);
    const contexto = String(body.contexto || "").slice(0, 700);
    if (!pergunta) { res.status(200).json({ reply: "" }); return; }

    // Memória: transcrição curta das últimas trocas (sem passar a chave nem dados sensíveis).
    let hist = Array.isArray(body.historico) ? body.historico : [];
    const transcript = hist.slice(-8).map(function (m) {
      const who = (m && m.role === "user") ? "Visitante" : "Consultora";
      return who + ": " + String((m && m.content) || "").slice(0, 400);
    }).join("\n");

    const userMsg = (contexto ? ("Contexto do lead — " + contexto + "\n\n") : "")
      + (transcript ? ("Conversa recente:\n" + transcript + "\n\n") : "")
      + "Visitante agora: " + pergunta;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }]
      })
    });
    if (!r.ok) { res.status(200).json({ reply: "" }); return; }

    const data = await r.json();
    let txt = "";
    if (data && Array.isArray(data.content)) {
      data.content.forEach(function (b) { if (b && b.type === "text" && b.text) txt += b.text; });
    }
    res.status(200).json({ reply: txt.trim() });
  } catch (e) {
    res.status(200).json({ reply: "" });
  }
};
