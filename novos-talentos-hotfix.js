(() => {
  'use strict';

  const PRODUCT_CODE = 'NOVOS_TALENTOS';
  const PAGE_SIZE = 24;
  const cfg = window.RHIMOB_NOVOS_TALENTOS_SUPABASE_CONFIG || {
    enabled: true,
    url: 'https://pufxvskozfdvfscqnays.supabase.co',
    publishableKey: 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj'
  };

  let client = null;
  let offset = 0;
  let total = 0;
  let loading = false;
  let timer = null;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function stripAccents(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function key(value) {
    return stripAccents(normalize(value)).toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNumber(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '0';
  }

  function parseTotal(text) {
    const m = String(text || '').match(/\((\d[\d\.]*)\)\s*$/);
    if (!m) return 0;
    return Number(String(m[1]).replace(/\./g, '')) || 0;
  }

  function stripTotal(text) {
    return String(text || '').replace(/\s*\((\d[\d\.]*)\)\s*$/, '').replace(/\s+/g, ' ').trim();
  }

  function cityPartsFromSelect() {
    const select = $('#cidadeSelect');
    const opt = select?.selectedOptions?.[0];
    const rawValue = normalize(select?.value || '');
    const rawLabel = normalize(opt?.textContent || '');

    let cidade = '';
    let uf = '';

    if (rawValue.includes('||')) {
      const parts = rawValue.split('||');
      cidade = normalize(parts[0]);
      uf = normalize(parts[1]).toUpperCase();
    }

    const labelBase = stripTotal(rawLabel);
    if ((!cidade || !uf) && labelBase.includes('/')) {
      const parts = labelBase.split('/');
      uf = normalize(parts.pop()).toUpperCase();
      cidade = normalize(parts.join('/'));
    }

    cidade = cidade.replace(/\s*[-/]\s*[A-Za-z]{2}\s*$/, '').trim();
    if (!/^[A-Z]{2}$/.test(uf)) uf = '';

    return { cidade, estado_uf: uf };
  }

  function collectFilters() {
    const city = cityPartsFromSelect();
    return {
      cidade: city.cidade || '',
      estado_uf: city.estado_uf || '',
      regiao_macro: normalize($('#regiaoSelect')?.value),
      micro_regiao: normalize($('#microSelect')?.value),
      bairro: normalize($('#bairroSelect')?.value),
      faixa_idade: normalize($('#idadeSelect')?.value),
      cargo: normalize($('#cargoSelect')?.value),
      estacao: normalize($('#metroSelect')?.value),
      termo: normalize($('#termoInput')?.value)
    };
  }

  function getClient() {
    if (client) return client;
    if (!window.supabase || !cfg?.url || !cfg?.publishableKey) return null;
    client = window.supabase.createClient(String(cfg.url).replace(/\/+$/, ''), cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  function status(text) {
    const el = $('#resultadoStatus');
    if (el) el.textContent = text;
  }

  function inferMacro(row) {
    return normalize(row?.macro_calc || row?.regiao_macro || '');
  }

  function inferMicro(row) {
    return normalize(row?.micro_calc || row?.micro_regiao || row?.estacao_mais_proxima || row?.bairro || '');
  }

  function joinDisplay(values) {
    return values.filter(Boolean).map(normalize).join(' • ');
  }

  function metroLabel(row) {
    const est = normalize(row?.estacao_mais_proxima);
    const dist = row?.distancia_metro_km;
    const n = Number(String(dist || '').replace(',', '.'));
    if (!est || !Number.isFinite(n) || n > 5) return 'Sem metrô até 5 km';
    return `${est}${row?.linha_metro_mais_proxima ? ' • ' + normalize(row.linha_metro_mais_proxima) : ''} • ${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
  }

  function renderCards(rows, append = false) {
    const grid = $('#cardsGrid');
    if (!grid) return;

    if (!append) grid.innerHTML = '';

    if (!rows.length && !append) {
      grid.innerHTML = '<div class="nt-empty">Nenhum talento disponível para os filtros selecionados. Ajuste a busca ou limpe os filtros.</div>';
      return;
    }

    const html = rows.map((row) => {
      const idade = row.faixa_idade || (row.idade_anos ? `${row.idade_anos} anos` : 'Idade não informada');
      const macro = inferMacro(row);
      const micro = inferMicro(row);
      const canal = row.tem_whatsapp ? 'Canal disponível após login' : (row.tem_email ? 'Contato disponível após login' : 'Contato protegido');
      const geo = row.tem_geo ? 'Geolocalizado' : 'Localização aproximada';

      return `
        <article class="nt-card" data-key="${escapeHtml(row.talento_key)}">
          <div class="nt-card__top">
            <div>
              <h3>${escapeHtml(row.nome_mascarado || row.primeiro_nome || 'Profissional')}</h3>
              <p>${escapeHtml(row.cargo || 'Perfil comercial')}</p>
            </div>
            <span class="nt-pill">${escapeHtml(idade)}</span>
          </div>
          <div class="nt-card__meta">
            <span>📍 ${escapeHtml(joinDisplay([row.bairro, row.cidade, row.estado_uf]))}</span>
            <span>🧭 ${escapeHtml(joinDisplay([macro, micro]) || 'Região em classificação')}</span>
            <span>🚇 ${escapeHtml(metroLabel(row))}</span>
          </div>
          <div class="nt-card__signals">
            <span class="nt-signal">${escapeHtml(canal)}</span>
            <span class="nt-signal">${escapeHtml(geo)}</span>
          </div>
          <button class="nt-btn nt-btn-primary js-consumir" type="button" data-key="${escapeHtml(row.talento_key)}">Ver detalhes</button>
        </article>
      `;
    }).join('');

    grid.insertAdjacentHTML('beforeend', html);

    $$('.js-consumir', grid).forEach((btn) => {
      if (btn.dataset.ntHotfixBound === '1') return;
      btn.dataset.ntHotfixBound = '1';
      btn.addEventListener('click', () => {
        const openLogin = $('#openLoginBtn');
        if (openLogin) openLogin.click();
      });
    });
  }

  function dedupeCitySelect() {
    const select = $('#cidadeSelect');
    if (!select || !select.options || select.options.length < 2) return;

    const currentLabel = normalize(select.selectedOptions?.[0]?.textContent || '');
    const map = new Map();
    const order = [];

    Array.from(select.options).forEach((opt, idx) => {
      if (idx === 0 || !opt.value) return;
      const base = stripTotal(opt.textContent || '');
      if (!base.includes('/')) return;
      const parts = base.split('/');
      const uf = normalize(parts.pop()).toUpperCase();
      const cidade = normalize(parts.join('/'));
      if (!cidade || !/^[A-Z]{2}$/.test(uf)) return;
      const k = `${key(cidade)}||${uf}`;
      const item = { value: `${cidade}||${uf}`, label: `${cidade}/${uf}`, total: parseTotal(opt.textContent || '') };
      if (!map.has(k)) order.push(k);
      // Mantém a última ocorrência: nos casos observados, é a que retorna cards.
      map.set(k, item);
    });

    if (!order.length) return;

    const first = document.createElement('option');
    first.value = '';
    first.textContent = 'Todas as Cidades';
    select.innerHTML = '';
    select.appendChild(first);

    order.forEach((k) => {
      const item = map.get(k);
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = `${item.label} (${formatNumber(item.total)})`;
      select.appendChild(opt);
    });

    const match = Array.from(select.options).find((opt) => normalize(opt.textContent) === currentLabel);
    if (match) select.value = match.value;
  }

  function rowMatchesClient(row, f) {
    if (f.cidade && key(row.cidade) !== key(f.cidade)) return false;
    if (f.estado_uf && normalize(row.estado_uf).toUpperCase() !== f.estado_uf) return false;
    if (f.regiao_macro && inferMacro(row) !== f.regiao_macro) return false;
    if (f.micro_regiao && inferMicro(row) !== f.micro_regiao) return false;
    if (f.bairro && normalize(row.bairro) !== f.bairro) return false;
    if (f.faixa_idade && normalize(row.faixa_idade) !== f.faixa_idade) return false;
    if (f.cargo && normalize(row.cargo) !== f.cargo) return false;
    if (f.estacao && normalize(row.estacao_mais_proxima) !== f.estacao) return false;
    if (f.termo) {
      const h = [row.nome_mascarado, row.cargo, row.bairro, row.cidade, row.tags_publicas].map((x) => key(x)).join(' ');
      if (!h.includes(key(f.termo))) return false;
    }
    return true;
  }

  async function rpcSearch(f, from, limit) {
    const c = getClient();
    if (!c) return null;
    const { data, error } = await c.rpc('nt_listar_talentos_publico_v10', {
      p_cidade: f.cidade || null,
      p_estado_uf: f.estado_uf || null,
      p_regiao_macro: f.regiao_macro || null,
      p_micro_regiao: f.micro_regiao || null,
      p_bairro: f.bairro || null,
      p_faixa_idade: f.faixa_idade || null,
      p_cargo: f.cargo || null,
      p_estacao: f.estacao || null,
      p_termo: f.termo || null,
      p_limit: limit,
      p_offset: from
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function directSearch(f, from, limit) {
    const c = getClient();
    if (!c) return { rows: [], total: 0 };

    let q = c
      .from('nt_talentos_publicos')
      .select('talento_key,nome_mascarado,primeiro_nome,cargo,idade_anos,faixa_idade,cidade,estado_uf,bairro,regiao_macro,micro_regiao,tem_whatsapp,tem_email,tem_geo,estacao_mais_proxima,linha_metro_mais_proxima,cor_linha_metro,distancia_metro_km,tags_publicas,ativo,updated_at', { count: 'exact' })
      .eq('produto_codigo', PRODUCT_CODE)
      .eq('ativo', true);

    if (f.estado_uf) q = q.eq('estado_uf', f.estado_uf);
    if (f.bairro) q = q.eq('bairro', f.bairro);
    if (f.faixa_idade) q = q.eq('faixa_idade', f.faixa_idade);
    if (f.cargo) q = q.eq('cargo', f.cargo);
    if (f.estacao) q = q.eq('estacao_mais_proxima', f.estacao);

    // Quando cidade está selecionada, busca um lote maior por UF e filtra no navegador por chave normalizada.
    // Isso evita a falha de cidade canônica vs cidade original da base.
    const rangeTo = f.cidade ? Math.max(499, from + limit - 1) : from + limit - 1;
    const { data, error, count } = await q.order('updated_at', { ascending: false }).range(0, rangeTo);
    if (error) throw error;

    const filtered = (data || []).filter((row) => rowMatchesClient(row, f));
    return {
      rows: filtered.slice(from, from + limit),
      total: f.cidade || f.regiao_macro || f.micro_regiao || f.termo ? filtered.length : (count || filtered.length)
    };
  }

  async function runSearch(reset = true) {
    if (loading) return;
    loading = true;

    if (reset) offset = 0;

    const f = collectFilters();
    status('Consultando talentos disponíveis...');

    try {
      let rows = [];
      let sourceTotal = 0;

      try {
        rows = await rpcSearch(f, offset, PAGE_SIZE);
        sourceTotal = Number(rows?.[0]?.total_count || 0);
      } catch (err) {
        console.warn('[NT hotfix] RPC falhou, usando tabela pública:', err);
      }

      if (!rows.length) {
        const fallback = await directSearch(f, offset, PAGE_SIZE);
        rows = fallback.rows;
        sourceTotal = fallback.total;
      }

      total = sourceTotal || rows.length;
      renderCards(rows, !reset);
      offset += rows.length;

      const more = $('#maisBtn');
      if (more) more.hidden = offset >= total || !rows.length;
      status(`${formatNumber(total)} talentos disponíveis para os filtros atuais. Exibindo ${formatNumber(Math.min(offset, total))}.`);
    } catch (err) {
      console.error('[NT hotfix] erro:', err);
      status('Não foi possível carregar os talentos agora. Atualize a página ou fale com o suporte.');
    } finally {
      loading = false;
    }
  }

  function shouldRecover() {
    const grid = $('#cardsGrid');
    const st = normalize($('#resultadoStatus')?.textContent || '');
    if (!grid) return false;
    if (!grid.children.length) return true;
    if (grid.querySelector('.nt-empty') && /^0\s+talentos/i.test(st)) return true;
    return false;
  }

  function bind() {
    ['cidadeSelect', 'regiaoSelect', 'microSelect', 'bairroSelect', 'idadeSelect', 'cargoSelect', 'metroSelect'].forEach((id) => {
      const el = $('#' + id);
      if (!el || el.dataset.ntHotfixBound === '1') return;
      el.dataset.ntHotfixBound = '1';
      el.addEventListener('change', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          dedupeCitySelect();
          runSearch(true);
        }, 220);
      });
    });

    const term = $('#termoInput');
    if (term && term.dataset.ntHotfixBound !== '1') {
      term.dataset.ntHotfixBound = '1';
      term.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          clearTimeout(timer);
          timer = setTimeout(() => runSearch(true), 120);
        }
      });
    }

    const buscar = $('#buscarBtn');
    if (buscar && buscar.dataset.ntHotfixBound !== '1') {
      buscar.dataset.ntHotfixBound = '1';
      buscar.addEventListener('click', () => runSearch(true));
    }

    const mais = $('#maisBtn');
    if (mais && mais.dataset.ntHotfixBound !== '1') {
      mais.dataset.ntHotfixBound = '1';
      mais.addEventListener('click', () => runSearch(false));
    }
  }

  function start() {
    bind();
    setTimeout(() => {
      dedupeCitySelect();
      if (shouldRecover()) runSearch(true);
    }, 1400);

    setTimeout(() => {
      dedupeCitySelect();
      if (shouldRecover()) runSearch(true);
    }, 3200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
