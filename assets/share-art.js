/* RH IMOB — Gerador de arte compartilhável (1080x1350) para Status / Story / Instagram.
   Uso: gerarArteRHIMOB({kicker, title, sub, tags:[{txt,type}], ctaText, ctaColor, url, filename}, btnEl)
   Desenha tudo no canvas (texto nítido) sobre o degradê da marca + logo real. */
(function () {
  function rr(x, x0, y0, w, h, r) {
    x.beginPath(); x.moveTo(x0 + r, y0);
    x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath();
  }
  function wrap(x, text, px, y, maxW, lh) {
    var words = String(text || '').split(' '), line = '';
    for (var i = 0; i < words.length; i++) {
      var t = line + words[i] + ' ';
      if (x.measureText(t).width > maxW && i > 0) { x.fillText(line.trim(), px, y); line = words[i] + ' '; y += lh; }
      else line = t;
    }
    x.fillText(line.trim(), px, y); return y;
  }
  function loadImg(src) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; }); }

  window.gerarArteRHIMOB = async function (o, btn) {
    var prev = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Gerando…'; }
    try {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
      var logo = await loadImg('/assets/rhimob-logo.jpg');
      var W = 1080, H = 1350, PX = 92;
      var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
      // fundo
      var g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#180826'); g.addColorStop(.5, '#2b124d'); g.addColorStop(1, '#3b1a6b');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      var rgTop = x.createRadialGradient(W, 0, 0, W, 0, 760); rgTop.addColorStop(0, 'rgba(255,122,26,.34)'); rgTop.addColorStop(1, 'rgba(255,122,26,0)');
      x.fillStyle = rgTop; x.fillRect(0, 0, W, H);
      var rgBot = x.createRadialGradient(0, H, 0, 0, H, 720); rgBot.addColorStop(0, 'rgba(109,45,242,.32)'); rgBot.addColorStop(1, 'rgba(109,45,242,0)');
      x.fillStyle = rgBot; x.fillRect(0, 0, W, H);

      // logo + marca
      var LR = 40, LX = PX + LR, LY = 128;
      if (logo) { x.save(); x.beginPath(); x.arc(LX, LY, LR, 0, 7); x.closePath(); x.clip(); x.drawImage(logo, LX - LR, LY - LR, LR * 2, LR * 2); x.restore(); }
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2; x.beginPath(); x.arc(LX, LY, LR, 0, 7); x.stroke();
      x.fillStyle = '#fff'; x.font = '900 34px Inter,Arial,sans-serif'; x.fillText('RH IMOB', LX + LR + 22, LY - 4);
      x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '700 16px Inter,Arial,sans-serif'; x.fillText('RECRUTAMENTO IMOBILIÁRIO', LX + LR + 24, LY + 24);

      var y = 340;
      // kicker
      if (o.kicker) {
        x.fillStyle = o.kickerColor || '#ffab40'; x.font = '900 28px Inter,Arial,sans-serif';
        y = wrap(x, o.kicker, PX, y, W - PX * 2, 38) + 44;
      }
      // título
      x.fillStyle = '#fff'; x.font = '900 74px Inter,Arial,sans-serif';
      y = wrap(x, o.title, PX, y, W - PX * 2, 84) + 24;
      // sub
      if (o.sub) {
        x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '600 33px Inter,Arial,sans-serif';
        y = wrap(x, o.sub, PX, y + 18, W - PX * 2, 46) + 10;
      }
      // tags/pills
      if (o.tags && o.tags.length) {
        y += 30;
        o.tags.forEach(function (t) {
          x.font = '800 30px Inter,Arial,sans-serif';
          var w = x.measureText(t.txt).width + 60;
          var fill = t.type === 'pay' ? 'rgba(31,185,120,.22)' : 'rgba(255,255,255,.12)';
          var tcol = t.type === 'pay' ? '#a7f3d0' : '#fff';
          x.fillStyle = fill; rr(x, PX, y, w, 68, 34); x.fill();
          x.fillStyle = tcol; x.fillText(t.txt, PX + 30, y + 45);
          y += 88;
        });
      }

      // rodapé: CTA + url
      var cta = o.ctaText || 'Saiba mais';
      var cy = H - 250;
      x.fillStyle = o.ctaColor || '#ff7a1a'; rr(x, PX, cy, W - PX * 2, 100, 22); x.fill();
      x.fillStyle = '#fff'; x.font = '900 36px Inter,Arial,sans-serif'; x.textAlign = 'center';
      x.fillText(cta, W / 2, cy + 64); x.textAlign = 'left';
      x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '700 28px Inter,Arial,sans-serif';
      x.fillText(String(o.url || 'rhimob.com.br').replace(/^https?:\/\/(www\.)?/, ''), PX, H - 96);
      // stripe
      var sg = x.createLinearGradient(0, 0, W, 0); sg.addColorStop(0, '#6d2df2'); sg.addColorStop(1, '#ff7a1a');
      x.fillStyle = sg; x.fillRect(0, H - 10, W, 10);

      await new Promise(function (resolve) {
        c.toBlob(function (blob) {
          var fname = o.filename || 'rhimob.png';
          var file = new File([blob], fname, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: o.title || 'RH IMOB' }).catch(function () {}).finally(resolve);
          } else {
            var a = document.createElement('a');
            a.href = (window.URL || window.webkitURL).createObjectURL(blob);
            a.download = fname; a.click();
            if (window.__artToast) window.__artToast('Arte baixada! Poste no Status, Story ou Instagram.');
            resolve();
          }
        }, 'image/png');
      });
    } catch (e) {
      if (window.__artToast) window.__artToast('Não foi possível gerar a arte.');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = prev; }
    }
  };
})();
