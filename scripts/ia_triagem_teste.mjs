#!/usr/bin/env node
// Teste local da triagem de interesse (Passo 2 — calibração).
// Roda seus exemplos reais pela IA e compara com o rótulo que VOCÊ deu.
// Não mexe em nada do sistema — só mede acerto e custo.
//
// COMO USAR (no PowerShell, dentro da pasta do projeto rh_imob_sucesso):
//   1) Defina a chave só nesta sessão do terminal:
//        $env:ANTHROPIC_API_KEY = "sk-ant-..."
//   2) Rode:
//        node scripts/ia_triagem_teste.mjs scripts/ia_triagem_exemplos.csv
//
// O CSV precisa ter cabeçalho "texto,esperado" (esperado = positivo|negativo|neutro|parar).
//
// IMPORTANTE: o SYSTEM_PROMPT abaixo deve ficar IGUAL ao de api/ia-triagem.js.

import { readFileSync } from 'node:fs';

const MODELO = 'claude-haiku-5-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
// Preço Haiku 5.5 (US$ por 1 milhão de tokens) — prompts até 100K.
const PRECO_IN = 0.10, PRECO_OUT = 0.50;
const USD_BRL = 5.3; // aproximado, só pra referência

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

function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignora */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

function extrairJson(txt) {
  if (!txt) return null;
  const i = txt.indexOf('{'), j = txt.lastIndexOf('}');
  if (i < 0 || j < 0 || j < i) return null;
  try { return JSON.parse(txt.slice(i, j + 1)); } catch { return null; }
}

async function classificar(apiKey, texto) {
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELO, max_tokens: 200, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: 'Resposta do candidato:\n"' + texto + '"' }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data?.error?.message) || ('HTTP ' + r.status));
  const bruto = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const parsed = extrairJson(bruto) || {};
  return { interesse: parsed.interesse || '?', confianca: parsed.confianca, motivo: parsed.motivo || '',
           inTok: data.usage?.input_tokens || 0, outTok: data.usage?.output_tokens || 0 };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('❌ Defina ANTHROPIC_API_KEY primeiro:  $env:ANTHROPIC_API_KEY = "sk-ant-..."'); process.exit(1); }
  const arquivo = process.argv[2] || 'scripts/ia_triagem_exemplos.csv';

  let rows;
  try { rows = parseCsv(readFileSync(arquivo, 'utf8')); }
  catch { console.error('❌ Não achei o CSV:', arquivo); process.exit(1); }

  const header = rows[0].map(h => h.trim().toLowerCase());
  const iTexto = header.indexOf('texto'), iEsp = header.indexOf('esperado');
  if (iTexto < 0) { console.error('❌ O CSV precisa da coluna "texto" (e de preferência "esperado").'); process.exit(1); }
  const exemplos = rows.slice(1).map(r => ({ texto: (r[iTexto] || '').trim(), esperado: iEsp >= 0 ? (r[iEsp] || '').trim().toLowerCase() : '' })).filter(e => e.texto);

  console.log(`\nRodando ${exemplos.length} exemplo(s) no modelo ${MODELO}...\n`);
  let acertos = 0, comGabarito = 0, inTot = 0, outTot = 0;
  const erros = [];

  for (let i = 0; i < exemplos.length; i++) {
    const ex = exemplos[i];
    let out;
    try { out = await classificar(apiKey, ex.texto); }
    catch (e) { console.log(`#${i + 1} ERRO: ${e.message}`); continue; }
    inTot += out.inTok; outTot += out.outTok;
    const bate = ex.esperado ? (out.interesse === ex.esperado) : null;
    if (ex.esperado) { comGabarito++; if (bate) acertos++; else erros.push({ i: i + 1, ...ex, obtido: out.interesse, motivo: out.motivo }); }
    const marca = bate === null ? ' ' : (bate ? '✓' : '✗');
    const conf = out.confianca != null ? ` (${Math.round(out.confianca * 100)}%)` : '';
    console.log(`${marca} #${i + 1}  esperado=${ex.esperado || '—'}  →  ia=${out.interesse}${conf}   "${ex.texto.slice(0, 50).replace(/\n/g, ' ')}${ex.texto.length > 50 ? '…' : ''}"`);
    await sleep(250);
  }

  const custoUsd = (inTot / 1e6) * PRECO_IN + (outTot / 1e6) * PRECO_OUT;
  console.log('\n──────── RESULTADO ────────');
  if (comGabarito) {
    const pct = (acertos / comGabarito * 100).toFixed(1);
    console.log(`Acerto: ${acertos}/${comGabarito} = ${pct}%`);
    if (erros.length) {
      console.log('\nErros (pra ajustar o prompt):');
      erros.forEach(e => console.log(`  #${e.i}  você=${e.esperado}  ia=${e.obtido}  — "${e.texto.slice(0, 60).replace(/\n/g, ' ')}"  [${e.motivo}]`));
    }
  } else {
    console.log('(Sem coluna "esperado" preenchida — rodou só pra ver as classificações.)');
  }
  console.log(`\nTokens: ${inTot} entrada / ${outTot} saída`);
  console.log(`Custo deste teste: US$ ${custoUsd.toFixed(5)}  (~R$ ${(custoUsd * USD_BRL).toFixed(4)})`);
  console.log(`Média por resposta: US$ ${(custoUsd / Math.max(1, exemplos.length)).toFixed(6)}`);
  console.log('───────────────────────────\n');
}

main();
