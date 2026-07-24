// SSR das páginas de incorporadoras (/incorporadoras e /incorporadoras/:slug).
// Dados 100% auditados de data/incorporadoras.json — nada inventado; "—" onde a
// fonte não divulga. Ofertas só entram como FATO quando confirmadas como política
// da empresa; relato de equipe/gestor vem rotulado como "a confirmar".
// Radar de mercado (vagas de terceiros) é interno e NÃO é publicado aqui.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const DB = JSON.parse(readFileSync(join(process.cwd(), 'data/incorporadoras.json'), 'utf8'));

const BASE = 'https://www.rhimob.com.br';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function has(v) { return v && String(v).trim() && String(v).trim() !== '—'; }
const sim = (v) => /(^|[^a-zç])sim([^a-zç]|$)/i.test(v || '');

// "Por que trabalhar na X" — SOMENTE a partir dos dados auditados. Nada inventado;
// se a fonte não traz, o motivo simplesmente não aparece.
function whyWork(c) {
  const R = [];
  if (sim(c.housePropria)) {
    const nome = /—\s*(.+)/.test(c.housePropria) ? ` (${c.housePropria.split('—')[1].trim()})` : '';
    R.push(`Tem house própria${nome}: estrutura de vendas montada, com plantões e gestão comercial — você não depende só da sua rede.`);
  }
  if (sim(c.aceitaIniciantes)) R.push('Aceita corretor iniciante ou em formação (TTI) — dá para começar mesmo sem experiência.');
  if (/não obrigat/i.test(c.creci || '')) R.push('CRECI não é obrigatório para a inscrição inicial: você regulariza ao longo do processo.');
  if (sim(c.treinamento)) R.push('Oferece treinamento e onboarding para quem está chegando.');
  if (sim(c.leads)) R.push('As vagas citam leads e fluxo de clientes — menos prospecção no frio.');
  const nd = parseInt(c.notaDemanda, 10);
  if (nd >= 4) R.push(`Demanda alta por corretores (${c.notaDemanda}/5): recrutamento recorrente e muitas oportunidades abertas.`);
  if (has(c.lancamentos)) {
    const n = c.lancamentos.split(';').map((s) => s.trim()).filter(Boolean).length;
    R.push(`${n > 1 ? `${n} lançamentos` : 'Lançamentos'} citados na fonte — mais produto para vender e comissionar.`);
  }
  if (has(c.segmento)) R.push(`Atua em ${c.segmento}${has(c.presenca) ? ` (${c.presenca})` : ''}.`);
  return R;
}

// FAQ por empresa — respostas só com o que temos; onde não há, responde com
// transparência e linka o guia de salário (malha interna).
function faqItems(c) {
  const reasons = whyWork(c);
  const f = [];
  f.push({
    q: `Por que trabalhar como corretor na ${c.empresa}?`,
    a: reasons.length ? reasons.join(' ') : `${c.empresa} atua em ${c.segmento || 'São Paulo'}. As condições específicas para corretores não são amplamente divulgadas — vale confirmar diretamente ou pela RH IMOB.`
  });
  if (has(c.aceitaIniciantes)) f.push({ q: `A ${c.empresa} aceita corretor iniciante?`, a: c.aceitaIniciantes });
  if (has(c.housePropria)) f.push({ q: `A ${c.empresa} tem house própria?`, a: c.housePropria });
  if (has(c.leads)) f.push({ q: `A ${c.empresa} fornece leads para os corretores?`, a: c.leads });
  f.push({
    q: `Quanto ganha um corretor na ${c.empresa}?`,
    a: (has(c.comissao) || has(c.ajudaCusto))
      ? [has(c.comissao) ? `Comissão: ${c.comissao}` : '', has(c.ajudaCusto) ? `Ajuda de custo: ${c.ajudaCusto}` : ''].filter(Boolean).join(' · ')
      : `A ${c.empresa} não divulga publicamente comissão ou ajuda de custo. Veja a referência de mercado no nosso guia de salário e comissão do corretor.`
  });
  if (has(c.regioesContratando)) f.push({ q: `Onde a ${c.empresa} está contratando corretores?`, a: c.regioesContratando });
  return f;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const slug = (req.query.slug || '').toString().trim();

  if (!slug) {
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.send(renderHub());
  }
  const c = DB.companies.find((x) => x.slug === slug);
  if (!c) { res.status(404); return res.send(renderHub(`Empresa não encontrada. Veja todas as incorporadoras mapeadas.`)); }

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
  return res.send(renderCompany(c));
}

function head(title, desc, canonical) {
  return `<!doctype html><html lang="pt-BR"><head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","xluiu45itd");</script>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}"/>
  <meta name="robots" content="index, follow"/>
  <meta name="theme-color" content="#2b124d"/>
  <link rel="canonical" href="${canonical}"/>
  <link rel="icon" href="/favicon.ico" sizes="any"/>
  <meta property="og:type" content="website"/><meta property="og:locale" content="pt_BR"/>
  <meta property="og:site_name" content="RH IMOB"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(desc)}"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:image" content="${BASE}/assets/og-rhimob.jpg"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <link rel="stylesheet" href="/styles.css?v=20260706news"/>
  <style>
    .inc-hero{background:linear-gradient(135deg,#180826,#3b1a6b);color:#fff;padding:52px 0 40px}
    .inc-hero .eyebrow{color:#c4b5fd;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
    .inc-hero h1{font-size:clamp(26px,4vw,40px);letter-spacing:-.02em;margin:10px 0 8px;line-height:1.15;color:#ffab40}
    .inc-hero p{color:rgba(255,255,255,.8);font-size:16px;max-width:640px;line-height:1.6}
    .inc-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
    .inc-badge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:700}
    .inc-badge strong{color:#ffab40}
    .inc-cta-band{padding:26px 0;border-bottom:1px solid #ede8f8}
    .inc-cta-band.b2b{background:#2b124d}
    .inc-cta-h{font-size:19px;font-weight:900;color:#2b124d;margin:0 0 4px}
    .inc-cta-band.b2b .inc-cta-h{color:#fff}
    .inc-cta-p{font-size:14px;color:#6b5e7e;margin:0 0 16px}
    .inc-cta-band.b2b .inc-cta-p{color:#c4b5fd}
    .inc-cta-btns{display:flex;gap:12px;flex-wrap:wrap}
    .inc-btn{border:none;border-radius:12px;padding:13px 22px;font-size:14.5px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-block}
    .inc-btn--p{background:#7c3aed;color:#fff}.inc-btn--o{background:#fff;color:#7c3aed;border:2px solid #7c3aed}
    .inc-btn--w{background:#fff;color:#2b124d}
    .inc-section{padding:36px 0;border-bottom:1px solid #ede8f8}
    .inc-section h2{font-size:22px;color:#2b124d;margin:0 0 18px}
    .inc-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
    .inc-fact{background:#faf8ff;border:1px solid #ede8f8;border-radius:14px;padding:15px 18px}
    .inc-fact dt{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#7c3aed;margin-bottom:5px}
    .inc-fact dd{margin:0;font-size:14.5px;color:#2b124d;line-height:1.5}
    .inc-offer{border:1px solid #e8e0f4;border-radius:12px;padding:14px 18px;margin-bottom:10px}
    .inc-offer .tag{display:inline-block;font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;margin-bottom:6px}
    .inc-offer .tag.ok{background:#e7f7ee;color:#137a3f}.inc-offer .tag.warn{background:#fdf0e3;color:#9a5a12}
    .inc-note{font-size:12.5px;color:#9385a8;margin-top:14px;line-height:1.6}
    .inc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
    .inc-card{display:block;background:#fff;border:1px solid #e8e0f4;border-radius:14px;padding:18px;text-decoration:none;color:#2b124d;transition:border-color .15s,transform .15s}
    .inc-card:hover{border-color:#7c3aed;transform:translateY(-2px)}
    .inc-card h3{margin:0 0 4px;font-size:16px}.inc-card span{font-size:13px;color:#6b5e7e}
    .inc-mesh a{color:#7c3aed;font-weight:700}
    .inc-why{list-style:none;padding:0;margin:0;display:grid;gap:10px}
    .inc-why li{padding:12px 16px 12px 42px;background:#faf8ff;border:1px solid #ede8f8;border-radius:12px;position:relative;font-size:14.5px;color:#2b124d;line-height:1.5}
    .inc-why li::before{content:'✓';position:absolute;left:16px;top:12px;color:#7c3aed;font-weight:900}
    .inc-faq{display:flex;flex-direction:column;gap:10px}
    .inc-faq-item{border:1.5px solid #e8e4f2;border-radius:14px;overflow:hidden}
    .inc-faq-item[open]{border-color:#7c3aed}
    .inc-faq-item summary{padding:16px 20px;font-size:15px;font-weight:700;color:#2b124d;cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:14px}
    .inc-faq-item summary::-webkit-details-marker{display:none}
    .inc-faq-item summary::after{content:'+';color:#7c3aed;font-size:20px;line-height:1}
    .inc-faq-item[open] summary::after{content:'−'}
    .inc-faq-item>div{padding:0 20px 16px;font-size:14.5px;color:#444;line-height:1.7}
    .inc-faq-item a{color:#7c3aed;font-weight:700}
  </style></head><body>
  <header class="site-header"><div class="container header-inner">
    <a class="brand" href="/"><img src="/assets/rhimob-logo.jpg" alt="" class="brand-mark"/><span><strong>RH IMOB</strong><small>Recrutamento imobiliário</small></span></a>
    <nav class="main-nav"><a href="/">Contratar</a><a href="/vagas">Vagas</a><a href="/novos-talentos">Novos Talentos</a><a href="/incorporadoras">Incorporadoras</a></nav>
    <a class="btn btn-cta btn-header js-candidato" href="/vagas">Quero vagas</a>
  </div></header>`;
}

function foot() {
  return `<footer class="site-footer"><div class="container footer-bottom">
    <span>© 2026 RH IMOB · Recrutamento imobiliário especializado</span>
    <a href="/politica.html">Política de privacidade</a>
  </div></footer>
  <script src="/supabase-config-novos-talentos.js?v=20260721leadengine"></script>
  <script src="/script.js?v=20260721leadengine"></script>
  </body></html>`;
}

function ctaBtn(journey, origem, cls, label) {
  return `<button type="button" class="inc-btn ${cls}" data-journey="${journey}" data-origem="${esc(origem)}" onclick="window.RHLead ? window.RHLead.open('${journey}', this) : (location.href='/vagas')">${esc(label)}</button>`;
}

function renderCompany(c) {
  const url = `${BASE}/incorporadoras/${c.slug}`;
  const title = `Vagas e Como Trabalhar na ${c.empresa} (Corretor) | RH IMOB`;
  const desc = `${c.empresa}: ${[c.segmento, c.presenca].filter(has).join(' · ') || 'incorporadora em São Paulo'}. Como atuar como corretor, o que a empresa divulga e oportunidades. Dados auditados pela RH IMOB.`;
  const origemBase = `Incorporadora: ${c.empresa}`;

  const reasons = whyWork(c);
  const faq = faqItems(c);
  const faqLD = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) }).replace(/<\//g, '<\\/');
  // linka o guia de salário na resposta de "quanto ganha" (malha interna)
  const faqAnswerHtml = (a) => esc(a).replace(/guia de salário e comissão do corretor/i, '<a href="/salario-corretor-imoveis.html">guia de salário e comissão do corretor</a>');

  const fact = (label, val) => has(val) ? `<div class="inc-fact"><dt>${esc(label)}</dt><dd>${esc(val)}</dd></div>` : '';
  const facts = [
    fact('Segmento', c.segmento), fact('Presença em SP', c.presenca), fact('Sede', c.sede),
    fact('Regiões de atuação', c.atuacao), fact('House própria', c.housePropria),
    fact('Aceita iniciantes', c.aceitaIniciantes), fact('CRECI', c.creci),
    fact('Treinamento', c.treinamento), fact('Leads', c.leads),
    fact('Ajuda de custo', c.ajudaCusto || 'Não divulgado na fonte'),
    fact('Comissão', c.comissao || 'Não divulgado na fonte'),
    fact('Perfil procurado', c.perfilProcurado), fact('Regiões contratando', c.regioesContratando)
  ].filter(Boolean).join('');

  const ofc = DB.ofertas.filter((o) => o.empresa === c.empresa);
  const confirmadas = ofc.filter((o) => /confirmad/i.test(o.status) && /sim/i.test(o.ePadrao));
  const equipe = ofc.filter((o) => !(/confirmad/i.test(o.status) && /sim/i.test(o.ePadrao)) && has(o.oferta));
  const offerHtml = (o, ok) => `<div class="inc-offer"><span class="tag ${ok ? 'ok' : 'warn'}">${ok ? 'Política da empresa · confirmado' : 'Relato de equipe/anúncio · a confirmar'}</span>
    <div><strong>${esc(o.tipo || 'Condição')}:</strong> ${esc(o.oferta)}${has(o.valor) ? ` — <em>${esc(o.valor)}</em>` : ''}</div>
    ${has(o.quemOferece) ? `<div style="font-size:12.5px;color:#9385a8;margin-top:4px">Ofertante: ${esc(o.quemOferece)}</div>` : ''}</div>`;
  const offersSection = (confirmadas.length || equipe.length) ? `
    <section class="inc-section"><div class="container">
      <h2>Condições e benefícios (auditados)</h2>
      ${confirmadas.map((o) => offerHtml(o, true)).join('')}
      ${equipe.length ? `<details style="margin-top:6px"><summary style="cursor:pointer;font-weight:700;color:#7c3aed;font-size:13px">Relatado por equipes/anúncios — não confirmado como política (${equipe.length})</summary><div style="margin-top:12px">${equipe.map((o) => offerHtml(o, false)).join('')}</div></details>` : ''}
      <p class="inc-note">Só publicamos o que consta em fonte auditada. Ofertas de equipe/gestor não representam política corporativa. Última atualização: ${esc(c.atualizacao || '—')}.</p>
    </div></section>` : '';

  const fontes = (c.fontes || []).filter(has);

  return head(title, desc, url) + `
  <main>
    <section class="inc-hero"><div class="container">
      <span class="eyebrow"><a href="/incorporadoras" style="color:inherit;text-decoration:none">Incorporadoras SP</a> · ${esc(c.grupo || c.empresa)}</span>
      <h1>Trabalhar como corretor na ${esc(c.empresa)}</h1>
      <p>${esc(c.resumo || `${c.empresa} — incorporadora com atuação em São Paulo.`)}</p>
      <div class="inc-badges">
        ${has(c.segmento) ? `<span class="inc-badge">${esc(c.segmento)}</span>` : ''}
        ${has(c.notaDemanda) ? `<span class="inc-badge">Demanda por corretores: <strong>${esc(c.notaDemanda)}/5</strong></span>` : ''}
        ${has(c.housePropria) ? `<span class="inc-badge">House própria</span>` : ''}
        ${/sim/i.test(c.aceitaIniciantes || '') ? `<span class="inc-badge"><strong>Aceita iniciantes</strong></span>` : ''}
      </div>
    </div></section>

    <section class="inc-cta-band"><div class="container">
      <p class="inc-cta-h">Quer atuar com a ${esc(c.empresa)} ou em construtoras como ela?</p>
      <p class="inc-cta-p">Deixe seu contato — a RH IMOB conecta você às oportunidades certas para o seu perfil.</p>
      <div class="inc-cta-btns">
        ${ctaBtn('candidato', origemBase + ' (já é corretor)', 'inc-btn--p', 'Já sou corretor — quero vagas')}
        ${ctaBtn('candidato', origemBase + ' (novo talento)', 'inc-btn--o', 'Quero começar como corretor')}
      </div>
    </div></section>

    <section class="inc-section"><div class="container">
      <h2>Como a ${esc(c.empresa)} atua com corretores</h2>
      <div class="inc-facts">${facts}</div>
      ${has(c.lancamentos) ? `<p class="inc-note"><strong>Lançamentos citados:</strong> ${esc(c.lancamentos)}</p>` : ''}
      ${has(c.trabalheConosco) ? `<p style="margin-top:14px"><a class="inc-mesh" href="${esc(c.trabalheConosco)}" target="_blank" rel="noopener nofollow">Canal oficial da ${esc(c.empresa)} para corretores ↗</a></p>` : ''}
    </div></section>

    ${reasons.length ? `<section class="inc-section"><div class="container">
      <h2>Por que trabalhar como corretor na ${esc(c.empresa)}</h2>
      <ul class="inc-why">${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="inc-note">Baseado no que a ${esc(c.empresa)} e suas vagas divulgam publicamente (auditado em ${esc(c.atualizacao || '—')}). Condições podem variar por equipe e lançamento.</p>
    </div></section>` : ''}

    ${offersSection}

    <section class="inc-section"><div class="container inc-mesh">
      <h2>Oportunidades pela RH IMOB</h2>
      <p style="color:#6b5e7e;font-size:15px;line-height:1.6">Veja as <a href="/vagas">vagas que estamos anunciando</a>, entre no <a href="/novos-talentos">banco de novos talentos</a> ou volte para a <a href="/incorporadoras">lista de incorporadoras mapeadas</a>.</p>
    </div></section>

    <section class="inc-section"><div class="container">
      <h2>Perguntas frequentes</h2>
      <div class="inc-faq">${faq.map((x) => `<details class="inc-faq-item"><summary>${esc(x.q)}</summary><div>${faqAnswerHtml(x.a)}</div></details>`).join('')}</div>
    </div></section>
    <script type="application/ld+json">${faqLD}</script>

    <section class="inc-cta-band b2b"><div class="container">
      <p class="inc-cta-h">Precisa de corretores para a sua operação?</p>
      <p class="inc-cta-p">A RH IMOB recruta e forma times comerciais para incorporadoras e imobiliárias em São Paulo.</p>
      <div class="inc-cta-btns">${ctaBtn('empresa', origemBase + ' (contratante)', 'inc-btn--w', 'Quero contratar corretores')}</div>
    </div></section>

    ${fontes.length ? `<section class="inc-section"><div class="container"><p class="inc-note">Fontes auditadas: ${fontes.map((f) => `<a href="${esc(f)}" target="_blank" rel="noopener nofollow">fonte</a>`).join(' · ')}. Dados de caráter informativo, sujeitos a alteração pela empresa.</p></div></section>` : ''}
  </main>` + foot();
}

function renderHub(msg) {
  const url = `${BASE}/incorporadoras`;
  const cards = DB.companies
    .filter((c) => c.empresa)
    .sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'))
    .map((c) => `<a class="inc-card" href="/incorporadoras/${c.slug}"><h3>${esc(c.empresa)}</h3><span>${esc([c.segmento, c.presenca].filter(has).join(' · ') || 'Incorporadora SP')}</span></a>`)
    .join('');
  return head('Incorporadoras e Construtoras de SP — Vagas para Corretor | RH IMOB',
    'Mapa de incorporadoras e construtoras de São Paulo: como cada uma atua com corretores, o que divulga e onde estão as oportunidades. Dados auditados pela RH IMOB.',
    url) + `
  <main>
    <section class="inc-hero"><div class="container">
      <span class="eyebrow">RH IMOB · Inteligência de mercado</span>
      <h1>Incorporadoras e construtoras de São Paulo</h1>
      <p>Mapeamos como cada empresa atua com corretores — segmento, house própria, apoio a iniciantes e o que é divulgado publicamente. Escolha uma para ver os detalhes.</p>
    </div></section>
    ${msg ? `<section class="inc-section"><div class="container"><p class="inc-note">${esc(msg)}</p></div></section>` : ''}
    <section class="inc-cta-band"><div class="container">
      <p class="inc-cta-h">Quer receber as oportunidades certas?</p>
      <p class="inc-cta-p">Deixe seu contato e a RH IMOB conecta você às construtoras que combinam com seu perfil.</p>
      <div class="inc-cta-btns">
        <button type="button" class="inc-btn inc-btn--p" data-journey="candidato" data-origem="Hub incorporadoras (corretor)" onclick="window.RHLead ? window.RHLead.open('candidato', this) : (location.href='/vagas')">Já sou corretor — quero vagas</button>
        <button type="button" class="inc-btn inc-btn--o" data-journey="candidato" data-origem="Hub incorporadoras (novo talento)" onclick="window.RHLead ? window.RHLead.open('candidato', this) : (location.href='/vagas')">Quero começar como corretor</button>
      </div>
    </div></section>
    <section class="inc-section"><div class="container">
      <h2>Empresas mapeadas (${DB.companies.length})</h2>
      <div class="inc-grid">${cards}</div>
    </div></section>
    <section class="inc-cta-band b2b"><div class="container">
      <p class="inc-cta-h">É incorporadora ou imobiliária e precisa contratar?</p>
      <p class="inc-cta-p">Recrutamos e formamos times comerciais em São Paulo.</p>
      <div class="inc-cta-btns"><button type="button" class="inc-btn inc-btn--w" data-journey="empresa" data-origem="Hub incorporadoras (contratante)" onclick="window.RHLead ? window.RHLead.open('empresa', this) : (location.href='/#proposta')">Quero contratar corretores</button></div>
    </div></section>
  </main>` + foot();
}
