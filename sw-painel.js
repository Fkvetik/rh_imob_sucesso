// Service worker dos painéis (/meu-site e /parceiro): mostra a notificação
// que chega do /api/push-enviar e abre o painel nos avisos ao tocar nela.
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titulo: e.data && e.data.text() }; }
  var tarefas = [self.registration.showNotification(d.titulo || 'RH IMOB', {
    body: d.texto || '',
    icon: '/assets/icon-192.png',
    badge: '/assets/favicon-32.png',
    data: { url: d.url || '/' },
    tag: 'rhimob-aviso',
    renotify: true
  })];
  if (d.n && self.navigator && self.navigator.setAppBadge) tarefas.push(self.navigator.setAppBadge(d.n).catch(function(){}));
  e.waitUntil(Promise.all(tarefas));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(abertas){
    var alvo = url.split('#')[0];
    for (var i = 0; i < abertas.length; i++) {
      if (abertas[i].url.split('#')[0] === alvo && 'focus' in abertas[i]) {
        return abertas[i].navigate(url).then(function(c){ return (c || abertas[i]).focus(); }).catch(function(){ return abertas[i].focus(); });
      }
    }
    return self.clients.openWindow(url);
  }));
});
