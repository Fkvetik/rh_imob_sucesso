// RH IMOB · Leilões — sinalização de encerramento (sem remover páginas do ar)
// Cada card/página traz data-encerramento="AAAA-MM-DD". Quando essa data passa,
// a página NUNCA sai do ar: só troca o CTA de "tenho interesse" por um aviso de
// encerrado + a lista das outras oportunidades que ainda estão em aberto. Na
// listagem (/leiloes), o card encerrado ganha um selo e vai para o fim da lista,
// mas continua visível — nada é escondido/removido, só reordenado e sinalizado.
(function () {
  function passouDoPrazo(dataStr) {
    if (!dataStr) return false;
    var limite = new Date(dataStr + 'T23:59:59');
    return !isNaN(limite) && new Date() > limite;
  }
  function fmtDataBr(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── Listagem (/leiloes): sinaliza encerrado, não esconde ──────────────────
  function initListagem() {
    var grid = document.querySelector('.lj-grid');
    var cards = document.querySelectorAll('.lj-card[data-encerramento]');
    if (!cards.length) return;

    var ativos = [], encerrados = [];
    cards.forEach(function (card) {
      if (passouDoPrazo(card.dataset.encerramento)) {
        if (!card.querySelector('.lj-selo-encerrado')) {
          var selo = document.createElement('div');
          selo.className = 'lj-selo-encerrado';
          selo.textContent = 'ENCERRADO';
          selo.setAttribute('style', 'position:absolute;top:12px;right:12px;background:#991b1b;color:#fff;font-size:10px;font-weight:900;letter-spacing:.05em;padding:4px 10px;border-radius:20px;z-index:2;');
          if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
          card.insertBefore(selo, card.firstChild);
        }
        card.style.opacity = '.6';
        encerrados.push(card);
      } else {
        ativos.push(card);
      }
    });
    // Reordena: ativos primeiro, encerrados no fim — sem remover nenhum do DOM
    if (grid && encerrados.length) {
      encerrados.forEach(function (card) { grid.appendChild(card); });
    }
    var vazio = document.getElementById('lj-vazio');
    if (vazio) vazio.style.display = ativos.length ? 'none' : 'block';
  }

  // ── Página individual: mostra aviso + outras opções ativas, nunca some ────
  function initDetalhe() {
    var root = document.querySelector('[data-encerramento-pagina]');
    if (!root) return;
    if (!passouDoPrazo(root.dataset.encerramentoPagina)) return;

    document.querySelectorAll('.lj-esconder-se-encerrado').forEach(function (el) {
      el.style.display = 'none';
    });
    var aviso = document.getElementById('lj-encerrado-aviso');
    if (aviso) aviso.style.display = 'block';

    var destino = document.getElementById('lj-outras-ativas');
    if (!destino) return;
    var minhaUrl = location.pathname.replace(/\/$/, '');

    fetch('/assets/leiloes-lista.json')
      .then(function (r) { return r.json(); })
      .then(function (lista) {
        var outras = lista
          .filter(function (i) { return i.url !== minhaUrl && !passouDoPrazo(i.dataEncerramento); })
          .sort(function (a, b) { return a.dataEncerramento.localeCompare(b.dataEncerramento); })
          .slice(0, 6);
        if (!outras.length) return;

        var html = '<h3 style="font-size:17px;font-weight:900;color:var(--purple-950);margin:0 0 14px;">Outras oportunidades em aberto</h3>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">' +
          outras.map(function (i) {
            return '<a href="' + esc(i.url) + '" style="display:block;background:#faf9ff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:inherit;transition:transform .15s;">' +
              '<div style="font-size:13.5px;font-weight:800;color:var(--purple-950);line-height:1.4;margin-bottom:6px;">' + esc(i.titulo) + '</div>' +
              '<div style="font-size:12px;color:#8c809d;">Encerramento: ' + fmtDataBr(i.dataEncerramento) + (i.valor ? ' · ' + esc(i.valor) : '') + '</div>' +
              '</a>';
          }).join('') +
          '</div>';
        destino.innerHTML = html;
        destino.style.display = 'block';
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initListagem(); initDetalhe(); });
  } else {
    initListagem(); initDetalhe();
  }
})();
