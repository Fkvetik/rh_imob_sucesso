// RH IMOB · Leilões — expiração automática por data
// Cada card/página traz data-encerramento="AAAA-MM-DD". Quando essa data passa,
// o card some da listagem e a página individual troca o CTA por um aviso de
// encerrado — sem precisar de backend, só JS rodando no navegador do visitante.
(function () {
  function passouDoPrazo(dataStr) {
    if (!dataStr) return false;
    var limite = new Date(dataStr + 'T23:59:59');
    return !isNaN(limite) && new Date() > limite;
  }

  function initListagem() {
    var cards = document.querySelectorAll('.lj-card[data-encerramento]');
    if (!cards.length) return;
    var restantes = 0;
    cards.forEach(function (card) {
      if (passouDoPrazo(card.dataset.encerramento)) {
        card.style.display = 'none';
      } else {
        restantes++;
      }
    });
    var vazio = document.getElementById('lj-vazio');
    if (vazio) vazio.style.display = restantes ? 'none' : 'block';
  }

  function initDetalhe() {
    var root = document.querySelector('[data-encerramento-pagina]');
    if (!root) return;
    if (!passouDoPrazo(root.dataset.encerramentoPagina)) return;
    document.querySelectorAll('.lj-esconder-se-encerrado').forEach(function (el) {
      el.style.display = 'none';
    });
    var aviso = document.getElementById('lj-encerrado-aviso');
    if (aviso) aviso.style.display = 'block';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initListagem(); initDetalhe(); });
  } else {
    initListagem(); initDetalhe();
  }
})();
