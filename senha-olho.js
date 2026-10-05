// Olho da senha "segura e solta" + Enter para entrar — usado em todas as
// telas de login do site (e copiado para a extensão).
//
//  - Enquanto o olho está pressionado (mouse ou dedo), a senha aparece.
//    Soltou, tirou o ponteiro de cima ou saiu do campo: volta a esconder.
//    Nunca fica exposta "para sempre" como no modelo clica-e-fica.
//  - Enter no campo de senha aciona o botão de entrar, mesmo onde o campo
//    não está dentro de um <form>.
;(function () {
  if (window.__senhaOlhoAtivo) return
  window.__senhaOlhoAtivo = true

  function ehOlho(el) {
    if (!el || el.tagName !== 'BUTTON') return false
    return el.dataset.senhaOlho === '1' || /eye|togglepass|toggleadminpass/i.test(el.id + ' ' + el.className) || el.textContent.trim() === '👁'
  }

  function prepararCampo(input) {
    if (input.dataset.senhaOlhoOk) return
    input.dataset.senhaOlhoOk = '1'

    // Reaproveita o olho que a página já tem (ao lado do campo) ou cria um.
    var antigo = null
    var irmaos = input.parentElement ? input.parentElement.children : []
    for (var i = 0; i < irmaos.length; i++) if (ehOlho(irmaos[i])) { antigo = irmaos[i]; break }

    var olho
    if (antigo) {
      // Clona para descartar o comportamento antigo (clicou, ficou visível).
      olho = antigo.cloneNode(true)
      antigo.replaceWith(olho)
    } else {
      var caixa = document.createElement('div')
      caixa.style.cssText = 'position:relative;display:block;width:100%'
      input.parentNode.insertBefore(caixa, input)
      caixa.appendChild(input)
      if (!input.style.paddingRight) input.style.paddingRight = '38px'
      input.style.boxSizing = 'border-box'
      olho = document.createElement('button')
      olho.type = 'button'
      olho.textContent = '👁'
      olho.style.cssText = 'position:absolute;right:2px;top:50%;transform:translateY(-50%);height:32px;width:32px;padding:0;margin:0;background:transparent;border:none;color:#888;font-size:15px;line-height:1;cursor:pointer'
      caixa.appendChild(olho)
    }
    olho.type = 'button'
    olho.dataset.senhaOlho = '1'
    olho.title = 'Segure para ver a senha'
    olho.setAttribute('aria-label', 'Segure para ver a senha')
    olho.style.touchAction = 'none'
    olho.style.userSelect = 'none'
    olho.style.webkitUserSelect = 'none'
    input.type = 'password'

    function mostrar(e) { if (e && e.cancelable) e.preventDefault(); input.type = 'text' }
    function esconder() { input.type = 'password' }

    olho.addEventListener('pointerdown', function (e) {
      mostrar(e)
      try { olho.setPointerCapture(e.pointerId) } catch (_) {}
    })
    ;['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture', 'blur'].forEach(function (ev) {
      olho.addEventListener(ev, esconder)
    })
    // Teclado: segurar Espaço ou Enter com o foco no olho.
    olho.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') mostrar(e) })
    olho.addEventListener('keyup', esconder)
    // Na fase de captura e barrando os demais: páginas que registram o
    // "clicou, ficou visível" depois de carregar não conseguem mais agir.
    olho.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation() }, true)
    olho.addEventListener('contextmenu', function (e) { e.preventDefault() }) // toque longo no celular
    // Garantias extras: saiu da aba ou soltou o botão fora do olho.
    window.addEventListener('blur', esconder)
    document.addEventListener('visibilitychange', esconder)
    document.addEventListener('pointerup', esconder)

    // Enter no campo de senha = entrar.
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return
      if (e.defaultPrevented) return // a própria página já tratou o Enter
      if (input.form) return // formulário de verdade já envia sozinho
      var no = input.parentElement
      for (var nivel = 0; no && nivel < 5; nivel++, no = no.parentElement) {
        var botoes = no.querySelectorAll('button, input[type="submit"]')
        for (var j = 0; j < botoes.length; j++) {
          var b = botoes[j]
          if (ehOlho(b) || b.offsetParent === null) continue
          // Só vale botão que vem DEPOIS do campo na tela (o "Entrar").
          if (!(input.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
          // Desabilitado = a página já está entrando; não procura outro botão.
          if (b.disabled) return
          e.preventDefault()
          b.click()
          return
        }
      }
    })
  }

  function varrer() {
    var campos = document.querySelectorAll('input[type="password"]')
    for (var i = 0; i < campos.length; i++) prepararCampo(campos[i])
  }

  // Depois que a página terminou de carregar, para substituir os olhos antigos
  // já com os comportamentos originais registrados.
  if (document.readyState === 'complete') varrer()
  else window.addEventListener('load', varrer)
  // Campos de senha que aparecem depois (modais, formulários montados na hora).
  try {
    new MutationObserver(function () { varrer() }).observe(document.documentElement, { childList: true, subtree: true })
  } catch (_) {}
})()
