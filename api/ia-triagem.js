// Vercel Function — Triagem de resposta (IA) — modo sombra / classificação.
// Classifica a resposta de um candidato no WhatsApp como interesse
// positivo / negativo / neutro / parar. NÃO envia nada ao lead — só lê e rotula.
//
// POST /api/ia-triagem   (header x-ia-token: <IA_TRIAGEM_SECRET>, ou ?token=)
//   body: { texto: "<resposta do candidato>", contexto?: "<1 linha opcional>" }
//   ->   { ok, interesse, confianca, motivo, uso:{input,output} }
//
// Protegido por segredo porque cada chamada custa (API da Anthropic).
// Variáveis de ambiente na Vercel:
//   ANTHROPIC_API_KEY  = chave da conta Anthropic (NUNCA no código/GitHub)
//   IA_TRIAGEM_SECRET  = senha simples pra liberar este endpoint
//
// IMPORTANTE: o PROMPT abaixo deve ficar IGUAL ao de scripts/ia_triagem_teste.mjs
// (o script de teste usa o mesmo texto pra calibrar). Mudou aqui, muda lá.

const MODELO = 'claude-haiku-5-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = [
  'Você classifica a resposta de um candidato a corretor de imóveis que recebeu',
  'uma abordagem por WhatsApp de uma empresa de recrutamento (RH IMOB).',
  'Leia a resposta e diga o nível de interesse, em UM dos rótulos:',
  '- "positivo": demonstra interesse, quer saber mais, pergunta da vaga, aceita receber info, quer conversar.',
  '- "negativo": não tem interesse, recusa, já está empregado e satisfeito, "não quero".',
  '- "neutro": dúvida ou indefinição — "quem é?", "como conseguiu meu número?", pergunta genérica, ainda não decidiu.',
  '- "parar": pede para não receber mais mensagens, quer sair da lista, diz que é número errado, ou se irrita com o contato.',
  '',
  'Responda APENAS um JSON, sem texto fora dele, no formato:',
  '{"interesse":"positivo|negativo|neutro|parar","confianca":0.0,"motivo":"curto"}',
  'confianca é de 0 a 1. motivo é uma frase bem curta em português.'
].join('\n');

function send(res, code, obj) {
  res.status(code).json(obj);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-ia-token');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'metodo', message: 'Use POST.' });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  const SECRET = process.env.IA_TRIAGEM_SECRET;
  if (!API_KEY || !SECRET) return send(res, 500, { error: 'config', message: 'Faltam ANTHROPIC_API_KEY e/ou IA_TRIAGEM_SECRET na Vercel.' });

  const token = req.headers['x-ia-token'] || req.query.token || '';
  if (token !== SECRET) return send(res, 401, { error: 'auth', message: 'Token inválido.' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return send(res, 400, { error: 'json', message: 'Body inválido.' }); }

  const texto = String(body.texto || '').trim();
  if (!texto) return send(res, 400, { error: 'validacao', message: 'Campo "texto" é obrigatório.' });
  const contexto = String(body.contexto || '').trim();

  const userMsg = (contexto ? ('Contexto: ' + contexto + '\n\n') : '') + 'Resposta do candidato:\n"' + texto + '"';

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await r.json();
    if (!r.ok) return send(res, 502, { error: 'anthropic', status: r.status, message: data?.error?.message || 'Falha na API da Anthropic.' });

    const bruto = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const parsed = extrairJson_(bruto);
    if (!parsed) return send(res, 502, { error: 'parse', message: 'Resposta não veio em JSON.', bruto });

    const uso = data.usage || {};
    return send(res, 200, {
      ok: true,
      interesse: parsed.interesse || 'neutro',
      confianca: typeof parsed.confianca === 'number' ? parsed.confianca : null,
      motivo: parsed.motivo || '',
      uso: { input: uso.input_tokens || 0, output: uso.output_tokens || 0 }
    });
  } catch (e) {
    return send(res, 500, { error: 'exception', message: String(e && e.message || e) });
  }
}

// Extrai o primeiro objeto JSON do texto (o modelo às vezes põe algo em volta).
function extrairJson_(txt) {
  if (!txt) return null;
  const i = txt.indexOf('{'), j = txt.lastIndexOf('}');
  if (i < 0 || j < 0 || j < i) return null;
  try { return JSON.parse(txt.slice(i, j + 1)); } catch { return null; }
}
