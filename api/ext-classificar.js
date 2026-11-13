// Classificador de respostas do candidato (extensão RH IMOB Aceleradora).
// A extensão manda a mensagem que chegou na bolha + a lista de chips possíveis;
// aqui devolvemos qual chip combina (intenção), com um grau de confiança.
// Híbrido: regras rápidas (grátis) para o óbvio; Claude Haiku só para o ambíguo.
//
// Protegido pelo token de sessão do operador (mesmo esquema dos outros /api/ext-*).
// NÃO envia nem automatiza nada — só interpreta. O envio do chip é a extensão
// que faz (e, recomendado, só com confirmação ou acima de um limite de confiança).
//
// Entrada (POST JSON):
//   { token, mensagem, contexto?, opcoes: [{ id, label, exemplos?, tipo? }] }
//   tipo (opcional) ∈ interesse | sem_interesse | duvida | adiar | parar | outro
// Saída:
//   { ok, opcao: <id|null>, confianca: 0..1, fonte: 'regra'|'ia'|..., motivo }

import { cors, send, lerCorpo, validarSessao } from './_ext-comum.js';

const SYS = `Você classifica a RESPOSTA de um candidato a uma abordagem de recrutamento imobiliário no WhatsApp. Receba a mensagem do candidato e uma lista de opções (cada uma com um id). Escolha a opção cujo id melhor representa a intenção da mensagem, considerando gírias, erros de digitação, ironia e ambiguidade do português do Brasil.

Responda APENAS um JSON válido, sem nenhum texto fora dele, no formato:
{"opcao":"<id da opção escolhida ou null>","confianca":<número de 0 a 1>,"motivo":"<curto>"}

Regras:
- Se a mensagem claramente não encaixa em nenhuma opção, use "opcao": null com confiança baixa.
- Confiança alta (>=0.8) só quando a intenção é clara. Dúvida/ambiguidade => confiança baixa.
- Não invente ids: use só os ids fornecidos.`;

function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

// Acha a opção que tem um dado "tipo" (quando o chamador marcou os chips).
function porTipo(opcoes, tipo){ const o = opcoes.find(x => norm(x.tipo) === tipo); return o ? o.id : null; }

// Regras rápidas: só decidem quando é inequívoco; senão devolvem null (vai pra IA).
function classificarPorRegra(mensagem, opcoes){
  const s = norm(mensagem).trim();
  const curto = s.replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  const temTipos = opcoes.some(o => o.tipo);
  if (!temTipos) return null; // sem "tipo" nos chips, deixamos a IA decidir

  // parar / descadastro (mais forte, vem primeiro)
  if (/\b(parar|pare|para de|sair|descadastr|me tira|nao perturb|remove|stop|bloquear)\b/.test(s)) {
    const id = porTipo(opcoes,'parar') || porTipo(opcoes,'sem_interesse');
    if (id) return { opcao:id, confianca:0.92, motivo:'pedido para parar/descadastrar' };
  }
  // pergunta (preço, horário, como funciona...)
  if (/\?\s*$/.test(mensagem.trim()) || /\b(quanto|valor|salario|comissao|horario|onde|como funciona|quando|qual|quais|duvida|me explica|detalhes|informacoe?s)\b/.test(s)) {
    const id = porTipo(opcoes,'duvida');
    if (id) return { opcao:id, confianca:0.82, motivo:'pergunta/dúvida' };
  }
  // adiar
  if (/\b(depois|mais tarde|agora nao|outra hora|semana que vem|mes que vem|estou ocupad|to ocupad|sem tempo agora)\b/.test(s)) {
    const id = porTipo(opcoes,'adiar');
    if (id) return { opcao:id, confianca:0.8, motivo:'quer falar depois' };
  }
  // negativo
  if (/(nao tenho interesse|sem interesse|nao quero|ja estou emprega|ja trabalho|nao obrigad|nao vou|agora nao da)/.test(s) || /^(nao|n|nops|negativo)\b/.test(curto)) {
    const id = porTipo(opcoes,'sem_interesse');
    if (id) return { opcao:id, confianca:0.85, motivo:'sem interesse' };
  }
  // afirmativo
  if (/^(sim|s|claro|quero|bora|vamos|aceito|pode|pode ser|isso|opa sim|com certeza|tenho interesse|interessad)/.test(curto) || /\b(tenho interesse|quero sim|pode mandar|me chama|vamos marcar|bora)\b/.test(s)) {
    const id = porTipo(opcoes,'interesse');
    if (id) return { opcao:id, confianca:0.85, motivo:'demonstrou interesse' };
  }
  return null;
}

async function classificarPorIA(key, mensagem, contexto, opcoes){
  const lista = opcoes.map(o => `- id "${o.id}": ${o.label || ''}${o.exemplos ? ' (ex.: ' + o.exemplos + ')' : ''}`).join('\n');
  const userMsg = (contexto ? ('Contexto: ' + contexto + '\n\n') : '')
    + 'Opções possíveis:\n' + lista
    + '\n\nMensagem do candidato: "' + mensagem + '"\n\nResponda só o JSON.';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 160, system: SYS, messages: [{ role: 'user', content: userMsg }] })
  });
  if (!r.ok) return { opcao:null, confianca:0, motivo:'IA HTTP ' + r.status };
  const data = await r.json().catch(() => null);
  let txt = '';
  if (data && Array.isArray(data.content)) data.content.forEach(b => { if (b && b.type === 'text' && b.text) txt += b.text; });
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return { opcao:null, confianca:0, motivo:'IA sem JSON' };
  let j; try { j = JSON.parse(m[0]); } catch { return { opcao:null, confianca:0, motivo:'IA JSON inválido' }; }
  const ids = opcoes.map(o => o.id);
  const opcao = (j && j.opcao != null && ids.indexOf(j.opcao) >= 0) ? j.opcao : null;
  let conf = Number(j && j.confianca); if (!(conf >= 0 && conf <= 1)) conf = opcao ? 0.6 : 0;
  return { opcao, confianca: conf, motivo: String((j && j.motivo) || '').slice(0, 160) };
}

export default async function handler(req, res){
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
  try {
    const body = await lerCorpo(req);
    const sessao = await validarSessao(body.token);
    if (!sessao || sessao.ok !== true) return send(res, 401, { ok: false, error: (sessao && sessao.error) || 'Sessão inválida' });

    const mensagem = String(body.mensagem || '').slice(0, 800);
    const contexto = String(body.contexto || '').slice(0, 500);
    const opcoes = Array.isArray(body.opcoes) ? body.opcoes.filter(o => o && o.id).slice(0, 12) : [];
    if (!mensagem || !opcoes.length) return send(res, 400, { ok: false, error: 'mensagem e opcoes são obrigatórias' });

    const regra = classificarPorRegra(mensagem, opcoes);
    if (regra) return send(res, 200, { ok: true, fonte: 'regra', ...regra });

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return send(res, 200, { ok: true, fonte: 'sem_ia', opcao: null, confianca: 0, motivo: 'IA não configurada' });

    const ia = await classificarPorIA(key, mensagem, contexto, opcoes);
    return send(res, 200, { ok: true, fonte: 'ia', ...ia });
  } catch (e) {
    return send(res, 200, { ok: true, fonte: 'erro', opcao: null, confianca: 0, motivo: String((e && e.message) || e) });
  }
}
