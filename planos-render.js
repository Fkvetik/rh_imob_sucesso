// Renderiza os planos dinâmicos (2 modos) nas páginas públicas, a partir de
// /api/planos-publicos. Preço e descrição vêm do painel admin (aba Contas →
// Planos). As features de cada modo são fixas aqui (descrevem o modelo).
// Reutilizado por novos-talentos.html, corretores.html e plataformas.html.
// O container deve ter: id="planosGrid", data-produto="...", data-prefix="plan"|"plano".
(function () {
  var WHATS = '5511953973268';

  var MODOS = {
    CLIENTE_PROPRIO: {
      rotulo: 'Já assino a Catho',
      destaque: false,
      features: [
        'Integração com o seu login Catho',
        'Automação de triagem, filtro e abordagem',
        'Filtros por cidade, bairro, perfil e metrô',
        'Funil de abordagens + mensagens prontas',
        'Volume conforme a sua conta Catho'
      ]
    },
    RHIMOB_FORNECE: {
      rotulo: 'Não tenho Catho',
      destaque: true,
      badge: 'Mais completo',
      features: [
        'Acesso à base sem você assinar a Catho',
        'Automação de triagem, filtro e abordagem',
        'Filtros por cidade, bairro, perfil e metrô',
        'Funil de abordagens + mensagens prontas',
        'Relatórios e gestão de operadores'
      ]
    }
  };

  var ORDEM = ['CLIENTE_PROPRIO', 'RHIMOB_FORNECE'];

  function money(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    if (!isFinite(n)) return null;
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function waLink(msg) {
    return 'https://api.whatsapp.com/send?phone=' + WHATS + '&text=' + encodeURIComponent(msg);
  }

  function cardHTML(p, cfg, px, produto, popularClass) {
    var preco = money(p.preco_mensal);
    var precoHTML = preco
      ? '<div class="' + px + '-price"><strong>R$&nbsp;' + preco + '</strong><span>/mês</span></div>'
      : '<div class="' + px + '-price"><strong>Sob consulta</strong></div>';
    var msg = 'Olá, Mariana. Tenho interesse no plano ' + (p.nome_comercial || cfg.rotulo) +
      ' (' + produto + ')' + (preco ? ' — R$ ' + preco + '/mês' : '') + '. Pode me dar mais detalhes?';
    var btnClass = cfg.destaque ? px + '-btn--primary' : px + '-btn--outline';
    var feats = cfg.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
    return '<div class="' + px + '-card' + (cfg.destaque ? ' ' + popularClass : '') + '">' +
      (cfg.destaque && cfg.badge ? '<span class="' + px + '-badge">' + esc(cfg.badge) + '</span>' : '') +
      '<span class="' + px + '-name">' + esc(cfg.rotulo) + '</span>' +
      precoHTML +
      '<p class="' + px + '-desc">' + esc(p.descricao_comercial || '') + '</p>' +
      '<ul class="' + px + '-features">' + feats + '</ul>' +
      '<a class="' + px + '-btn ' + btnClass + '" href="' + waLink(msg) + '" target="_blank" rel="noopener">Assinar →</a>' +
      '</div>';
  }

  function fallback(grid, px, produto) {
    var msg = 'Olá, Mariana. Tenho interesse na ' + produto + ' e quero conhecer os planos disponíveis. Pode me ajudar?';
    grid.innerHTML =
      '<div class="' + px + '-card">' +
      '<span class="' + px + '-name">Planos</span>' +
      '<p class="' + px + '-desc">Fale com a Mariana pelo WhatsApp para ver os planos e valores atualizados.</p>' +
      '<a class="' + px + '-btn ' + px + '-btn--primary" href="' + waLink(msg) + '" target="_blank" rel="noopener">Falar com a Mariana →</a>' +
      '</div>';
  }

  function render(grid, planos) {
    var px = grid.getAttribute('data-prefix') || 'plan';
    var produto = grid.getAttribute('data-produto') || 'Plataforma RH IMOB';
    var popularClass = px + '-card--popular';
    var porModo = {};
    (planos || []).forEach(function (p) { if (p.modo_integracao) porModo[p.modo_integracao] = p; });

    var cards = ORDEM
      .filter(function (m) { return porModo[m] && MODOS[m]; })
      .map(function (m) { return cardHTML(porModo[m], MODOS[m], px, produto, popularClass); });

    if (!cards.length) { fallback(grid, px, produto); return; }
    grid.innerHTML = cards.join('');
  }

  function init() {
    var grid = document.getElementById('planosGrid');
    if (!grid) return;
    var px = grid.getAttribute('data-prefix') || 'plan';
    var produto = grid.getAttribute('data-produto') || 'Plataforma RH IMOB';
    fetch('/api/planos-publicos')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && Array.isArray(j.planos) && j.planos.length) render(grid, j.planos);
        else fallback(grid, px, produto);
      })
      .catch(function () { fallback(grid, px, produto); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
