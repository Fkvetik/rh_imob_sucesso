(() => {
  const cfg = window.RHIMOB_SUPABASE_CONFIG || {};
  const WHATSAPP_FERNANDO = '5511978725515';
  const PAGE_SIZE = 12;
  const DEFAULT_FRASES = [
    'Olá, {nome}. Aqui é {Usuário}. Vi seu perfil profissional em {cidade} e gostaria de falar com você.',
    'Oi, {nome}. Tudo bem? Aqui é {Usuário}. Vi sua atuação em {cidade} e gostaria de abrir uma conversa profissional.',
    'Olá, {nome}. Sou {Usuário}. Identifiquei seu perfil em {cidade} e gostaria de entender seu momento profissional.'
  ];

  let state = {
    city: '',
    year: '',
    cargo: '',
    term: '',
    offset: 0,
    page: 1,
    loading: false,
    session: null,
    profile: null,
    frases: [],
    adminLoaded: false
  };

  let sb = null;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const normalize = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

  function getSupabaseClient() {
    if (sb) return sb;
    if (!window.supabase || !cfg.url || !cfg.publishableKey) return null;
    sb = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return sb;
  }

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
    ['topWhatsapp', 'bottomWhatsapp'].forEach((id) => {
      const el = $('#' + id);
      if (el) el.href = wa();
    });
  }

  function restUrl(path, params = {}) {
    const base = String(cfg.url || '').replace(/\/+$/, '');
    const u = new URL(`${base}/rest/v1/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
    });
    return u.toString();
  }

  function authTokenOrPublic() {
    return state.session?.access_token || cfg.publishableKey;
  }

  async function api(path, params = {}) {
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) {
      throw new Error('Configuração pública do Supabase não encontrada.');
    }
    const token = authTokenOrPublic();
    const res = await fetch(restUrl(path, params), {
      headers: {
        apikey: cfg.publishableKey,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${(await res.text()).slice(0, 260)}`);
    return res.json();
  }

  async function rpc(fn, payload = {}) {
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) {
      throw new Error('Configuração pública do Supabase não encontrada.');
    }
    if (!state.session?.access_token) throw new Error('Faça login para acessar esta função.');
    const base = String(cfg.url || '').replace(/\/+$/, '');
    const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: cfg.publishableKey,
        Authorization: `Bearer ${state.session.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Supabase RPC ${res.status}: ${(await res.text()).slice(0, 400)}`);
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

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function openLoginModal() {
    const modal = $('#loginModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => $('#loginEmail')?.focus(), 50);
  }

  function closeLoginModal() {
    const modal = $('#loginModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function openLeadModal() {
    const modal = $('#leadModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeLeadModal() {
    const modal = $('#leadModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    search();
  }

  function setLoginMessage(msg, type = '') {
    const el = $('#loginMessage');
    if (!el) return;
    el.textContent = msg || '';
    el.className = `form-message ${type}`.trim();
  }

  function firstName(nameOrEmail) {
    const base = String(nameOrEmail || '').split('@')[0].replace(/[._-]+/g, ' ');
    return normalize(base).split(' ')[0] || 'Operador';
  }

  function isAdminProfile() {
    const perfil = String(state.profile?.perfil || '').toUpperCase();
    return perfil === 'ADMIN' || perfil === 'MASTER';
  }

  function formatDateBR(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('pt-BR');
  }

  function formatDateTimeBR(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function sameLocalDay(a, b = new Date()) {
    const d = new Date(a);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
  }

  function postgrestInList(values) {
    const clean = Array.from(new Set((values || []).map((v) => String(v || '').trim()).filter(Boolean)));
    if (!clean.length) return '';
    return 'in.(' + clean.map((v) => '"' + v.replace(/"/g, '\"') + '"').join(',') + ')';
  }

  async function loadUserProfile() {
    state.profile = null;
    const userId = state.session?.user?.id;
    if (!userId) return null;
    try {
      const rows = await api('usuarios_conta', {
        select: 'id,conta_id,nome,email,perfil,status,telefone',
        auth_user_id: `eq.${userId}`,
        limit: 1
      });
      state.profile = rows?.[0] || null;
    } catch (e) {
      console.warn('Não foi possível carregar usuarios_conta:', e);
    }
    return state.profile;
  }

  async function loadFrases() {
    state.frases = DEFAULT_FRASES.slice();
    if (!state.session) return state.frases;
    try {
      const rows = await api('frases_abordagem', {
        select: 'texto,prioridade,status',
        status: 'eq.ATIVA',
        order: 'prioridade.asc'
      });
      const list = (rows || []).map((r) => normalize(r.texto)).filter(Boolean);
      if (list.length) state.frases = list;
    } catch (e) {
      console.warn('Usando frases fallback:', e);
    }
    return state.frases;
  }

  function updateAuthUI() {
    const logged = !!state.session;
    document.body.classList.toggle('is-logged', logged);

    const loginTop = $('#loginTopBtn');
    const heroLogin = $('#heroLoginBtn');
    const authMini = $('#authMini');
    const authMiniName = $('#authMiniName');
    const authStatus = $('#authStatusText');

    if (loginTop) loginTop.hidden = logged;
    if (heroLogin) heroLogin.textContent = logged ? 'Sessão ativa' : 'Entrar com login e senha';
    if (heroLogin) heroLogin.disabled = logged;
    if (authMini) authMini.hidden = !logged;

    const displayName = state.profile?.nome || state.session?.user?.email || 'Sessão ativa';
    if (authMiniName) authMiniName.textContent = logged ? displayName : '';
    if (authStatus) {
      authStatus.textContent = logged
        ? 'Login ativo. Ao abrir contato, o lead será consumido apenas para este plano.'
        : 'Dados mascarados. Entre para liberar contatos completos.';
    }

    const adminPanel = $('#adminPanel');
    if (adminPanel) {
      adminPanel.hidden = !(logged && isAdminProfile());
    }
  }

  async function setupAuth() {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase JS não carregado. Login indisponível.');
      return;
    }

    const sessionResult = await client.auth.getSession();
    state.session = sessionResult?.data?.session || null;
    if (state.session) {
      await loadUserProfile();
      await loadFrases();
      if (isAdminProfile()) setTimeout(() => loadAdminDashboard({ silent: true }), 250);
    }
    updateAuthUI();

    client.auth.onAuthStateChange(async (_event, session) => {
      state.session = session || null;
      if (state.session) {
        await loadUserProfile();
        await loadFrases();
        if (isAdminProfile()) setTimeout(() => loadAdminDashboard({ silent: true }), 250);
      } else {
        state.profile = null;
        state.frases = DEFAULT_FRASES.slice();
      }
      updateAuthUI();
      search();
    });
  }

  function bindAuth() {
    $('#loginTopBtn')?.addEventListener('click', openLoginModal);
    $('#heroLoginBtn')?.addEventListener('click', () => { if (!state.session) openLoginModal(); });
    $$('[data-close-login]').forEach((el) => el.addEventListener('click', closeLoginModal));
    $$('[data-close-lead]').forEach((el) => el.addEventListener('click', closeLeadModal));

    $('#togglePassword')?.addEventListener('click', () => {
      const input = $('#loginPassword');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    $('#logoutBtn')?.addEventListener('click', async () => {
      const client = getSupabaseClient();
      if (client) await client.auth.signOut();
    });

    $('#loginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getSupabaseClient();
      if (!client) return setLoginMessage('Supabase JS não carregou. Recarregue a página.', 'error');

      const email = normalize($('#loginEmail')?.value).toLowerCase();
      const password = String($('#loginPassword')?.value || '');
      if (!email || !password) return setLoginMessage('Informe e-mail e senha.', 'error');

      const btn = $('#loginSubmitBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
      setLoginMessage('Validando acesso...', 'info');

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }

      if (error) {
        setLoginMessage('Login não autorizado. Confira e-mail, senha e usuário ativo no plano.', 'error');
        return;
      }

      state.session = data.session;
      await loadUserProfile();
      await loadFrases();
      updateAuthUI();
      if (isAdminProfile()) setTimeout(() => loadAdminDashboard(), 350);
      setLoginMessage('Login realizado com sucesso.', 'success');
      setTimeout(closeLoginModal, 450);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if ($('#loginModal')?.getAttribute('aria-hidden') === 'false') closeLoginModal();
      if ($('#leadModal')?.getAttribute('aria-hidden') === 'false') closeLeadModal();
    });
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

    // Importante: este filtro lê a coluna normalizada CARGO, não CARGO_RAW.
    const rows = await api(cfg.publicTable || 'leads_publicos', {
      select: 'cargo',
      cidade: `eq.${city}`,
      ano_inscricao: `eq.${year}`,
      ativo: 'eq.true',
      limit: 10000
    });

    const counts = new Map();
    rows.forEach((r) => {
      const cargo = normalize(r.cargo || 'Perfil imobiliário');
      if (!cargo) return;
      counts.set(cargo, (counts.get(cargo) || 0) + 1);
    });

    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .forEach(([cargo, total]) => select.appendChild(opt(cargo, cargo, total)));
  }

  function perfilTexto(r) {
    return normalize(r.cargo || 'Perfil imobiliário');
  }

  function card(r) {
    const perfil = perfilTexto(r);
    const logged = !!state.session;
    const ctx = `${r.cidade || 'cidade'} / ${r.ano_inscricao || 'ano'} / ${perfil}`;
    const action = logged
      ? `<button class="btn btn-primary js-open-lead" type="button" data-lead-key="${esc(r.lead_key)}">Abrir contato completo</button>`
      : `<button class="btn btn-primary js-login-lead" type="button">Entrar para liberar contato</button>`;

    return `<article class="lead-card" data-lead-key="${esc(r.lead_key)}">
      <div class="lead-head">
        <span class="badge">${logged ? 'Acesso autenticado' : 'Dado mascarado'}</span>
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
        <p class="note">${logged ? 'Ao abrir, o lead será consumido somente para este plano.' : 'Contato completo e mensagem pronta são liberados somente com login contratado.'}</p>
        ${action}
        ${!logged ? `<a class="link-access" href="${wa(ctx)}" target="_blank" rel="noopener">Solicitar acesso comercial</a>` : ''}
      </div>
    </article>`;
  }

  async function search({ append = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    const grid = $('#cardsGrid');
    const more = $('#maisBtn');
    if (!append) { state.offset = 0; state.page = 1; grid.innerHTML = ''; }
    more.hidden = true;
    status(append ? 'Carregando mais resultados...' : 'Buscando corretores...');

    let rows = [];

    if (state.session) {
      rows = await rpc('search_leads_plano', {
        p_cidade: state.city || null,
        p_ano: state.year || null,
        p_cargo: state.cargo || null,
        p_page: state.page,
        p_page_size: PAGE_SIZE,
        p_ocultar_consumidos: true
      });
    } else {
      const params = {
        select: 'lead_key,cidade,nome_mascarado,creci_mascarado,ano_inscricao,cargo,tem_canal_telefone,tem_canal_instagram,tags_publicas,updated_at',
        ativo: 'eq.true',
        order: 'updated_at.desc',
        limit: PAGE_SIZE,
        offset: state.offset
      };
      if (state.city) params.cidade = `eq.${state.city}`;
      if (state.year) params.ano_inscricao = `eq.${state.year}`;
      if (state.cargo) params.cargo = `eq.${state.cargo}`;
      rows = await api(cfg.publicTable || 'leads_publicos', params);
    }

    let filtered = rows;
    if (state.term) {
      const term = state.term.toLowerCase();
      filtered = rows.filter((r) => [r.cidade, r.cargo, r.tags_publicas, r.ano_inscricao].join(' ').toLowerCase().includes(term));
    }

    if (!append && !filtered.length) {
      grid.innerHTML = '<div class="empty">Nenhum resultado encontrado. Tente outra cidade, ano ou perfil.</div>';
    } else {
      grid.insertAdjacentHTML('beforeend', filtered.map(card).join(''));
      bindLeadButtons(grid);
    }

    state.offset += rows.length;
    state.page += 1;
    more.hidden = rows.length < PAGE_SIZE;
    status(`${filtered.length} resultados exibidos nesta página${state.session ? ' • consumidos do seu plano ficam ocultos' : ''}`);
    state.loading = false;
  }

  function bindLeadButtons(context) {
    $$('.js-login-lead', context).forEach((btn) => btn.addEventListener('click', openLoginModal));
    $$('.js-open-lead', context).forEach((btn) => {
      btn.addEventListener('click', () => abrirLead(btn.dataset.leadKey));
    });
  }

  function buildMessage(template, lead) {
    const operador = state.profile?.nome || firstName(state.session?.user?.email);
    return String(template || '')
      .replace(/\{nome\}/gi, firstName(lead.nome_completo || lead.nome_mascarado))
      .replace(/\{cidade\}/gi, lead.cidade || '')
      .replace(/\{Usuário\}/g, operador)
      .replace(/\{usuario\}/gi, operador);
  }

  function whatsappLeadUrl(lead, message) {
    const fromWa = onlyDigits(lead.telefone_wa);
    const fromTxt = onlyDigits(lead.telefone_txt);
    const fromBase = onlyDigits(lead.telefone_base);
    let phone = fromWa || fromTxt || fromBase;
    if (phone.length === 10 || phone.length === 11) phone = '55' + phone;
    if (!phone) return '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(message || '')}`;
  }

  async function abrirLead(leadKey) {
    if (!state.session) return openLoginModal();
    try {
      status('Liberando contato completo...');
      const rows = await rpc('abrir_lead', { p_lead_key: leadKey });
      const lead = rows?.[0];
      if (!lead) throw new Error('Lead não retornado pelo Supabase.');
      renderLeadDetail(lead);
      openLeadModal();
      status(`Contato liberado. Consumidos: ${lead.leads_consumidos} • Disponíveis: ${lead.leads_disponiveis}`);
      if (isAdminProfile()) loadAdminDashboard({ silent: true });
    } catch (e) {
      console.error(e);
      alert('Não foi possível liberar este contato.\n\n' + e.message);
      status('Falha ao liberar contato.');
    }
  }

  function renderLeadDetail(lead) {
    const frases = state.frases.length ? state.frases : DEFAULT_FRASES;
    const firstMsg = buildMessage(frases[0], lead);
    const waUrl = whatsappLeadUrl(lead, firstMsg);
    const content = $('#leadDetailContent');
    if (!content) return;

    content.innerHTML = `
      <div class="detail-grid">
        <div><strong>Nome completo</strong><span>${esc(lead.nome_completo || 'Não informado')}</span></div>
        <div><strong>CRECI</strong><span>${esc(lead.creci || 'Não informado')}</span></div>
        <div><strong>Cidade</strong><span>${esc(lead.cidade || 'Não informado')}</span></div>
        <div><strong>Ano de inscrição</strong><span>${esc(lead.ano_inscricao || 'Não informado')}</span></div>
        <div><strong>Perfil</strong><span>${esc(lead.cargo || 'Perfil imobiliário')}</span></div>
        <div><strong>Telefone</strong><span>${esc(lead.telefone_txt || lead.telefone_base || 'Não informado')}</span></div>
        <div><strong>Instagram</strong><span>${lead.instagram_url ? `<a href="${esc(lead.instagram_url)}" target="_blank" rel="noopener">${esc(lead.instagram_username || lead.instagram_url)}</a>` : 'Não informado'}</span></div>
        <div><strong>Consumo</strong><span>${lead.newly_consumed ? 'Consumido agora' : 'Já consumido neste plano'}</span></div>
      </div>
      ${lead.bio ? `<div class="bio-box"><strong>Bio / sinais públicos</strong><p>${esc(lead.bio)}</p></div>` : ''}
      <div class="message-box">
        <label>Mensagem de abordagem
          <select id="fraseSelect">${frases.map((f, i) => `<option value="${i}">${esc(f.slice(0, 92))}${f.length > 92 ? '...' : ''}</option>`).join('')}</select>
        </label>
        <textarea id="messagePreview" rows="5">${esc(firstMsg)}</textarea>
        <div class="detail-actions">
          ${waUrl ? `<a class="btn btn-primary" id="openLeadWhatsapp" href="${esc(waUrl)}" target="_blank" rel="noopener">Abrir WhatsApp</a>` : '<button class="btn btn-secondary" type="button" disabled>WhatsApp indisponível</button>'}
          ${lead.instagram_url ? `<a class="btn btn-secondary" href="${esc(lead.instagram_url)}" target="_blank" rel="noopener">Abrir Instagram</a>` : ''}
        </div>
      </div>
    `;

    $('#fraseSelect')?.addEventListener('change', (event) => {
      const msg = buildMessage(frases[Number(event.target.value)] || frases[0], lead);
      const textarea = $('#messagePreview');
      if (textarea) textarea.value = msg;
      const link = $('#openLeadWhatsapp');
      const newUrl = whatsappLeadUrl(lead, msg);
      if (link && newUrl) link.href = newUrl;
    });

    $('#messagePreview')?.addEventListener('input', (event) => {
      const link = $('#openLeadWhatsapp');
      const newUrl = whatsappLeadUrl(lead, event.target.value);
      if (link && newUrl) link.href = newUrl;
    });
  }

  function setAdminAlert(message, type = 'info') {
    const el = $('#adminAlert');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'admin-alert';
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.className = `admin-alert ${type}`.trim();
  }

  function setCellText(id, value) {
    const el = $('#' + id);
    if (el) el.textContent = value == null || value === '' ? '-' : String(value);
  }

  function renderAdminUsers(users = []) {
    const tbody = $('#adminUsersTable');
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="4">Nenhum usuário cadastrado neste plano.</td></tr>';
      return;
    }
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>${esc(u.nome || '-')}</td>
        <td>${esc(u.email || '-')}</td>
        <td><span class="pill ${String(u.perfil || '').toLowerCase()}">${esc(u.perfil || '-')}</span></td>
        <td><span class="status-chip ${String(u.status || '').toLowerCase()}">${esc(u.status || '-')}</span></td>
      </tr>
    `).join('');
  }

  function renderAdminReport(users = [], consumos = []) {
    const tbody = $('#adminReportTable');
    if (!tbody) return;

    const byAuth = new Map();
    const byEmail = new Map();
    users.forEach((u) => {
      if (u.auth_user_id) byAuth.set(u.auth_user_id, { user: u, hoje: 0, total: 0, ultimo: null });
      if (u.email) byEmail.set(String(u.email).toLowerCase(), { user: u, hoje: 0, total: 0, ultimo: null });
    });

    consumos.forEach((c) => {
      const email = String(c.usuario_email || '').toLowerCase();
      let item = byAuth.get(c.auth_user_id) || byEmail.get(email);
      if (!item) {
        item = { user: { nome: c.usuario_email || 'Operador não identificado', email }, hoje: 0, total: 0, ultimo: null };
        byEmail.set(email || ('sem-email-' + byEmail.size), item);
      }
      item.total += 1;
      if (sameLocalDay(c.data_consumo || c.created_at)) item.hoje += 1;
      const dt = c.data_consumo || c.created_at;
      if (!item.ultimo || new Date(dt) > new Date(item.ultimo)) item.ultimo = dt;
    });

    const rows = Array.from(new Set([...byAuth.values(), ...byEmail.values()]))
      .sort((a, b) => b.total - a.total || String(a.user.nome || '').localeCompare(String(b.user.nome || ''), 'pt-BR'));

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">Sem consumo registrado.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${esc(r.user.nome || r.user.email || 'Operador')}</td>
        <td><strong>${r.hoje}</strong></td>
        <td><strong>${r.total}</strong></td>
        <td>${esc(formatDateTimeBR(r.ultimo))}</td>
      </tr>
    `).join('');
  }

  function renderAdminRecent(consumos = [], leadsMap = new Map()) {
    const tbody = $('#adminRecentTable');
    if (!tbody) return;
    const rows = consumos.slice(0, 20);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">Sem contatos liberados.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((c) => {
      const lead = leadsMap.get(c.lead_key) || {};
      return `
        <tr>
          <td>${esc(formatDateTimeBR(c.data_consumo || c.created_at))}</td>
          <td>${esc(c.usuario_email || 'Operador')}</td>
          <td>${esc(lead.nome_mascarado || c.lead_key || '-')}</td>
          <td>${esc(lead.cidade || '-')}</td>
          <td>${esc(lead.cargo || '-')}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadAdminDashboard({ silent = false } = {}) {
    if (!state.session || !state.profile || !isAdminProfile()) return;
    const panel = $('#adminPanel');
    if (panel) panel.hidden = false;

    if (!silent) setAdminAlert('Atualizando relatório do plano...', 'info');

    try {
      const contaId = state.profile.conta_id;
      if (!contaId) throw new Error('Usuário logado sem CONTA_ID vinculado. Verifique USUARIOS_MODELO.');

      const [contas, users, consumos] = await Promise.all([
        api('contas', { select: 'id,nome_empresa,status,usuarios_contratados,limite_leads,data_inicio,data_fim,observacao', id: `eq.${contaId}`, limit: 1 }),
        api('usuarios_conta', { select: 'id,conta_id,auth_user_id,nome,email,perfil,status,telefone,created_at', conta_id: `eq.${contaId}`, order: 'nome.asc' }),
        api('lead_consumos', { select: 'id,conta_id,lead_key,user_id,auth_user_id,usuario_email,data_consumo,status,created_at', conta_id: `eq.${contaId}`, order: 'data_consumo.desc', limit: 10000 })
      ]);

      const conta = contas?.[0] || {};
      const activeUsers = (users || []).filter((u) => String(u.status || '').toUpperCase() === 'ATIVO');
      const contracted = Number(conta.usuarios_contratados || 0);
      const limit = Number(conta.limite_leads || 0);
      const consumed = (consumos || []).length;
      const available = Math.max(0, limit - consumed);

      setCellText('adminEmpresa', conta.nome_empresa || 'Plano sem nome');
      setCellText('adminPlanoStatus', `Status: ${conta.status || '-'} • Conta: ${String(conta.id || contaId).slice(0, 8)}...`);
      setCellText('adminUsuariosResumo', `${activeUsers.length}/${contracted || activeUsers.length}`);
      setCellText('adminUsuariosStatus', contracted && activeUsers.length > contracted ? 'Acima do contratado' : 'Dentro do plano');
      setCellText('adminLeadsConsumidos', consumed);
      setCellText('adminLeadsDisponiveis', limit ? `${available} disponíveis` : 'Limite não definido');
      setCellText('adminPeriodo', `${formatDateBR(conta.data_inicio)} até ${formatDateBR(conta.data_fim)}`);
      setCellText('adminLimite', limit ? `Limite: ${limit} leads` : 'Sem limite configurado');
      setCellText('adminUsersCount', `${users.length} usuário(s)`);
      setCellText('adminRecentCount', `${Math.min(consumed, 20)} registro(s) recentes`);

      if (contracted && activeUsers.length > contracted) {
        setAdminAlert(`Atenção: este plano tem ${contracted} usuário(s) contratado(s), mas ${activeUsers.length} usuário(s) ativo(s). Ajuste a planilha ou aumente o plano.`, 'warn');
      } else {
        setAdminAlert('Relatório atualizado com sucesso.', 'success');
      }

      renderAdminUsers(users || []);
      renderAdminReport(users || [], consumos || []);

      let leadsMap = new Map();
      const keys = (consumos || []).slice(0, 20).map((c) => c.lead_key).filter(Boolean);
      const inFilter = postgrestInList(keys);
      if (inFilter) {
        try {
          const leads = await api(cfg.publicTable || 'leads_publicos', {
            select: 'lead_key,nome_mascarado,cidade,ano_inscricao,cargo',
            lead_key: inFilter,
            limit: 50
          });
          leadsMap = new Map((leads || []).map((l) => [l.lead_key, l]));
        } catch (leadErr) {
          console.warn('Não foi possível detalhar leads recentes:', leadErr);
        }
      }
      renderAdminRecent(consumos || [], leadsMap);
      state.adminLoaded = true;
    } catch (e) {
      console.error(e);
      setAdminAlert('Não foi possível carregar o painel do plano. Detalhe: ' + e.message, 'error');
    }
  }

  function bind() {
    const cidade = $('#cidadeSelect');
    const ano = $('#anoSelect');
    const cargo = $('#cargoSelect');
    const termo = $('#termoInput');

    cidade.addEventListener('change', async () => {
      state.city = cidade.value;
      state.year = '';
      state.cargo = '';
      await loadYears(state.city);
      await search();
    });

    ano.addEventListener('change', async () => {
      state.year = ano.value;
      state.cargo = '';
      await loadCargos(state.city, state.year);
      await search();
    });

    cargo.addEventListener('change', async () => {
      state.cargo = cargo.value;
      await search();
    });

    $('#buscarBtn').addEventListener('click', async () => {
      state.term = normalize(termo.value);
      await search();
    });

    termo.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.term = normalize(termo.value);
        await search();
      }
    });

    $('#limparBtn').addEventListener('click', async () => {
      state = {
        ...state,
        city: '',
        year: '',
        cargo: '',
        term: '',
        offset: 0,
        page: 1,
        loading: false
      };
      cidade.value = '';
      termo.value = '';
      await loadYears('');
      await search();
    });

    $('#maisBtn').addEventListener('click', () => search({ append: true }));
    $('#adminRefreshBtn')?.addEventListener('click', () => loadAdminDashboard());
  }

  async function init() {
    setupWhatsApp();
    bindAuth();
    bind();
    try {
      await setupAuth();
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
