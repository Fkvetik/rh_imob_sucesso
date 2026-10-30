// Central de avisos + aplicativo dos painéis (/meu-site e /parceiro). SQL REDE_5.
// • Sininho no topo com a bolinha de não lidos; a lista abre por cima da tela.
// • Cada aviso pode ter um botão que abre o WhatsApp de quem chamar, com a
//   mensagem já escrita (ex.: "Falar com o responsável pelo imóvel").
// • Instalar como aplicativo (Android: botão; iPhone: instrução) e ativar a
//   notificação no celular (o aparelho fica inscrito pelo token do painel).
// Uso: PainelApp.iniciar({ token, tipo: 'site' | 'parceiro', rpc })
(function(){
  // Chave pública de notificação (VAPID). A privada fica só na Vercel.
  var VAPID = 'BMhNAWQnrly9bINXw91o9dgVb223-AHFTas0NlcYDfcjiuSEE1PdiCieZ4IQANkzbv8AUCQPq3ZqGAepbGhALbU';
  var cfg = null, avisos = [], naoLidos = 0, pedidoInstalar = null;

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function el(tag, attrs, html){ var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function quando(iso){
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
    if (s < 172800) return 'ontem';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  function ehIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function instalado(){ return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function pushPossivel(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }

  var CSS =
    '.pa-sino{margin-left:auto;position:relative;background:rgba(255,255,255,.14);border:0;color:#fff;width:40px;height:40px;border-radius:50%;font-size:19px;cursor:pointer;display:grid;place-items:center}' +
    '.pa-bola{position:absolute;top:-3px;right:-3px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:#ff3b30;color:#fff;font-size:11px;font-weight:800;display:grid;place-items:center;border:2px solid #2b124d}' +
    '.pa-fundo{position:fixed;inset:0;background:rgba(20,10,35,.45);z-index:30;display:none}' +
    '.pa-gaveta{position:fixed;top:0;right:0;bottom:0;width:min(420px,100%);background:#f7f4fb;z-index:31;transform:translateX(100%);transition:transform .2s;display:flex;flex-direction:column;box-shadow:-10px 0 40px rgba(0,0,0,.2)}' +
    '.pa-aberta .pa-fundo{display:block} .pa-aberta .pa-gaveta{transform:none}' +
    '.pa-topo{background:#2b124d;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '.pa-topo b{flex:1;font-size:16px} .pa-topo button{background:rgba(255,255,255,.15);border:0;color:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-weight:700;cursor:pointer}' +
    '.pa-lista{flex:1;overflow:auto;padding:12px}' +
    '.pa-av{background:#fff;border:1px solid #e6ddf1;border-radius:14px;padding:12px 14px;margin-bottom:10px}' +
    '.pa-av.novo{border-color:#a78bfa;box-shadow:0 0 0 2px #ede5ff}' +
    '.pa-av b{display:block;font-size:14px;color:#1f1530} .pa-av p{margin:4px 0 0;font-size:13px;color:#6b5e7e;line-height:1.4}' +
    '.pa-av small{display:block;font-size:11.5px;color:#8c809d;margin-top:6px}' +
    '.pa-av a{display:inline-flex;margin-top:8px;background:#16a34a;color:#fff;text-decoration:none;font-weight:800;font-size:13px;border-radius:9px;padding:8px 12px}' +
    '.pa-vazio{text-align:center;color:#6b5e7e;font-size:14px;padding:30px 10px}' +
    '.pa-app{background:#fff;border:1px dashed #cdbbe6;border-radius:14px;padding:12px 14px;margin-bottom:12px;font-size:13px;color:#3a2d4d;line-height:1.45}' +
    '.pa-app b{color:#2b124d} .pa-app button{margin-top:8px;margin-right:6px;background:#5b21b6;color:#fff;border:0;border-radius:9px;padding:8px 12px;font:inherit;font-weight:800;font-size:13px;cursor:pointer}' +
    '.pa-ok{color:#11692f;font-weight:700}';

  function montar(){
    document.head.appendChild(el('style', {}, CSS));
    var header = document.querySelector('header');
    var sino = el('button', { type: 'button', class: 'pa-sino', 'aria-label': 'Avisos' }, '🔔<span class="pa-bola" style="display:none"></span>');
    sino.onclick = abrir;
    if (header) header.appendChild(sino);
    var fundo = el('div', { class: 'pa-fundo' }); fundo.onclick = fechar;
    var gaveta = el('div', { class: 'pa-gaveta', role: 'dialog', 'aria-label': 'Avisos' },
      '<div class="pa-topo"><b>🔔 Avisos</b><button type="button" id="paFechar">Fechar</button></div><div class="pa-lista" id="paLista"></div>');
    document.body.appendChild(fundo); document.body.appendChild(gaveta);
    document.getElementById('paFechar').onclick = fechar;
  }

  function bolinha(){
    var b = document.querySelector('.pa-bola'); if (!b) return;
    b.style.display = naoLidos ? '' : 'none'; b.textContent = naoLidos > 99 ? '99+' : naoLidos;
    try { if (naoLidos && navigator.setAppBadge) navigator.setAppBadge(naoLidos); else if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (e) {}
  }

  function blocoApp(){
    var partes = [];
    if (!instalado()) {
      if (pedidoInstalar) partes.push('<b>📲 Use o painel como aplicativo.</b> Fica um ícone na tela do celular, é só tocar para abrir.<br><button type="button" id="paInstalar">Instalar o aplicativo</button>');
      else if (ehIOS()) partes.push('<b>📲 Use o painel como aplicativo.</b> No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta) e depois em <b>Adicionar à Tela de Início</b>.');
      else partes.push('<b>📲 Use o painel como aplicativo.</b> No menu do navegador (⋮), toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.');
    }
    if (pushPossivel()) {
      if (Notification.permission === 'granted') partes.push('<span class="pa-ok">✓ Notificações ligadas neste aparelho.</span>');
      else if (Notification.permission === 'denied') partes.push('As notificações estão bloqueadas neste navegador. Libere nas configurações do site para receber os avisos no celular.');
      else partes.push('<b>🔔 Receba os avisos no celular</b>, mesmo com o painel fechado.<br><button type="button" id="paPush">Ativar notificações</button>');
    } else if (ehIOS() && !instalado()) {
      partes.push('No iPhone, as notificações funcionam depois de adicionar o painel à Tela de Início.');
    }
    return partes.length ? '<div class="pa-app">' + partes.join('<br><br>') + '</div>' : '';
  }

  function desenhar(){
    var lista = document.getElementById('paLista'); if (!lista) return;
    lista.innerHTML = blocoApp() + (avisos.length ? avisos.map(function(a){
      var wa = a.tel ? 'https://wa.me/' + String(a.tel).replace(/\D/g, '') + (a.msg ? '?text=' + encodeURIComponent(a.msg) : '') : '';
      return '<div class="pa-av' + (a.lido ? '' : ' novo') + '"><b>' + esc(a.titulo) + '</b>' + (a.texto ? '<p>' + esc(a.texto) + '</p>' : '') +
        (wa ? '<a href="' + esc(wa) + '" target="_blank" rel="noopener">' + esc(a.rotulo || '💬 Abrir WhatsApp') + '</a>' : '') +
        '<small>' + esc(quando(a.em)) + '</small></div>';
    }).join('') : '<div class="pa-vazio">Nenhum aviso ainda.<br>Quando alguém chamar pelo site ou chegar novidade da rede, aparece aqui.</div>');
    var bi = document.getElementById('paInstalar');
    if (bi) bi.onclick = function(){ var p = pedidoInstalar; pedidoInstalar = null; p.prompt(); p.userChoice.then(desenhar, desenhar); };
    var bp = document.getElementById('paPush');
    if (bp) bp.onclick = ativarPush;
  }

  function carregar(){
    return cfg.rpc('rpc_avisos', { p_token: cfg.token }).then(function(d){
      if (!d || !d.ok) return; // banco sem o REDE_5: fica só o sininho vazio
      avisos = d.itens || []; naoLidos = d.nao_lidos || 0; bolinha(); desenhar();
    }).catch(function(){});
  }

  function abrir(){
    document.body.classList.add('pa-aberta'); desenhar();
    if (naoLidos) {
      cfg.rpc('rpc_avisos_lidos', { p_token: cfg.token }).then(function(){
        naoLidos = 0; bolinha();
        // continuam destacados enquanto a lista está aberta; na próxima vez, já como lidos
        setTimeout(function(){ avisos.forEach(function(a){ a.lido = true; }); }, 0);
      }).catch(function(){});
    }
  }
  function fechar(){ document.body.classList.remove('pa-aberta'); if (location.hash === '#avisos') history.replaceState(null, '', location.pathname + location.search); }

  function chaveBytes(b64){
    var p = '='.repeat((4 - b64.length % 4) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function ativarPush(){
    Notification.requestPermission().then(function(perm){
      if (perm !== 'granted') { desenhar(); return; }
      return navigator.serviceWorker.ready.then(function(reg){
        return reg.pushManager.getSubscription().then(function(s){
          return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(VAPID) });
        });
      }).then(function(sub){
        return cfg.rpc('rpc_push_inscrever', { p_token: cfg.token, p_sub: sub.toJSON() });
      }).then(function(d){
        if (!d || !d.ok) throw new Error((d && d.error) || 'Não consegui ativar');
        desenhar();
      });
    }).catch(function(e){ alert('Não consegui ativar as notificações: ' + e.message); desenhar(); });
  }
  // aparelho que já tinha permissão: renova a inscrição (troca de token, reinstalação)
  function renovarPush(){
    if (!pushPossivel() || Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then(function(reg){
      return reg.pushManager.getSubscription().then(function(s){
        return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(VAPID) });
      });
    }).then(function(sub){ return cfg.rpc('rpc_push_inscrever', { p_token: cfg.token, p_sub: sub.toJSON() }); }).catch(function(){});
  }

  window.PainelApp = {
    iniciar: function(c){
      if (cfg || !c || !c.token) return;
      cfg = c;
      // manifesto com o link deste painel: o ícone instalado abre direto nele
      var m = document.createElement('link'); m.rel = 'manifest';
      m.href = '/api/painel-manifest?k=' + (c.tipo === 'parceiro' ? 'parceiro' : 'site') + '&t=' + encodeURIComponent(c.token);
      document.head.appendChild(m);
      montar();
      window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); pedidoInstalar = e; desenhar(); });
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-painel.js').then(renovarPush).catch(function(){});
      carregar().then(function(){ if (location.hash === '#avisos') abrir(); });
      setInterval(function(){ if (!document.hidden) carregar(); }, 60000);
      document.addEventListener('visibilitychange', function(){ if (!document.hidden) carregar(); });
    }
  };
})();
