import './globals.css';
export const metadata = {
  title: 'RH IMOB CRM',
  description: 'CRM de atendimento RH IMOB',
};

const dedupeCidadesScript = `
(function(){
  if (typeof window === 'undefined') return;

  function isNovosTalentos(){
    return String(window.location.pathname || '').indexOf('/novos-talentos') === 0;
  }

  function norm(value){
    return String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/\\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function parseTotal(text){
    var m = String(text || '').match(/\\((\\d[\\d\\.]*)\\)\\s*$/);
    if (!m) return 0;
    return Number(String(m[1]).replace(/\\./g, '')) || 0;
  }

  function stripTotal(text){
    return String(text || '').replace(/\\s*\\((\\d[\\d\\.]*)\\)\\s*$/, '').replace(/\\s+/g, ' ').trim();
  }

  function parseCityOption(option){
    if (!option) return null;

    var text = String(option.textContent || option.innerText || '').replace(/\\s+/g, ' ').trim();
    var value = String(option.value || '').replace(/\\s+/g, ' ').trim();
    if (!text || /^todas as cidades$/i.test(text)) return null;

    var base = stripTotal(text);
    var cidade = '';
    var uf = '';

    if (value.indexOf('||') > -1) {
      var pv = value.split('||');
      cidade = (pv[0] || '').trim();
      uf = (pv[1] || '').trim().toUpperCase();
    }

    if ((!cidade || !uf) && base.indexOf('/') > -1) {
      var parts = base.split('/');
      uf = String(parts.pop() || '').trim().toUpperCase();
      cidade = parts.join('/').trim();
    }

    if (!cidade || !/^[A-Z]{2}$/.test(uf)) return null;

    var invalid = norm(cidade);
    if (
      invalid.indexOf('experiencia') > -1 ||
      invalid.indexOf('marketing') > -1 ||
      invalid.indexOf('processo') > -1 ||
      invalid.indexOf('mapeamento') > -1 ||
      invalid.indexOf('manutencao') > -1 ||
      invalid.indexOf('executando') > -1 ||
      invalid.indexOf('ferramenta') > -1 ||
      invalid.indexOf('atendimento') > -1 ||
      invalid.indexOf('analista') > -1 ||
      invalid.indexOf('professor') > -1 ||
      invalid.indexOf('estoquista') > -1 ||
      invalid.indexOf('dados pessoais') > -1
    ) return null;

    return {
      key: norm(cidade) + '||' + uf,
      cidade: cidade,
      uf: uf,
      total: parseTotal(text),
      text: base + (parseTotal(text) ? ' (' + parseTotal(text).toLocaleString('pt-BR') + ')' : ''),
      value: cidade + '||' + uf,
      option: option
    };
  }

  function looksLikeCitySelect(select){
    if (!select || !select.options || select.options.length < 2) return false;
    var first = String(select.options[0].textContent || '').trim().toLowerCase();
    if (first.indexOf('todas as cidades') > -1) return true;

    var hits = 0;
    for (var i = 0; i < Math.min(select.options.length, 30); i++) {
      if (parseCityOption(select.options[i])) hits++;
    }
    return hits >= 3;
  }

  function dedupeOne(select){
    if (!isNovosTalentos() || !looksLikeCitySelect(select)) return;
    if (select.dataset.rhimobDedupeRunning === '1') return;

    select.dataset.rhimobDedupeRunning = '1';
    try {
      var current = select.value;
      var firstText = select.options[0] ? String(select.options[0].textContent || '').trim() : 'Todas as Cidades';
      var map = new Map();
      var order = [];
      var changed = false;

      Array.prototype.slice.call(select.options).forEach(function(option, idx){
        if (idx === 0 || option.value === '') return;
        var parsed = parseCityOption(option);
        if (!parsed) {
          changed = true;
          return;
        }

        if (!map.has(parsed.key)) {
          map.set(parsed.key, parsed);
          order.push(parsed.key);
        } else {
          changed = true;
          var prev = map.get(parsed.key);
          if ((parsed.total || 0) > (prev.total || 0)) {
            map.set(parsed.key, parsed);
          }
        }
      });

      if (!changed && order.length === select.options.length - 1) return;

      select.innerHTML = '';
      var optAll = document.createElement('option');
      optAll.value = '';
      optAll.textContent = firstText || 'Todas as Cidades';
      select.appendChild(optAll);

      order.forEach(function(key){
        var item = map.get(key);
        if (!item) return;
        var opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.text;
        select.appendChild(opt);
      });

      var exists = Array.prototype.some.call(select.options, function(opt){ return opt.value === current; });
      if (exists) select.value = current;
    } catch(e) {
      console.warn('[RHIMOB] falha ao deduplicar cidades:', e);
    } finally {
      select.dataset.rhimobDedupeRunning = '0';
    }
  }

  function run(){
    if (!isNovosTalentos()) return;
    document.querySelectorAll('select').forEach(dedupeOne);
  }

  document.addEventListener('DOMContentLoaded', run);
  document.addEventListener('focusin', function(ev){
    if (ev.target && ev.target.tagName === 'SELECT') dedupeOne(ev.target);
  }, true);
  document.addEventListener('mousedown', function(ev){
    if (ev.target && ev.target.tagName === 'SELECT') dedupeOne(ev.target);
  }, true);
  document.addEventListener('change', function(ev){
    if (ev.target && ev.target.tagName === 'SELECT') setTimeout(run, 50);
  }, true);

  var observer = new MutationObserver(function(){ run(); });
  function startObserver(){
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    run();
  }
  if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver);

  var tries = 0;
  var timer = setInterval(function(){
    run();
    tries++;
    if (tries > 60) clearInterval(timer);
  }, 500);
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: dedupeCidadesScript }} />
      </body>
    </html>
  );
}
