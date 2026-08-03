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
function escJs(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' '); }

// Mesmo padrão de compartilhar de api/artigo.js, api/vaga.js e api/incorporadora.js,
// incluindo "Baixar arte" (gerador de imagem via /assets/share-art.js) — padrão
// obrigatório em toda página compartilhável do site (ver CLAUDE.md / memória).
function shareWidget(url, title, art) {
  const enc = encodeURIComponent(url);
  const textEnc = encodeURIComponent(title);
  const a = art || {};
  const kicker = escJs(a.kicker || 'MERCADO · RH IMOB');
  const sub = escJs(a.sub || 'Benchmark de mercado para contratar corretores — RH IMOB');
  const ctaText = escJs(a.ctaText || 'Ver o painel completo');
  return `<div class="mc-share">
    <span class="mc-share-label">Compartilhar</span>
    <a class="ssbtn ssbtn-wa" href="https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' — ' + url)}" target="_blank" rel="noopener" title="WhatsApp"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.928l6.235-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg></a>
    <a class="ssbtn ssbtn-fb" href="https://www.facebook.com/sharer/sharer.php?u=${enc}" target="_blank" rel="noopener" title="Facebook" onclick="navigator.clipboard.writeText('${escJs(title)} — ${escJs(url)}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
    <a class="ssbtn ssbtn-x" href="https://twitter.com/intent/tweet?text=${textEnc}&url=${enc}" target="_blank" rel="noopener" title="X (Twitter)"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
    <a class="ssbtn ssbtn-li" href="https://www.linkedin.com/sharing/share-offsite/?url=${enc}" target="_blank" rel="noopener" title="LinkedIn"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
    <button type="button" class="ssbtn ssbtn-copy" title="Copiar link" onclick="navigator.clipboard.writeText('${escJs(url)}').then(()=>{this.classList.add('ok');setTimeout(()=>this.classList.remove('ok'),1800)})"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button>
    <button type="button" class="ssbtn ssbtn-art" title="Baixar arte para Status / Story / Instagram" onclick="gerarArteRHIMOB({kicker:'${kicker}',title:'${escJs(title)}',sub:'${sub}',ctaText:'${ctaText}',ctaColor:'#ff7a1a',url:'${escJs(url)}',filename:'mercado-corretores-rhimob.png'},this)"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5z"/></svg> Baixar arte</button>
  </div>`;
}
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
    .mc-hero h1{font-size:clamp(26px,4.2vw,42px);letter-spacing:-.02em;margin:10px 0 12px;line-height:1.15;color:#ffab40}
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
    .mc-share{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:22px}
    .mc-share-label{color:rgba(255,255,255,.6);font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-right:2px}
    .ssbtn{width:38px;height:38px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:none;cursor:pointer;color:#fff;transition:transform .15s;flex-shrink:0}
    .ssbtn:hover{transform:scale(1.1)}
    .ssbtn-wa{background:#25d366}.ssbtn-fb{background:#1877f2}.ssbtn-x{background:#000}.ssbtn-li{background:#0077b5}
    .ssbtn-copy{background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.35)}
    .ssbtn-copy.ok{background:#25d366;border-color:#25d366}
    .ssbtn-art{background:linear-gradient(135deg,#ff7a1a,#ff9d4d);width:auto!important;padding:0 16px;border-radius:19px;font-size:12px;font-weight:800;gap:7px;letter-spacing:.02em;display:inline-flex;align-items:center}
    .ssbtn-art:disabled{opacity:.6;cursor:wait}
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
      ${shareWidget(URL, 'O que oferecer para contratar corretores em 2026 — RH IMOB')}
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
  <script src="/assets/share-art.js"></script>
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
