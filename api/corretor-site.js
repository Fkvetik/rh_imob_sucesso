// Vercel Function — site do corretor (parceria RH IMOB)
// vercel.json: /corretor/:cidade/:nome → /api/corretor-site?cidade=:cidade&nome=:nome
// Dados: corretor_sites no Coletor (SQL SITES_1), via rpc_site_publico.
// Publicado: aberto a todos. Rascunho: só com ?t=<chave de edição> (prévia),
// sempre com noindex e sem cache.
import { COLETOR } from './_ext-comum.js';

const BASE = 'https://www.rhimob.com.br';
// WhatsApp da RH IMOB (Fernando), o mesmo do site: quem quer criar o próprio site fala aqui.
const RH_WA = '5511953973268';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
function urlOk(u) { return /^https:\/\//i.test(String(u || '')) ? u : ''; }

const ICON = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12 0C5.37 0 0 5.37 0 12c0 2.12.56 4.12 1.53 5.85L.06 23.93l6.24-1.64A11.94 11.94 0 0012 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.37.06 2.63.33 3.61 1.31.98.98 1.25 2.24 1.31 3.61.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.06 1.37-.33 2.63-1.31 3.61-.98.98-2.24 1.25-3.61 1.31-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.37-.06-2.63-.33-3.61-1.31-.98-.98-1.25-2.24-1.31-3.61C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.06-1.37.33-2.63 1.31-3.61.98-.98 2.24-1.25 3.61-1.31C8.42 2.17 8.8 2.16 12 2.16zm0 3.68a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.44 18.63.07 12 .07S0 5.44 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08v-3.47h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.38C19.61 23.03 24 18.06 24 12.07z"/></svg>',
  li: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
  yt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 00.5 6.19 31.6 31.6 0 000 12a31.6 31.6 0 00.5 5.81 3.02 3.02 0 002.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 002.12-2.14A31.6 31.6 0 0024 12a31.6 31.6 0 00-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>'
};

function naoEncontrado() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada | RH IMOB</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f4fb;color:#2b124d;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}a{color:#6d28d9;font-weight:700}</style></head>
<body><div><h1 style="font-size:22px">Esta página não está disponível</h1><p>O site pode ainda não ter sido publicado pelo corretor.</p><p><a href="${BASE}/">Conhecer a RH IMOB</a></p></div></body></html>`;
}

const PROF = {
  CORRETOR:    { t: 'Corretor(a) de imóveis', reg: 'CRECI' },
  IMOBILIARIA: { t: 'Imobiliária', reg: 'CRECI' },
  GERENTE:     { t: 'Gerente de vendas', reg: 'CRECI' },
  ADVOGADO:    { t: 'Advogado(a) imobiliário', reg: 'OAB' },
  ARQUITETO:   { t: 'Arquiteto(a)', reg: 'CAU' },
  ENGENHEIRO:  { t: 'Engenheiro(a)', reg: 'CREA' },
  OUTRO:       { t: 'Profissional do mercado imobiliário', reg: 'Registro' }
};
const FINALIDADE = { VENDA: 'Venda', LOCACAO: 'Locação' };
const TIPO_IMOVEL = { APARTAMENTO: 'Apartamento', CASA: 'Casa', SOBRADO: 'Sobrado', COBERTURA: 'Cobertura', TERRENO: 'Terreno',
  SALA: 'Sala comercial', LOJA: 'Loja', GALPAO: 'Galpão', CHACARA: 'Chácara', OUTRO: 'Imóvel' };
const ZONA = { NORTE: 'Zona Norte', SUL: 'Zona Sul', LESTE: 'Zona Leste', OESTE: 'Zona Oeste', CENTRO: 'Centro' };

function render(s, prev, url) {
  const tel = soDigitos(s.telefone);
  const primeiro = String(s.nome || '').split(' ')[0];
  const albuns = Array.isArray(s.albuns) ? s.albuns.filter(a => a && Array.isArray(a.fotos) && a.fotos.length) : [];
  // Lançamentos da rede RH IMOB (SQL REDE_1): o admin cadastra por cidade/zona e
  // aparecem aqui sozinhos. O contato continua indo para o WhatsApp do profissional.
  const rede = Array.isArray(s.rede) ? s.rede.filter(a => a && Array.isArray(a.fotos) && a.fotos.length) : [];
  // Capa: a imagem que o profissional subir; sem ela, o banner padrão da parceria.
  const capa = urlOk(s.capa_url);
  const foto = urlOk(s.foto_url);
  const prof = PROF[s.profissao] || PROF.CORRETOR;
  // Zonas são da capital: fora de São Paulo, dizemos de onde são.
  const capital = s.cidade_slug === 'sao-paulo';
  // "Todas as regiões" (SQL REDE_4) atende a cidade inteira: não vira zona da capital.
  const todasRegioes = (Array.isArray(s.zonas) ? s.zonas : []).includes('TODAS');
  const zonas = todasRegioes ? [] : (Array.isArray(s.zonas) ? s.zonas : []).map(z => ZONA[z] && (capital ? ZONA[z] : ZONA[z] + ' (SP)')).filter(Boolean);
  const bairros = Array.isArray(s.bairros) ? s.bairros.filter(Boolean) : [];
  // Outras cidades que atende (SQL SITES_6), além da cidade do link.
  const cidades = Array.isArray(s.cidades) ? s.cidades.filter(c => c && c !== s.cidade) : [];
  const atuaEm = [zonas.join(' · '), bairros.join(', ')].filter(Boolean).join(' — ');
  const listaCidades = (l) => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : (l[0] || '');
  const todasCidades = [s.cidade, ...cidades];
  // Título: até duas cidades, para caber no resultado do Google.
  const titulo = `${s.nome} — ${prof.t} em ${todasCidades.length > 2 ? todasCidades.slice(0, 2).join(', ') + ' e região' : listaCidades(todasCidades)}`;
  // Descrição: sempre com as regiões (é o que a pessoa procura no Google), depois o "Sobre".
  const desc = [
    `${prof.t} em ${listaCidades(todasCidades)}${atuaEm ? ' — ' + atuaEm : ''}${s.creci ? `. ${prof.reg} ${s.creci}` : ''}.`,
    s.bio ? String(s.bio).replace(/\s+/g, ' ') : `Fale com ${primeiro} pelo WhatsApp.`
  ].join(' ').slice(0, 160);
  const ogImg = capa || foto || (albuns[0] && urlOk(albuns[0].fotos[0])) || '';
  // Vaga para corretores (imobiliária / gerente de vendas, SQL SITES_4).
  const vaga = (s.vaga && s.vaga.aberta && (s.profissao === 'IMOBILIARIA' || s.profissao === 'GERENTE')) ? s.vaga : null;
  const waVaga = vaga && tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Olá! Vi a vaga de corretor na página de ${s.nome} (RH IMOB) e tenho interesse.`)}` : '';
  const vagaHtml = !vaga ? '' : `
  <section><h2>💼 Estamos contratando corretores</h2>
    <div class="vaga">
      ${vaga.vagas ? `<div class="vaga-num">${esc(vaga.vagas)} vaga${vaga.vagas > 1 ? 's' : ''} aberta${vaga.vagas > 1 ? 's' : ''}</div>` : ''}
      <dl>
        ${vaga.horario ? `<dt>Horário</dt><dd>${esc(vaga.horario)}</dd>` : ''}
        ${vaga.beneficios ? `<dt>Benefícios</dt><dd>${esc(vaga.beneficios)}</dd>` : ''}
        ${vaga.comissao ? `<dt>Comissão</dt><dd>${esc(vaga.comissao)}</dd>` : ''}
        ${vaga.perfil ? `<dt>Perfil</dt><dd>${esc(vaga.perfil)}</dd>` : ''}
      </dl>
      ${vaga.descricao ? `<p>${esc(vaga.descricao)}</p>` : ''}
      ${waVaga ? `<a class="btn btn-wa" data-onde="VAGA" href="${esc(waVaga)}" target="_blank" rel="noopener">${ICON.wa} Quero me candidatar</a>` : ''}
    </div>
  </section>`;
  const waMsg = encodeURIComponent(`Olá, ${primeiro}! Vi seu site e quero falar sobre imóveis.`);
  const wa = tel ? `https://wa.me/${tel}?text=${waMsg}` : '';
  const redes = [
    ['ig', urlOk(s.instagram), 'Instagram'], ['fb', urlOk(s.facebook), 'Facebook'],
    ['li', urlOk(s.linkedin), 'LinkedIn'], ['yt', urlOk(s.youtube), 'YouTube']
  ].filter(r => r[1]);
  const iniciais = String(s.nome || '?').split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  // "Onde atendo" em texto corrido: o Google lê as regiões na própria página.
  const ondeHtml = (cidades.length || zonas.length || bairros.length || todasRegioes) ? `
  <section><h2>Onde atendo</h2>
    <div class="bio">${esc(primeiro)} atende em <b>${esc(listaCidades(todasCidades))}</b>${todasRegioes ? ', em todas as regiões' : ''}${zonas.length ? `, ${zonas.length > 1 ? 'nas regiões' : 'na'} ${esc(listaCidades(zonas))}` : ''}${bairros.length ? `, com atuação nos bairros ${esc(listaCidades(bairros))}` : ''}.</div>
  </section>` : '';
  // Dados estruturados (schema.org) para o Google entender quem é, onde atende e o registro.
  const ld = prev ? null : {
    '@context': 'https://schema.org', '@type': 'RealEstateAgent', name: s.nome, url, description: desc,
    ...(tel ? { telephone: '+' + tel } : {}),
    ...(foto || ogImg ? { image: foto || ogImg } : {}),
    address: { '@type': 'PostalAddress', addressLocality: s.cidade, addressCountry: 'BR' },
    areaServed: [
      ...todasCidades.map(c => ({ '@type': 'City', name: c })),
      ...zonas.map(z => ({ '@type': 'Place', name: capital ? `${z}, São Paulo` : z.replace(' (SP)', ', São Paulo') })),
      ...bairros.map(b => ({ '@type': 'Place', name: `${b}, ${s.cidade}` }))
    ],
    ...(s.creci ? { identifier: { '@type': 'PropertyValue', propertyID: prof.reg, value: String(s.creci) } } : {}),
    ...(redes.length ? { sameAs: redes.map(r => r[1]) } : {})
  };
  const ldHtml = ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : '';
  const waParceria = `https://wa.me/${RH_WA}?text=${encodeURIComponent(`Olá, Fernando! Vi o site de ${s.nome} na RH IMOB e quero criar o meu site gratuito e ser parceiro.`)}`;
  // Ficha de cada imóvel (SQL SITES_5). Álbuns antigos não têm ficha: só título e fotos.
  const fichaDe = (a, daRede) => {
    const specs = [
      a.dorm ? `${a.dorm} dorm` : '', a.suites ? `${a.suites} suíte${a.suites > 1 ? 's' : ''}` : '',
      a.vagas ? `${a.vagas} vaga${a.vagas > 1 ? 's' : ''}` : '', a.area ? `${Number(a.area).toLocaleString('pt-BR')} m²` : '', a.bairro || ''
    ].filter(Boolean).join(' · ');
    const temFicha = !!(a.finalidade || a.tipo || a.preco || specs || a.descricao);
    const preco = a.preco ? 'R$ ' + Number(a.preco).toLocaleString('pt-BR') + (a.finalidade === 'LOCACAO' ? '/mês' : '') : (temFicha ? 'Sob consulta' : '');
    const nomeImovel = a.titulo || TIPO_IMOVEL[a.tipo] || 'imóvel';
    return {
      titulo: a.titulo || TIPO_IMOVEL[a.tipo] || 'Imóvel', fin: FINALIDADE[a.finalidade] || '', tipo: TIPO_IMOVEL[a.tipo] || '',
      preco, specs, desc: a.descricao || '',
      wa: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Olá, ${primeiro}! Vi o ${daRede ? 'lançamento ' : ''}${nomeImovel} no seu site e quero mais informações.${daRede && a.id ? ` (Ref. RH-${a.id})` : ''}`)}` : '',
      construtora: daRede ? (a.construtora || '') : '', onde: daRede ? 'REDE' : 'IMOVEL', rid: daRede ? (a.id || null) : null
    };
  };
  const fichas = albuns.map(a => fichaDe(a, false));
  const fichasRede = rede.map(a => fichaDe(a, true));
  // Lightbox: primeiro os imóveis do profissional, depois os da rede (índice continua)
  const todos = [...albuns, ...rede], todasFichas = [...fichas, ...fichasRede];
  const dadosAlbuns = JSON.stringify(todos.map((a, k) => ({
    t: todasFichas[k].titulo, f: a.fotos.filter(urlOk), l: Array.isArray(a.legendas) ? a.legendas : [],
    fin: todasFichas[k].fin, tipo: todasFichas[k].tipo, preco: todasFichas[k].preco, specs: todasFichas[k].specs, desc: todasFichas[k].desc,
    wa: todasFichas[k].wa, co: todasFichas[k].construtora, onde: todasFichas[k].onde, rid: todasFichas[k].rid
  }))).replace(/</g, '\\u003c');
  const cardAlbum = (a, f, i) => `
      <button class="album" type="button" data-album="${i}">
        <div class="img"><img src="${esc(a.fotos[0])}" alt="${esc(f.titulo)}" loading="lazy">${f.fin ? `<span class="fin">${esc(f.fin)}</span>` : ''}</div>
        <div class="info">
          ${f.preco ? `<span class="preco">${esc(f.preco)}</span>` : ''}
          <strong>${esc(f.titulo)}</strong>
          ${f.specs ? `<span class="specs">${esc(f.specs)}</span>` : ''}
          ${f.local ? `<small style="display:block">📍 ${esc(f.local)}</small>` : ''}
          <small>${f.construtora ? esc(f.construtora) + ' · ' : ''}${f.tipo ? esc(f.tipo) + ' · ' : ''}${a.fotos.length} foto${a.fotos.length === 1 ? '' : 's'}</small>
        </div>
      </button>`;
  // Filtro dos lançamentos: por cidade (se houver mais de uma) e por região (zonas da capital).
  // Sem zona = vale para a cidade toda: aparece em qualquer região daquela cidade.
  const redeCidades = [...new Set(rede.map(a => a.cidade).filter(Boolean))];
  const redeZonas = Object.keys(ZONA).filter(z => rede.some(a => (a.zonas || []).includes(z)));
  const filtros = [...(redeCidades.length > 1 ? redeCidades.map(c => ['c', c, c]) : []), ...redeZonas.map(z => ['z', z, ZONA[z]])];
  const local = (a) => [redeCidades.length > 1 ? a.cidade : '', (a.zonas || []).map(z => ZONA[z]).filter(Boolean).join(', ')].filter(Boolean).join(' — ');
  const redeHtml = !rede.length ? '' : `
  <section><h2>🏗️ Lançamentos em parceria</h2>
    <p class="sub">Empreendimentos das construtoras parceiras da RH IMOB na região. Atendimento com ${esc(primeiro)}.</p>
    ${filtros.length ? `<div class="filtros" role="group" aria-label="Filtrar por região"><button type="button" class="on" data-f="">Todas</button>${filtros.map(f => `<button type="button" data-f="${f[0]}:${esc(f[1])}">${esc(f[2])}</button>`).join('')}</div>` : ''}
    <div class="albuns">${rede.map((a, i) => `<div class="rd" data-cidade="${esc(a.cidade || '')}" data-cs="${esc(a.cidade_slug || '')}" data-zonas="${esc((a.zonas || []).join(' '))}">${cardAlbum(a, { ...fichasRede[i], local: local(a) }, albuns.length + i)}</div>`).join('')}</div>
    <div class="vazio" id="rdVazio" style="display:none">Nenhum lançamento nesta região por enquanto.</div>
  </section>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
${prev ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${esc(url)}">`}
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">` : ''}
<meta name="theme-color" content="#2b124d">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${ldHtml}
<style>
  :root{--roxo:#2b124d;--roxo2:#5b21b6;--lilas:#f4eefb;--laranja:#f97316;--txt:#1f1530;--muted:#6b5e7e;--line:#e9e1f3;--bg:#fbf9fd}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--txt);background:var(--bg);line-height:1.55}
  a{color:inherit}
  .prev{background:#fff7e6;color:#7a4b00;border-bottom:1px solid #f3d9a4;padding:10px 16px;font-size:13px;text-align:center}
  .prev b{color:#5c3700}
  header.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:#fff;border-bottom:1px solid var(--line)}
  .marca{display:flex;align-items:center;gap:10px;text-decoration:none}
  .marca img{width:34px;height:34px;border-radius:50%}
  .marca span{font-size:12px;color:var(--muted);line-height:1.2}
  .marca strong{display:block;color:var(--roxo);font-size:14px}
  .selo{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--roxo2);background:var(--lilas);border-radius:999px;padding:6px 10px;white-space:nowrap}
  .capa{position:relative;height:260px;background:linear-gradient(135deg,#2b124d,#6d28d9 60%,#f97316);overflow:hidden}
  .capa img{width:100%;height:100%;object-fit:cover;display:block}
  .capa::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,8,38,0) 40%,rgba(20,8,38,.55))}
  @media(min-width:760px){.capa{height:340px}}
  /* Banner padrão (sem capa própria): marca, nome, profissão e região, sempre legível */
  .capa.padrao{background:radial-gradient(120% 140% at 100% 0%,#f97316 0%,rgba(249,115,22,0) 45%),linear-gradient(135deg,#1c0a36 0%,#3b1872 55%,#6d28d9 100%)}
  .capa.padrao::before{content:"";position:absolute;right:-60px;top:-60px;width:260px;height:260px;border-radius:50%;border:40px solid rgba(255,255,255,.06)}
  .capa.padrao::after{background:none}
  .banner{position:absolute;left:0;right:0;top:0;bottom:64px;display:flex;flex-direction:column;justify-content:center;padding:0 22px;max-width:960px;margin:0 auto;color:#fff;z-index:1}
  .banner small{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fed7aa}
  .banner strong{display:block;font-size:26px;line-height:1.15;margin:6px 0 4px;text-shadow:0 2px 12px rgba(0,0,0,.25)}
  .banner span{font-size:14px;color:#e9ddff}
  @media(min-width:760px){.banner strong{font-size:38px}.banner span{font-size:16px}}
  .atua{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .atua b{font-size:12px;font-weight:700;background:var(--lilas);color:var(--roxo2);border-radius:999px;padding:4px 10px}
  .vaga{background:#fff;border:1px solid #f3d9a4;border-left:4px solid var(--laranja);border-radius:16px;padding:18px}
  .vaga-num{display:inline-block;background:#fff4e6;color:#9a4a00;font-weight:800;font-size:13px;border-radius:999px;padding:4px 12px;margin-bottom:10px}
  .vaga dl{margin:0 0 12px;display:grid;grid-template-columns:110px 1fr;gap:6px 12px;font-size:14px}
  .vaga dt{font-weight:700;color:var(--roxo)}
  .vaga dd{margin:0;color:#3a2d4d}
  @media(max-width:480px){.vaga dl{grid-template-columns:1fr}.vaga dd{margin-bottom:4px}}
  .vaga p{margin:0 0 12px;color:#3a2d4d;white-space:pre-line}
  .perfil{max-width:960px;margin:-64px auto 0;padding:0 18px;position:relative;z-index:1}
  .cartao{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 18px 40px -24px rgba(43,18,77,.35);display:flex;gap:18px;align-items:center;flex-wrap:wrap}
  .avatar{width:96px;height:96px;border-radius:50%;flex-shrink:0;border:4px solid #fff;box-shadow:0 6px 16px rgba(43,18,77,.25);background:var(--roxo2);color:#fff;display:grid;place-items:center;font-size:30px;font-weight:800;overflow:hidden;margin-top:-52px}
  .avatar img{width:100%;height:100%;object-fit:cover}
  .quem{flex:1;min-width:200px}
  .quem h1{margin:0;font-size:24px;line-height:1.2;color:var(--roxo)}
  .quem p{margin:4px 0 0;color:var(--muted);font-size:14px}
  .acoes{display:flex;gap:10px;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;gap:8px;border-radius:12px;padding:12px 18px;font-weight:800;font-size:15px;text-decoration:none;border:0;cursor:pointer}
  .btn svg{width:18px;height:18px}
  .btn-wa{background:#16a34a;color:#fff}
  .btn-wa:hover{background:#15803d}
  .btn-sec{background:var(--lilas);color:var(--roxo2)}
  main{max-width:960px;margin:0 auto;padding:8px 18px 40px}
  section{margin-top:28px}
  h2{font-size:18px;color:var(--roxo);margin:0 0 12px}
  .bio{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;white-space:pre-line;color:#3a2d4d}
  .albuns{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
  .album{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;cursor:pointer;padding:0;text-align:left;font:inherit;color:inherit}
  .album:hover{box-shadow:0 12px 28px -18px rgba(43,18,77,.45)}
  .album .img{aspect-ratio:4/3;background:var(--lilas);overflow:hidden}
  .album img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
  .album:hover img{transform:scale(1.04)}
  .album .info{padding:10px 12px}
  .album strong{display:block;font-size:14px}
  .album small{color:var(--muted);font-size:12px}
  .vazio{background:#fff;border:1px dashed var(--line);border-radius:16px;padding:22px;text-align:center;color:var(--muted)}
  footer{border-top:1px solid var(--line);background:#fff;padding:22px 18px;text-align:center}
  .redes{display:flex;gap:10px;justify-content:center;margin-bottom:14px}
  .redes a{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--lilas);color:var(--roxo2)}
  .redes a:hover{background:var(--roxo2);color:#fff}
  .redes svg{width:19px;height:19px}
  footer p{margin:0;font-size:12px;color:var(--muted)}
  .parceria{max-width:520px;margin:0 auto 16px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:var(--bg);display:flex;flex-direction:column;align-items:center;gap:6px}
  .parceria strong{color:var(--roxo);font-size:14px}
  .parceria span{font-size:13px;color:var(--muted)}
  .parceria .btn{padding:9px 14px;font-size:14px;margin-top:4px}
  footer p a{color:var(--roxo2);font-weight:700;text-decoration:none}
  .fixo{position:fixed;right:16px;bottom:16px;z-index:5;box-shadow:0 12px 28px -8px rgba(22,163,74,.6);border-radius:999px}
  @media(min-width:760px){.fixo{display:none}}
  .lb{position:fixed;inset:0;background:rgba(14,6,26,.94);display:none;flex-direction:column;z-index:20}
  .lb.aberto{display:flex}
  .lb-top{display:flex;justify-content:space-between;align-items:center;color:#fff;padding:12px 16px;font-size:14px}
  .lb-top button{background:none;border:0;color:#fff;font-size:28px;cursor:pointer;line-height:1}
  .lb-img{flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-height:0;padding:0 8px}
  .lb-img img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
  .lb-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.14);border:0;color:#fff;width:44px;height:44px;border-radius:50%;font-size:22px;cursor:pointer}
  .lb-nav.ant{left:10px}.lb-nav.prox{right:10px}
  .lb-thumbs{display:flex;gap:6px;overflow-x:auto;padding:10px 12px 14px}
  .lb-thumbs img{width:64px;height:48px;object-fit:cover;border-radius:6px;opacity:.55;cursor:pointer;flex-shrink:0}
  .lb-thumbs img.on{opacity:1;outline:2px solid #fff}
  .album .img{position:relative}
  .album .fin{position:absolute;left:10px;top:10px;background:var(--roxo);color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:4px 10px}
  .album .preco{display:block;font-size:17px;font-weight:800;color:var(--roxo2);margin-bottom:2px}
  .album .specs{display:block;font-size:12.5px;color:#3a2d4d;margin:2px 0}
  .lb-leg{color:#fff;text-align:center;font-size:14px;padding:6px 16px 0}
  .lb-info{max-height:34vh;overflow:auto;padding:8px 16px 0;color:#fff;max-width:760px;width:100%;margin:0 auto}
  .lb-info .btn{width:100%;justify-content:center;margin:8px 0 2px}
  .lb-ficha .tags{display:flex;gap:6px;margin-bottom:6px}
  .lb-ficha .tags b{font-size:11px;background:rgba(255,255,255,.16);border-radius:999px;padding:3px 9px}
  .lb-ficha .p{font-size:20px;font-weight:800}
  .lb-ficha .s{font-size:13px;opacity:.9;margin-top:2px}
  .sub{margin:-6px 0 12px;font-size:13px;color:var(--muted)}
  .filtros{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px;margin:0 -18px;padding-left:18px;padding-right:18px;scrollbar-width:none}
  .filtros::-webkit-scrollbar{display:none}
  .filtros button{flex-shrink:0;border:1px solid var(--line);background:#fff;color:var(--roxo2);font:inherit;font-size:13px;font-weight:700;border-radius:999px;padding:8px 14px;cursor:pointer}
  .filtros button.on{background:var(--roxo2);border-color:var(--roxo2);color:#fff}
  .rd{display:contents}
  .rd.fora{display:none}
  .lb-ficha .d{font-size:13px;opacity:.85;margin-top:6px;white-space:pre-line}
</style>
</head>
<body>
${prev ? `<div class="prev">👀 <b>Prévia do seu site</b> — ainda não está público. Só quem tem este link vê. Publique pelo seu painel.</div>` : ''}
<header class="top">
  <a class="marca" href="${BASE}/" target="_blank" rel="noopener">
    <img src="/assets/rhimob-logo.jpg" alt="RH IMOB">
    <span><strong>RH IMOB</strong>Parceria com profissionais</span>
  </a>
  <span class="selo">Profissional parceiro</span>
</header>

${capa ? `<div class="capa"><img src="${esc(capa)}" alt=""></div>`
  : `<div class="capa padrao"><div class="banner"><small>${esc(prof.t)} · ${esc(s.cidade)}</small><strong>${esc(s.nome)}</strong>${atuaEm ? `<span>${esc(atuaEm)}</span>` : '<span>Atendimento pelo WhatsApp</span>'}</div></div>`}

<div class="perfil">
  <div class="cartao">
    <div class="avatar">${foto ? `<img src="${esc(foto)}" alt="${esc(s.nome)}">` : esc(iniciais)}</div>
    <div class="quem">
      <h1>${esc(s.nome)}</h1>
      <p>${esc(prof.t)} · ${esc(s.cidade)}${s.creci ? ` · ${esc(prof.reg)} ${esc(s.creci)}` : ''}</p>
      ${zonas.length || bairros.length || todasRegioes ? `<div class="atua">${todasRegioes ? '<b>Todas as regiões</b>' : ''}${zonas.map(z => `<b>${esc(z)}</b>`).join('')}${bairros.map(b => `<b>${esc(b)}</b>`).join('')}</div>` : ''}
    </div>
    <div class="acoes">
      ${wa ? `<a class="btn btn-wa" data-onde="PERFIL" href="${esc(wa)}" target="_blank" rel="noopener">${ICON.wa} Falar no WhatsApp</a>` : ''}
      ${urlOk(s.instagram) ? `<a class="btn btn-sec" href="${esc(s.instagram)}" target="_blank" rel="noopener">${ICON.ig} Instagram</a>` : ''}
    </div>
  </div>
</div>

<main>
  ${s.bio ? `<section><h2>Sobre</h2><div class="bio">${esc(s.bio)}</div></section>` : ''}
  ${ondeHtml}
  ${vagaHtml}
  <section>
    <h2>Imóveis</h2>
    ${albuns.length ? `<div class="albuns">${albuns.map((a, i) => cardAlbum(a, fichas[i], i)).join('')}</div>`
      : rede.length ? `<div class="vazio">Veja abaixo os lançamentos em parceria${wa ? ` ou <a href="${esc(wa)}" target="_blank" rel="noopener"><b>fale pelo WhatsApp</b></a>` : ''}.</div>`
      : `<div class="vazio">Em breve, os imóveis de ${esc(primeiro)} aparecem aqui.${wa ? ` Enquanto isso, <a href="${esc(wa)}" target="_blank" rel="noopener"><b>fale pelo WhatsApp</b></a>.` : ''}</div>`}
  </section>
  ${redeHtml}
</main>

<footer>
  ${redes.length ? `<div class="redes">${redes.map(r => `<a href="${esc(r[1])}" target="_blank" rel="noopener" aria-label="${r[2]}">${ICON[r[0]]}</a>`).join('')}</div>` : ''}
  <div class="parceria">
    <strong>É corretor? Tenha o seu site grátis</strong>
    <span>Seja parceiro da RH IMOB: estratégias digitais e ferramentas para o corretor vender mais.</span>
    <a class="btn btn-sec" href="${esc(waParceria)}" target="_blank" rel="noopener">${ICON.wa} Quero meu site grátis</a>
  </div>
  <p>Site em parceria com a <a href="${BASE}/" target="_blank" rel="noopener">RH IMOB</a> · tecnologia para conectar profissionais do mercado imobiliário</p>
</footer>

${wa ? `<a class="btn btn-wa fixo" data-onde="PERFIL" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">${ICON.wa} WhatsApp</a>` : ''}

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Fotos do imóvel">
  <div class="lb-top"><span id="lbTitulo"></span><button type="button" id="lbFechar" aria-label="Fechar">×</button></div>
  <div class="lb-img"><button class="lb-nav ant" type="button" id="lbAnt" aria-label="Anterior">‹</button><img id="lbFoto" alt=""><button class="lb-nav prox" type="button" id="lbProx" aria-label="Próxima">›</button></div>
  <div class="lb-leg" id="lbLeg"></div>
  <div class="lb-info" id="lbInfo"></div>
  <div class="lb-thumbs" id="lbThumbs"></div>
</div>
<script>
(function(){
  var A = ${dadosAlbuns}, lb = document.getElementById('lb'), foto = document.getElementById('lbFoto'),
      thumbs = document.getElementById('lbThumbs'), tit = document.getElementById('lbTitulo'), al = null, i = 0, x0 = null,
      leg = document.getElementById('lbLeg'), info = document.getElementById('lbInfo');
  function txt(s){ var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function mostra(n){ if(!al) return; i = (n + al.f.length) % al.f.length; foto.src = al.f[i];
    tit.textContent = (al.t || 'Imóvel') + ' · ' + (i + 1) + '/' + al.f.length;
    leg.textContent = al.l[i] || ''; leg.style.display = al.l[i] ? '' : 'none';
    [].forEach.call(thumbs.children, function(t, k){ t.className = k === i ? 'on' : ''; }); }
  function abre(n){ al = A[n]; if(!al) return; thumbs.innerHTML = '';
    var tags = [al.co, al.fin, al.tipo].filter(Boolean).map(function(t){ return '<b>' + txt(t) + '</b>'; }).join('');
    info.innerHTML = (al.preco || al.specs || al.desc || tags ? '<div class="lb-ficha">' + (tags ? '<div class="tags">' + tags + '</div>' : '') +
      (al.preco ? '<div class="p">' + txt(al.preco) + '</div>' : '') + (al.specs ? '<div class="s">' + txt(al.specs) + '</div>' : '') +
      (al.desc ? '<div class="d">' + txt(al.desc) + '</div>' : '') + '</div>' : '') +
      (al.wa ? '<a class="btn btn-wa" target="_blank" rel="noopener" data-onde="' + al.onde + '"' + (al.rid ? ' data-rede="' + al.rid + '"' : '') + ' data-titulo="' + txt(al.t) + '" href="' + al.wa + '">Tenho interesse neste imóvel</a>' : '');
    al.f.forEach(function(u, k){ var t = document.createElement('img'); t.src = u; t.alt = ''; t.loading = 'lazy'; t.onclick = function(){ mostra(k); }; thumbs.appendChild(t); });
    lb.classList.add('aberto'); document.body.style.overflow = 'hidden'; mostra(0); }
  function fecha(){ lb.classList.remove('aberto'); document.body.style.overflow = ''; }
  document.querySelectorAll('[data-album]').forEach(function(b){ b.onclick = function(){ abre(+b.getAttribute('data-album')); }; });
  document.getElementById('lbFechar').onclick = fecha;
  document.getElementById('lbAnt').onclick = function(){ mostra(i - 1); };
  document.getElementById('lbProx').onclick = function(){ mostra(i + 1); };
  document.addEventListener('keydown', function(e){ if(!lb.classList.contains('aberto')) return;
    if(e.key === 'Escape') fecha(); if(e.key === 'ArrowLeft') mostra(i - 1); if(e.key === 'ArrowRight') mostra(i + 1); });
  // Filtro dos lançamentos: cidade (c:) ou região (z:). Sem zona = cidade toda (aparece em qualquer região da capital).
  var fb = document.querySelectorAll('.filtros [data-f]');
  [].forEach.call(fb, function(b){ b.onclick = function(){
    [].forEach.call(fb, function(x){ x.classList.toggle('on', x === b); });
    var f = b.getAttribute('data-f'), k = f.charAt(0), v = f.slice(2), n = 0;
    [].forEach.call(document.querySelectorAll('.rd'), function(el){
      var zs = el.getAttribute('data-zonas').split(' ').filter(Boolean);
      var ok = !f || (k === 'c' ? el.getAttribute('data-cidade') === v : (zs.indexOf(v) >= 0 || (!zs.length && el.getAttribute('data-cs') === 'sao-paulo')));
      el.classList.toggle('fora', !ok); if (ok) n++;
    });
    document.getElementById('rdVazio').style.display = n ? 'none' : '';
  }; });
  // Cada clique no WhatsApp: conta no admin e aparece no /painel → Leads (/api/site-clique).
  var sid = ''; try { sid = sessionStorage.getItem('rh_sid') || Math.random().toString(36).slice(2, 12); sessionStorage.setItem('rh_sid', sid); } catch (e) {}
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[data-onde]'); if(!a) return;
    try { fetch('/api/site-clique', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: ${JSON.stringify(s.cidade_slug || '')}, n: ${JSON.stringify(s.nome_slug || '')}, onde: a.getAttribute('data-onde'),
        rede: a.getAttribute('data-rede') || null, titulo: a.getAttribute('data-titulo') || '', sid: sid, pagina: location.href.split('?')[0] }) }).catch(function(){}); } catch (e) {}
  });
  foto.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; }, { passive: true });
  foto.addEventListener('touchend', function(e){ if(x0 === null) return; var d = e.changedTouches[0].clientX - x0; if(Math.abs(d) > 40) mostra(i + (d < 0 ? 1 : -1)); x0 = null; });
})();
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const cidade = String(req.query.cidade || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const nome = String(req.query.nome || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const t = String(req.query.t || '').replace(/[^a-f0-9]/g, '').slice(0, 64) || null;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!cidade || !nome) { res.status(404).send(naoEncontrado()); return; }

  let s = null;
  try {
    const r = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_site_publico`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_cidade: cidade, p_nome: nome, p_token_edicao: t })
    });
    const d = await r.json();
    if (d && d.ok && d.site) s = d.site;
  } catch (_) {}

  if (!s) { res.setHeader('Cache-Control', 'no-store'); res.status(404).send(naoEncontrado()); return; }
  const prev = s.status !== 'PUBLICADO';
  res.setHeader('Cache-Control', prev ? 'no-store' : 's-maxage=60, stale-while-revalidate=300');
  if (prev) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(200).send(render(s, prev, `${BASE}/corretor/${s.cidade_slug}/${s.nome_slug}`));
}
