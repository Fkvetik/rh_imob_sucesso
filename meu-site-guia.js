/* Guia do "Meu site": conduz o profissional passo a passo na montagem do site.
 * Abre sozinho na primeira visita (por link de edição); depois fica no botão ❓
 * do canto da tela. Ao fechar o guia, o botão pisca para mostrar onde ele fica.
 * Cada passo rola até a parte certa da página e destaca o que usar. */
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var T = new URLSearchParams(location.search).get('t') || '';
  var CHAVE = 'msGuiaVisto_' + T.slice(0, 16);
  var lerVisto = function(){ try { return localStorage.getItem(CHAVE); } catch (_) { return '1'; } };
  var marcarVisto = function(){ try { localStorage.setItem(CHAVE, String(Date.now())); } catch (_) {} };
  var cardDe = function(id){ var el = $(id); return el ? (el.closest('.card') || el) : null; };

  var PASSOS = [
    { titulo: function(n){ return 'Olá' + (n ? ', ' + n : '') + '! Vamos montar o seu site 👋'; },
      texto: 'Em poucos minutos, pelo celular mesmo, o seu site fica pronto para mandar aos clientes. Eu te mostro cada parte. Vamos começar?',
      inicio: true },
    { titulo: 'Passo 1 · Seus dados', alvo: function(){ return cardDe('fNome'); },
      texto: 'Confira o seu <b>nome</b> e o <b>WhatsApp</b>: é o número que o botão do site chama. Em <b>Sobre você</b>, conte há quanto tempo atua e com que tipo de imóvel trabalha.' },
    { titulo: 'Passo 2 · Sua atuação', alvo: function(){ return cardDe('fProf'); },
      texto: 'Marque a sua <b>região</b> e escreva os <b>bairros</b> em que atua, separados por vírgula. É isso que ajuda os clientes da sua região a te encontrar no Google.' },
    { titulo: 'Passo 3 · Sua localização', alvo: function(){ return $('cardGeo'); },
      texto: 'Toque em <b>📍 Usar minha localização</b> (ou digite o CEP). Assim você aparece no mapa <b>Perto de mim</b>, onde imobiliárias e construtoras procuram profissionais da região. O CEP não aparece no site.' },
    { titulo: 'Passo 4 · Sua foto e a capa', alvo: function(){ return cardDe('btnFoto'); },
      texto: 'Toque em <b>📷 Colocar sua foto</b>. A <b>capa</b> é opcional: sem ela, o site usa o banner da parceria com o seu nome.' },
    { titulo: 'Passo 5 · Seus imóveis', alvo: function(){ return cardDe('albuns'); },
      texto: 'Toque em <b>➕ Novo imóvel</b> para cada imóvel: dê um nome, preencha a ficha (preço, bairro, quartos…) e coloque as fotos. A primeira foto é a capa. Tudo é opcional.' },
    { titulo: 'Passo 6 · Redes sociais', alvo: function(){ return cardDe('fIg'); },
      texto: 'Cole o seu <b>@ do Instagram</b> e os links das outras redes. As que você preencher aparecem no rodapé do site.' },
    { titulo: 'Passo 7 · Salve', alvo: function(){ return $('btnSalvar'); },
      texto: 'Toque em <b>💾 Salvar alterações</b> sempre que mudar alguma coisa.' },
    { titulo: 'Passo 8 · Publique', alvo: function(){ return $('btnPublicar') || $('btnCopiar'); },
      texto: function(){ return $('btnPublicar')
        ? 'Quando estiver do seu jeito, toque em <b>🚀 Publicar meu site</b>. Antes disso, só você vê a página. Use <b>👀 Ver meu site</b> para conferir como ficou.'
        : 'O seu site já está no ar. Toque em <b>🔗 Copiar link</b> e coloque na bio do Instagram e no seu WhatsApp.'; } },
    { titulo: 'Pronto! 🎉',
      texto: 'Depois de publicar, coloque o link na <b>bio do Instagram</b> e mande para os seus clientes. Imóvel novo? É só criar mais um álbum. Precisando, o guia fica no botão <b>❓</b> do canto da tela.',
      fim: true }
  ];

  var css = document.createElement('style');
  css.textContent =
    '#msGuiaBtn{position:fixed;right:14px;bottom:78px;z-index:20;width:46px;height:46px;border-radius:50%;border:0;background:#5b21b6;color:#fff;font-size:20px;font-weight:800;box-shadow:0 6px 18px rgba(43,18,77,.35);cursor:pointer}' +
    '#msGuiaBtn.pisca{animation:msPisca .9s ease-in-out 4}' +
    '@keyframes msPisca{0%,100%{transform:scale(1);box-shadow:0 6px 18px rgba(43,18,77,.35)}50%{transform:scale(1.18);box-shadow:0 0 0 10px rgba(249,115,22,.35)}}' +
    '#msGuiaDica{position:fixed;right:68px;bottom:86px;z-index:20;background:#1f1530;color:#fff;font-size:12.5px;padding:7px 11px;border-radius:10px;opacity:0;transition:opacity .3s;pointer-events:none}' +
    '#msGuiaDica.on{opacity:1}' +
    '#msGuia{position:fixed;left:10px;right:10px;bottom:74px;z-index:21;max-width:560px;margin:0 auto;background:#fff;border:2px solid #5b21b6;border-radius:16px;box-shadow:0 10px 30px rgba(43,18,77,.3);padding:14px 16px;font-size:14px;line-height:1.5;max-height:52vh;overflow-y:auto}' +
    '#msGuia .t{display:flex;justify-content:space-between;gap:8px;font-weight:800;color:#5b21b6;font-size:15px;margin-bottom:4px}' +
    '#msGuia .x{border:0;background:none;color:#6b5e7e;font-size:18px;cursor:pointer;padding:0 2px}' +
    '#msGuia .pts{display:flex;gap:4px;margin:10px 0 2px}#msGuia .pts i{flex:1;height:4px;border-radius:9px;background:#ece4f6}#msGuia .pts i.on{background:#f97316}' +
    '#msGuia .bts{display:flex;gap:8px;margin-top:10px}#msGuia .bts .btn{flex:1}' +
    '.ms-alvo{outline:3px solid #f97316!important;outline-offset:3px;border-radius:14px;animation:msAlvo 1.2s ease-in-out infinite}' +
    '@keyframes msAlvo{50%{outline-color:rgba(249,115,22,.3)}}';
  document.head.appendChild(css);

  var lista = [], i = 0;
  var nome = function(){ var f = $('fNome'); return f ? String(f.value || '').trim().split(' ')[0] : ''; };
  var limparAlvo = function(){ document.querySelectorAll('.ms-alvo').forEach(function(e){ e.classList.remove('ms-alvo'); }); };

  function mostrar(){
    var p = lista[i], box = $('msGuia');
    limparAlvo();
    var el = p.alvo && p.alvo();
    if (el){
      el.classList.add('ms-alvo');
      // rola até a parte, deixando espaço em cima (o guia fica embaixo)
      var y = el.getBoundingClientRect().top + window.pageYOffset - 16;
      if (el.id === 'btnSalvar') y = window.pageYOffset; // a barra de salvar já está fixa na tela
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    } else if (p.inicio || p.fim) window.scrollTo({ top: 0, behavior: 'smooth' });
    var tit = typeof p.titulo === 'function' ? p.titulo(nome()) : p.titulo;
    var txt = typeof p.texto === 'function' ? p.texto() : p.texto;
    box.innerHTML =
      '<div class="t"><span>' + tit + '</span><button class="x" type="button" id="msGuiaX" aria-label="Fechar o guia">✕</button></div>' +
      '<div>' + txt + '</div>' +
      '<div class="pts">' + lista.map(function(_, k){ return '<i class="' + (k <= i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="bts">' +
        (p.inicio ? '<button class="btn btn-ghost" type="button" id="msGuiaPular">Agora não</button><button class="btn btn-prim" type="button" id="msGuiaProx">Vamos começar</button>'
         : p.fim ? '<button class="btn btn-prim" type="button" id="msGuiaProx">Concluir</button>'
         : '<button class="btn btn-ghost" type="button" id="msGuiaVolta">‹ Voltar</button><button class="btn btn-prim" type="button" id="msGuiaProx">Próximo ›</button>') +
      '</div>';
    $('msGuiaX').onclick = fechar;
    if ($('msGuiaPular')) $('msGuiaPular').onclick = fechar;
    if ($('msGuiaVolta')) $('msGuiaVolta').onclick = function(){ if (i > 0){ i--; mostrar(); } };
    $('msGuiaProx').onclick = function(){ if (p.fim) return fechar(); i++; mostrar(); };
  }

  function abrir(){
    // passos de partes que não existem nesta página (ex.: banco sem localização) ficam de fora
    lista = PASSOS.filter(function(p){ return !p.alvo || p.alvo(); });
    i = 0;
    var box = $('msGuia');
    if (!box){ box = document.createElement('div'); box.id = 'msGuia'; document.body.appendChild(box); }
    $('msGuiaBtn').style.display = 'none';
    mostrar();
  }

  function fechar(){
    limparAlvo();
    var box = $('msGuia'); if (box) box.remove();
    marcarVisto();
    // mostra onde o guia fica: o botão volta piscando, com um aviso ao lado
    var b = $('msGuiaBtn'), d = $('msGuiaDica');
    b.style.display = '';
    b.classList.remove('pisca'); void b.offsetWidth; b.classList.add('pisca');
    d.classList.add('on');
    setTimeout(function(){ d.classList.remove('on'); }, 4000);
  }

  function preparar(){
    if ($('msGuiaBtn')) return;
    var b = document.createElement('button');
    b.id = 'msGuiaBtn'; b.type = 'button'; b.title = 'Guia: como montar o seu site'; b.textContent = '?';
    b.setAttribute('aria-label', 'Abrir o guia de como montar o site');
    b.onclick = abrir;
    document.body.appendChild(b);
    var d = document.createElement('div');
    d.id = 'msGuiaDica'; d.textContent = 'O guia fica aqui, se precisar 👉';
    document.body.appendChild(d);
    if (!lerVisto()) setTimeout(abrir, 600);
    // a página se redesenha quando chegam a localização e o material: refaz o destaque
    new MutationObserver(function(){
      if (!$('msGuia') || !lista[i] || !lista[i].alvo || document.querySelector('.ms-alvo')) return;
      var el = lista[i].alvo(); if (el) el.classList.add('ms-alvo');
    }).observe($('app'), { childList: true });
  }

  // A página monta o formulário depois de carregar os dados: espera o primeiro campo aparecer.
  var app = $('app');
  if (!app || !T) return;
  if ($('fNome')) return preparar();
  var obs = new MutationObserver(function(){ if ($('fNome')){ obs.disconnect(); preparar(); } });
  obs.observe(app, { childList: true, subtree: true });
})();
