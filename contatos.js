// Contatos do site: troca os números de WhatsApp e o e-mail escritos nas
// páginas pelos que estão no admin (Administração → Contatos do site).
// Os números escritos no HTML são o reserva: se nada carregar, eles valem.
// Também cuida de links criados depois (MutationObserver) e de botões que
// abrem o WhatsApp por window.open.
(function () {
  var VAGAS = '5511953973268', EMPRESAS = '5511978725515', EMAIL = 'contato@rhimob.com.br';
  var caminho = location.pathname;
  function chave(num) {
    if (num === VAGAS) return /^\/leil/.test(caminho) ? 'wa_leiloes' : 'wa_vagas';
    return /^\/(rede-de-parceiros|como-usar-o-painel)/.test(caminho) ? 'wa_rede' : 'wa_empresas';
  }
  // 5511953973268 -> (11) 95397-3268
  function formata(n) {
    var d = String(n).replace(/^55/, '');
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
  }

  var trocas = [];
  function montar(c) {
    window.RH_CONTATOS = c;
    trocas = [];
    [VAGAS, EMPRESAS].forEach(function (n) {
      var novo = String(c[chave(n)] || '').replace(/\D/g, '');
      if (novo && novo !== n) { trocas.push([n, novo]); trocas.push([formata(n), formata(novo)]); }
    });
    if (c.email && c.email !== EMAIL) trocas.push([EMAIL, c.email]);
  }
  function troca(s) {
    for (var i = 0; i < trocas.length; i++) if (s.indexOf(trocas[i][0]) >= 0) s = s.split(trocas[i][0]).join(trocas[i][1]);
    return s;
  }
  function aplicar(raiz) {
    if (!trocas.length || !raiz) return;
    if (raiz.nodeType === 3) { var t = troca(raiz.nodeValue); if (t !== raiz.nodeValue) raiz.nodeValue = t; return; }
    if (raiz.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(raiz.nodeName)) return;
    var links = raiz.matches && raiz.matches('a[href]') ? [raiz] : [];
    links = links.concat([].slice.call(raiz.querySelectorAll('a[href]')));
    links.forEach(function (a) { var h = a.getAttribute('href'), n = troca(h); if (n !== h) a.setAttribute('href', n); });
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? 2 : 1; }
    });
    var nos = [];
    while (w.nextNode()) nos.push(w.currentNode);
    nos.forEach(function (n) { var t = troca(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; });
  }

  var abrir = window.open;
  window.open = function (u) {
    if (typeof u === 'string' && trocas.length) arguments[0] = troca(u);
    return abrir.apply(window, arguments);
  };

  function usar(c) {
    if (!c || typeof c !== 'object') return;
    montar(c);
    aplicar(document.body);
  }
  // Última versão guardada neste navegador: troca na hora, sem esperar a rede.
  try { usar(JSON.parse(localStorage.getItem('rh_contatos') || 'null')); } catch (e) {}
  fetch('/api/site-config').then(function (r) { return r.json(); }).then(function (c) {
    try { localStorage.setItem('rh_contatos', JSON.stringify(c)); } catch (e) {}
    usar(c);
  }).catch(function () {});

  if (window.MutationObserver) {
    new MutationObserver(function (lista) {
      if (!trocas.length) return;
      lista.forEach(function (m) {
        if (m.type === 'attributes') aplicar(m.target);
        else m.addedNodes.forEach(aplicar);
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }
})();
