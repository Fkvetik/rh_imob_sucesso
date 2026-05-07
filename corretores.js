(() => {
  const cfg = window.RHIMOB_SUPABASE_CONFIG || {};
  const WHATSAPP_FERNANDO = '5511978725515';
  const PAGE_SIZE = 12;
  let state = { city: '', year: '', cargo: '', term: '', offset: 0, loading: false };

  const $ = (s, c = document) => c.querySelector(s);
  const normalize = (v) => String(v || '').replace(/\s+/g, ' ').trim();

  function wa(context) {
    const text = [
      'Olá, Fernando. Vim pelo site da RH IMOB.',
      'Quero entender o acesso completo à plataforma de corretores ativos.',
      context ? `Filtro consultado: ${context}` : '',
      'Gostaria de ver como funciona a liberação dos contatos, múltiplos usuários e relatório por plano.'
    ].filter(Boolean).join('\n\n');
    return `https://wa.me/${WHATSAPP_FERNANDO}?text=${encodeURIComponent(text)}`;
  }

  function setupWhatsApp() {
    ['topWhatsapp','heroWhatsapp','bottomWhatsapp'].forEach((id) => {
      const el = $('#' + id);
      if (el) el.href = wa();
    });
  }

  function url(path, params = {}) {
    const base = String(cfg.url || '').replace(/\/+$/, '');
    const u = new URL(`${base}/rest/v1/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
    });
    return u.toString();
  }

  async function api(path, params = {}) {
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) throw new Error('Configuração pública do Supabase não encontrada.');
    const res = await fetch(url(path, params), {
      headers: { apikey: cfg.publishableKey, Authorization: `Bearer ${cfg.publishableKey}`, Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${(await res.text()).slice(0, 220)}`);
    return res.json();
  }

  function status(msg) {
    const el = $('#resultadoStatus');
    if (el) el.textContent = msg;
  }

  function opt(label, value, extra = '') {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = extra ? `${label} (${extra})` : label;
    return o;
  }

  async function loadCities() {
    const select = $('#cidadeSelect');
    const rows = await api('lead_filtros_cidade', { select: 'cidade,total', order: 'total.desc' });
    select.innerHTML = '';
    select.appendChild(opt('Todas as cidades', ''));
    rows.forEach((r) => select.appendChild(opt(r.cidade, r.cidade, r.total)));
    const total = $('#totalCidades');
    if (total) total.textContent = rows.length || '18';
  }

  async function loadYears(city) {
    const select = $('#anoSelect');
    const cargo = $('#cargoSelect');
    select.disabled = !city;
    select.innerHTML = '';
    select.appendChild(opt(city ? 'Todos os anos' : 'Selecione uma cidade primeiro', ''));
    cargo.disabled = true;
    cargo.innerHTML = '';
    cargo.appendChild(opt('Todos os perfis', ''));
    if (!city) return;
    const rows = await api('lead_filtros_cidade_ano', {
      select: 'ano_inscricao,total',
      cidade: `eq.${city}`,
      order: 'ano_inscricao.desc'
    });
    rows.forEach((r) => select.appendChild(opt(r.ano_inscricao, r.ano_inscricao, r.total)));
  }

  async function loadCargos(city, year) {
    const select = $('#cargoSelect');
    select.disabled = !(city && year);
    select.innerHTML = '';
    select.appendChild(opt(city && year ? 'Todos os perfis' : 'Selecione cidade e ano primeiro', ''));
    if (!(city && year)) return;
    const rows = await api('lead_filtros_cidade_ano_cargo', {
      select: 'cargo_raw,total',
      cidade: `eq.${city}`,
      ano_inscricao: `eq.${year}`,
      order: 'total.desc'
    });
    rows.forEach((r) => {
      if (r.cargo_raw) select.appendChild(opt(r.cargo_raw, r.cargo_raw, r.total));
    });
  }

  function esc(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function card(r) {
    const perfil = r.cargo || r.cargo_raw || 'Perfil imobiliário';
    const ctx = `${r.cidade || 'cidade'} / ${r.ano_inscricao || 'ano'} / ${perfil}`;
    return `<article class="lead-card">
      <div class="lead-head">
        <span class="badge">Dado mascarado</span>
        <h3>${esc(r.nome_mascarado || 'Profissional mascarado')}</h3>
        <div>${esc(r.cidade || 'Cidade não informada')}</div>
      </div>
      <div class="lead-body">
        <div class="meta">
          <span>CRECI: ${esc(r.creci_mascarado || '***')}</span>
          <span>Ano de inscrição: ${esc(r.ano_inscricao || 'Não informado')}</span>
          <span>Perfil: ${esc(perfil)}</span>
        </div>
        <div class="channels">
          <span class="channel ${r.tem_canal_telefone ? 'ok' : ''}">${r.tem_canal_telefone ? 'WhatsApp validado' : 'Telefone não exibido'}</span>
          <span class="channel ${r.tem_canal_instagram ? 'ok' : ''}">${r.tem_canal_instagram ? 'Instagram encontrado' : 'Instagram não exibido'}</span>
        </div>
        <p class="note">Contato completo e mensagem pronta são liberados somente no acesso contratado.</p>
        <a class="btn btn-primary" href="${wa(ctx)}" target="_blank" rel="noopener">Quero acesso completo</a>
      </div>
    </article>`;
  }

  async function search({ append = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    const grid = $('#cardsGrid');
    const more = $('#maisBtn');
    if (!append) { state.offset = 0; grid.innerHTML = ''; }
    more.hidden = true;
    status(append ? 'Carregando mais resultados...' : 'Buscando corretores mascarados...');

    const params = {
      select: 'lead_key,cidade,nome_mascarado,creci_mascarado,ano_inscricao,cargo,cargo_raw,tem_canal_telefone,tem_canal_instagram,tags_publicas',
      ativo: 'eq.true',
      order: 'updated_at.desc',
      limit: PAGE_SIZE,
      offset: state.offset
    };
    if (state.city) params.cidade = `eq.${state.city}`;
    if (state.year) params.ano_inscricao = `eq.${state.year}`;
    if (state.cargo) params.cargo_raw = `eq.${state.cargo}`;

    const rows = await api(cfg.publicTable || 'leads_publicos', params);
    let filtered = rows;
    if (state.term) {
      const term = state.term.toLowerCase();
      filtered = rows.filter((r) => [r.cidade, r.cargo, r.cargo_raw, r.tags_publicas, r.ano_inscricao].join(' ').toLowerCase().includes(term));
    }

    if (!append && !filtered.length) grid.innerHTML = '<div class="empty">Nenhum resultado encontrado. Tente outra cidade, ano ou perfil.</div>';
    else grid.insertAdjacentHTML('beforeend', filtered.map(card).join(''));

    state.offset += rows.length;
    more.hidden = rows.length < PAGE_SIZE;
    status(`${filtered.length} resultados exibidos nesta página`);
    state.loading = false;
  }

  function bind() {
    const cidade = $('#cidadeSelect'), ano = $('#anoSelect'), cargo = $('#cargoSelect'), termo = $('#termoInput');
    cidade.addEventListener('change', async () => { state.city = cidade.value; state.year = ''; state.cargo = ''; await loadYears(state.city); await search(); });
    ano.addEventListener('change', async () => { state.year = ano.value; state.cargo = ''; await loadCargos(state.city, state.year); await search(); });
    cargo.addEventListener('change', async () => { state.cargo = cargo.value; await search(); });
    $('#buscarBtn').addEventListener('click', async () => { state.term = normalize(termo.value); await search(); });
    termo.addEventListener('keydown', async (e) => { if (e.key === 'Enter') { e.preventDefault(); state.term = normalize(termo.value); await search(); } });
    $('#limparBtn').addEventListener('click', async () => {
      state = { city: '', year: '', cargo: '', term: '', offset: 0, loading: false };
      cidade.value = ''; termo.value = '';
      await loadYears('');
      await search();
    });
    $('#maisBtn').addEventListener('click', () => search({ append: true }));
  }

  async function init() {
    setupWhatsApp();
    bind();
    try {
      await loadCities();
      await search();
    } catch (e) {
      console.error(e);
      $('#cardsGrid').innerHTML = `<div class="error">Não foi possível carregar a vitrine pública agora. Detalhe: ${esc(e.message)}</div>`;
      status('Falha ao carregar dados públicos.');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
