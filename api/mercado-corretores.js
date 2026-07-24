// SSR de /mercado-corretores — painel de mercado para EMPRESAS entenderem o que
// é preciso oferecer para competir por corretores. Dados 100% agregados e
// auditados (data/mercado-corretores.json); nenhum nome de empresa/concorrente
// ou contato é exposto — só estatística de mercado e o benchmark RH IMOB.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const DB = JSON.parse(readFileSync(join(process.cwd(), 'data/mercado-corretores.json'), 'utf8'));

const BASE = 'https://www.rhimob.com.br';
const URL = `${BASE}/mercado-corretores`;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function has(v) { return v && String(v).trim() && String(v).trim() !== '—'; }

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.send(render());
}

const NIVEL_ORDER = ['Essencial', 'Competitivo', 'Agressivo'];
const NIVEL_COLOR = { Essencial: '#6b5e7e', Competitivo: '#7c3aed', Agressivo: '#ff7a1a' };
const PERFIL_DESC = {
  'Iniciante / sem CRECI': 'Quem está começando ou ainda regularizando o CRECI — o que oferecer para reduzir abandono nos primeiros meses.',
  'Corretor experiente': 'Corretor já ativo, com carteira — o que oferecer para atrair e reter quem já vende.',
  'Gerente / liderança': 'Posições de liderança comercial — o que oferecer para formar e manter gestores de equipe.'
};

function factRow(label, val) {
  return has(val) ? `<div class="mc-f"><dt>${esc(label)}</dt><dd>${esc(val)}</dd></div>` : '';
}

function levelCard(row) {
  const color = NIVEL_COLOR[row.nivel] || '#6b5e7e';
  return `<div class="mc-card" style="--c:${color}">
    <div class="mc-card-top"><span class="mc-nivel">${esc(row.nivel)}</span>${has(row.atratividade) ? `<span class="mc-score">${esc(row.atratividade)}/10</span>` : ''}</div>
    ${has(row.objetivo) ? `<p class="mc-obj">${esc(row.objetivo)}</p>` : ''}
    <dl class="mc-facts">
      ${factRow('Comissão / variável', row.comissao)}
      ${factRow('Ajuda de custo', row.ajudaCusto)}
      ${factRow('Leads / mídia', row.leads)}
      ${factRow('TTI / CRECI', row.ttiCreci)}
      ${factRow('Treinamento', row.treinamento)}
      ${factRow('Ferramentas / CRM', row.ferramentas)}
      ${factRow('Premiação', row.premiacao)}
      ${factRow('Prazo de pagamento', row.prazoPagamento)}
      ${factRow('Contrapartida / metas', row.contrapartida)}
      ${factRow('Vínculo', row.vinculo)}
      ${factRow('Duração / piloto', row.duracao)}
    </dl>
    <div class="mc-tags">
      ${has(row.custoRelativo) ? `<span class="mc-tag">Custo: ${esc(row.custoRelativo)}</span>` : ''}
      ${has(row.risco) ? `<span class="mc-tag">Risco: ${esc(row.risco)}</span>` : ''}
    </div>
    ${has(row.recomendacao) ? `<p class="mc-reco">${esc(row.recomendacao)}</p>` : ''}
  </div>`;
}

function perfilBlock(perfil, idx) {
  const rows = DB.matriz.filter((r) => r.perfil === perfil);
  const segmentos = [...new Set(rows.map((r) => r.segmento))];
  const body = segmentos.map((seg) => {
    const cells = NIVEL_ORDER.map((niv) => rows.find((r) => r.segmento === seg && r.nivel === niv)).filter(Boolean);
    return `<div class="mc-segrow">
      <h3 class="mc-segh">${esc(seg)}</h3>
      <div class="mc-cards">${cells.map(levelCard).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="mc-tabpanel" id="mc-tab-${idx}" ${idx === 0 ? '' : 'hidden'}>
    <p class="mc-perfildesc">${esc(PERFIL_DESC[perfil] || '')}</p>
    ${body}
  </div>`;
}

function render() {
  const title = 'Painel de Mercado: O Que Oferecer para Contratar Corretores em 2026 | RH IMOB';
  const desc = 'Benchmark real de propostas para corretores de imóveis em São Paulo: comissão, ajuda de custo, leads e treinamento por nível de competitividade. Dados agregados de 56 incorporadoras e 42 vagas monitoradas.';
  const { radarAgg: R, empresaAgg: E } = DB;

  const perfis = [...new Set(DB.matriz.map((r) => r.perfil))];
  const tabs = perfis.map((p, i) => `<button type="button" class="mc-tabbtn${i === 0 ? ' on' : ''}" data-tab="${i}">${esc(p)}</button>`).join('');
  const panels = perfis.map((p, i) => perfilBlock(p, i)).join('');

  const faqLD = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Por que uma vaga para corretor sem proposta clara não funciona?', acceptedAnswer: { '@type': 'Answer', text: `Em ${E.total} incorporadoras mapeadas em São Paulo, a demanda por corretores é alta ou muito alta em ${E.pctDemandaAltaMuitoAlta}% dos casos, mas apenas ${E.pctDivulgaComissao}% divulgam publicamente a comissão e ${E.pctDivulgaAjudaCusto}% divulgam ajuda de custo. Corretores comparam oportunidades; uma vaga sem condições claras perde para quem apresenta proposta completa.` } },
      { '@type': 'Question', name: 'Quanto do mercado oferece leads para o corretor?', acceptedAnswer: { '@type': 'Answer', text: `Apenas ${E.pctOfereceLeads}% das incorporadoras mapeadas divulgam fornecimento de leads, e ${R.pctLeadsCitado}% das vagas monitoradas citam leads/fluxo. É um diferencial competitivo real, não um padrão de mercado.` } },
      { '@type': 'Question', name: 'O que é o benchmark Essencial, Competitivo e Agressivo da RH IMOB?', acceptedAnswer: { '@type': 'Answer', text: 'São 3 níveis de proposta que recomendamos conforme a urgência da contratação: Essencial é o piso para reduzir abandono nos primeiros meses; Competitivo é o pacote indicado para contratação em volume; Agressivo é para ganhar escala rápida em lançamento, com orçamento e indicadores fechados. A recomendação é da RH IMOB, construída a partir de vagas e ofertas reais monitoradas no mercado.' } }
    ]
  }).replace(/<\//g, '<\\/');

  return `<!doctype html><html lang="pt-BR"><head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","xluiu45itd");</script>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}"/>
  <meta name="robots" content="index, follow"/>
  <meta name="theme-color" content="#2b124d"/>
  <link rel="canonical" href="${URL}"/>
  <link rel="icon" href="/favicon.ico" sizes="any"/>
  <meta property="og:type" content="website"/><meta property="og:locale" content="pt_BR"/>
  <meta property="og:site_name" content="RH IMOB"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(desc)}"/>
  <meta property="og:url" content="${URL}"/>
  <meta property="og:image" content="${BASE}/assets/og-rhimob.jpg"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <link rel="stylesheet" href="/styles.css?v=20260706news"/>
  <script type="application/ld+json">${faqLD}</script>
  <style>
    .mc-hero{background:linear-gradient(135deg,#180826,#3b1a6b);color:#fff;padding:56px 0 44px}
    .mc-hero .eyebrow{color:#c4b5fd;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
    .mc-hero h1{font-size:clamp(26px,4.2vw,42px);letter-spacing:-.02em;margin:10px 0 12px;line-height:1.15}
    .mc-hero p{color:rgba(255,255,255,.82);font-size:16.5px;max-width:700px;line-height:1.65}
    .mc-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:26px}
    .mc-stat{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:16px 18px}
    .mc-stat strong{display:block;font-size:30px;font-weight:900;color:#ffab40;line-height:1.1}
    .mc-stat span{font-size:13px;color:rgba(255,255,255,.75);line-height:1.4;display:block;margin-top:4px}
    .mc-section{padding:40px 0;border-bottom:1px solid #ede8f8}
    .mc-section h2{font-size:22px;color:#2b124d;margin:0 0 8px}
    .mc-section>.container>p.mc-lead{color:#6b5e7e;font-size:15px;max-width:760px;line-height:1.65;margin:0 0 24px}
    .mc-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;border-bottom:2px solid #ede8f8}
    .mc-tabbtn{background:none;border:none;padding:12px 18px;font-size:14.5px;font-weight:800;color:#8c809d;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px}
    .mc-tabbtn.on{color:#7c3aed;border-color:#7c3aed}
    .mc-perfildesc{color:#6b5e7e;font-size:14.5px;margin-bottom:20px;max-width:720px;line-height:1.6}
    .mc-segrow{margin-bottom:28px}
    .mc-segh{font-size:16px;font-weight:900;color:#2b124d;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #ede8f8}
    .mc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
    .mc-card{background:#fff;border:1px solid #e8e0f4;border-top:4px solid var(--c);border-radius:14px;padding:16px}
    .mc-card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
    .mc-nivel{font-size:12px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--c)}
    .mc-score{font-size:12px;font-weight:800;background:#faf8ff;border:1px solid #ede8f8;border-radius:999px;padding:2px 10px;color:#2b124d}
    .mc-obj{font-size:13.5px;color:#6b5e7e;font-style:italic;margin:0 0 12px;line-height:1.5}
    .mc-facts{margin:0;display:flex;flex-direction:column;gap:8px}
    .mc-f dt{font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#9385a8;margin:0}
    .mc-f dd{margin:1px 0 0;font-size:13px;color:#2b124d;line-height:1.4}
    .mc-tags{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
    .mc-tag{font-size:10.5px;font-weight:700;background:#faf8ff;border:1px solid #ede8f8;border-radius:999px;padding:3px 9px;color:#6b5e7e}
    .mc-reco{font-size:12.5px;color:#137a3f;background:#e7f7ee;border-radius:8px;padding:8px 10px;margin:12px 0 0;line-height:1.5}
    .mc-cta-band{padding:34px 0;background:#2b124d}
    .mc-cta-h{font-size:21px;font-weight:900;color:#fff;margin:0 0 6px}
    .mc-cta-p{font-size:14.5px;color:#c4b5fd;margin:0 0 18px;max-width:560px;line-height:1.6}
    .mc-btn{border:none;border-radius:12px;padding:14px 26px;font-size:15px;font-weight:800;cursor:pointer;background:#7c3aed;color:#fff}
    .mc-note{font-size:12.5px;color:#9385a8;margin-top:16px;line-height:1.7;max-width:760px}
    .mc-mesh a{color:#7c3aed;font-weight:700}
  </style></head><body>
  <header class="site-header"><div class="container header-inner">
    <a class="brand" href="/"><img src="/assets/rhimob-logo.jpg" alt="" class="brand-mark"/><span><strong>RH IMOB</strong><small>Recrutamento imobiliário</small></span></a>
    <nav class="main-nav"><a href="/">Contratar</a><a href="/incorporadoras">Incorporadoras</a><a href="/vagas">Vagas</a><a href="/mercado-corretores" aria-current="page">Mercado</a></nav>
    <a class="btn btn-cta btn-header" href="#" data-journey="empresa" data-origem="Painel de mercado (header)" onclick="return false" id="mcHeaderCta">Quero montar minha proposta</a>
  </div></header>

  <main>
    <section class="mc-hero"><div class="container">
      <span class="eyebrow">RH IMOB · Inteligência de mercado 2026</span>
      <h1>O que é preciso oferecer para contratar corretores agora</h1>
      <p>Mapeamos ${E.total} incorporadoras e ${R.total} vagas ativas do mercado de São Paulo para mostrar, com dados reais, o que separa uma vaga que atrai corretores de uma vaga que fica parada.</p>
      <div class="mc-stat-grid">
        <div class="mc-stat"><strong>${E.pctDemandaAltaMuitoAlta}%</strong><span>das incorporadoras mapeadas têm demanda alta ou muito alta por corretores</span></div>
        <div class="mc-stat"><strong>${E.pctDivulgaComissao}%</strong><span>divulgam publicamente o percentual de comissão oferecido</span></div>
        <div class="mc-stat"><strong>${E.pctDivulgaAjudaCusto}%</strong><span>divulgam o valor da ajuda de custo</span></div>
        <div class="mc-stat"><strong>${E.pctOfereceLeads}%</strong><span>afirmam fornecer leads ao corretor</span></div>
      </div>
    </div></section>

    <section class="mc-section"><div class="container">
      <h2>A demanda é alta. A transparência, não.</h2>
      <p class="mc-lead">Isso é o que torna uma proposta clara um diferencial competitivo — não um detalhe. Corretores comparam oportunidades, e a maioria das vagas monitoradas não dá a eles com o que comparar.</p>
      <div class="mc-facts" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
        ${factRow('Vagas monitoradas', `${R.total} vagas (${R.ativas} ativas na data da auditoria)`)}
        ${factRow('Sem remuneração quantificada', `${100 - R.pctRemuneracaoQuantificada}% das vagas ativas não informam valor ou percentual`)}
        ${factRow('Citam fixo ou ajuda de custo', `${R.pctFixoCitado}% das vagas`)}
        ${factRow('Citam leads ou fluxo de clientes', `${R.pctLeadsCitado}% das vagas`)}
        ${factRow('Citam apoio a CRECI/TTI', `${R.pctApoioCreci}% das vagas`)}
        ${factRow('Citam benefícios/incentivos', `${R.pctBeneficios}% das vagas`)}
        ${factRow('Nota média (vagas com proposta completa)', `${R.notaMedia}/10 — quem divulga tudo, atrai melhor`)}
        ${factRow('Incorporadoras com house própria', `${E.pctHousePropria}% das ${E.total} mapeadas`)}
      </div>
    </div></section>

    <section class="mc-section"><div class="container">
      <h2>Benchmark RH IMOB: 3 níveis de proposta por perfil</h2>
      <p class="mc-lead">Construído a partir de vagas e ofertas reais monitoradas no mercado paulista. Use como referência para montar uma proposta competitiva conforme a urgência da contratação — <strong>Essencial</strong> é o piso, <strong>Competitivo</strong> é o recomendado para volume, <strong>Agressivo</strong> é para escalar rápido com orçamento e indicadores fechados.</p>
      <div class="mc-tabs">${tabs}</div>
      ${panels}
    </div></section>

    <section class="mc-cta-band"><div class="container">
      <p class="mc-cta-h">Quer montar uma proposta que realmente compete?</p>
      <p class="mc-cta-p">A RH IMOB ajuda você a estruturar comissão, ajuda de custo, leads e treinamento no nível certo para sua urgência de contratação — e já entrega os corretores.</p>
      <button type="button" class="mc-btn" data-journey="empresa" data-origem="Painel de mercado (CTA principal)" onclick="window.RHLead ? window.RHLead.open('empresa', this) : (location.href='/#proposta')">Quero montar minha proposta →</button>
    </div></section>

    <section class="mc-section"><div class="container mc-mesh">
      <p style="color:#6b5e7e;font-size:14px;line-height:1.6">Veja também o <a href="/incorporadoras">mapa de incorporadoras de São Paulo</a>, o <a href="/blog/quanto-custa-recrutamento-imobiliario.html">custo de um processo de recrutamento</a> e como <a href="/blog/como-montar-equipe-corretores.html">montar sua equipe de corretores</a>.</p>
      <p class="mc-note">Metodologia: dados agregados a partir de ${E.total} incorporadoras e ${R.total} vagas de corretor monitoradas publicamente em São Paulo, com auditoria de fonte e nível de confiança. Números refletem o que é divulgado publicamente pelo mercado, não representam política de nenhuma empresa específica, e podem mudar conforme novas vagas e ofertas são monitoradas. Última atualização: ${esc(DB.geradoEm)}.</p>
    </div></section>
  </main>

  <footer class="site-footer"><div class="container footer-bottom">
    <span>© 2026 RH IMOB · Recrutamento imobiliário especializado</span>
    <a href="/politica.html">Política de privacidade</a>
  </div></footer>
  <script src="/supabase-config-novos-talentos.js?v=20260721leadengine"></script>
  <script src="/script.js?v=20260721leadengine"></script>
  <script>
    document.getElementById('mcHeaderCta').addEventListener('click', function(e){ e.preventDefault(); if(window.RHLead) window.RHLead.open('empresa', this); });
    document.querySelectorAll('.mc-tabbtn').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.mc-tabbtn').forEach(function(b){ b.classList.remove('on'); });
        document.querySelectorAll('.mc-tabpanel').forEach(function(p){ p.hidden = true; });
        btn.classList.add('on');
        document.getElementById('mc-tab-' + btn.dataset.tab).hidden = false;
      });
    });
  </script>
  </body></html>`;
}
