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
    loading: false,
    session: null,
    profile: null,
    frases: DEFAULT_FRASES.slice(),
    currentPhraseId: null,
    abordadosVisible: false,
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
      throw new Error('Configuração da plataforma indisponível. Recarregue a página ou fale com a RH IMOB.');
    }
    const res = await fetch(restUrl(path, params), {
      headers: {
        apikey: cfg.publishableKey,
        Authorization: `Bearer ${authTokenOrPublic()}`,
        Accept: 'application/json'
      }
    });
    if (!res.ok) throw new Error(`Não foi possível consultar a plataforma neste momento. Código ${res.status}.`);
    return res.json();
  }

  async function rpc(fn, payload = {}) {
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) {
      throw new Error('Configuração da plataforma indisponível. Recarregue a página ou fale com a RH IMOB.');
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
    if (!res.ok) {
      const raw = await res.text();
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        detail = parsed.message || parsed.details || raw;
      } catch (_) {}
      throw new Error(`Não foi possível concluir esta ação. Código ${res.status}: ${detail.slice(0, 500)}`);
    }
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

  function setText(id, value) {
    const el = $('#' + id);
    if (el) el.textContent = value == null || value === '' ? '-' : String(value);
  }

  function firstName(value) {
    const base = String(value || '').split('@')[0].replace(/[._-]+/g, ' ');
    return normalize(base).split(' ')[0] || 'Profissional';
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

  function statusTypeFromSaldo(saldo) {
    const n = Number(saldo || 0);
    if (n <= 10) return 'error';
    if (n <= 30) return 'warn';
    if (n <= 50) return 'info';
    return 'success';
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

  async function loadUserProfile() {
    state.profile = null;
    const userId = state.session?.user?.id;
    if (!userId) return null;
    const rows = await api('usuarios_conta', {
      select: 'id,conta_id,nome,email,perfil,status,telefone',
      auth_user_id: `eq.${userId}`,
      limit: 1
    });
    const profile = rows?.[0] || null;
    if (!profile || String(profile.status || '').toUpperCase() !== 'ATIVO') return null;
    state.profile = profile;
    return profile;
  }

  async function loadFrases() {
    state.frases = DEFAULT_FRASES.slice();
    if (!state.session) return state.frases;
    try {
      const rows = await rpc('rhi_listar_frases_abordagem', {});
      const list = (rows || [])
        .filter((r) => String(r.status || '').toUpperCase() === 'ATIVA')
        .sort((a, b) => Number(a.prioridade || 0) - Number(b.prioridade || 0))
        .map((r) => normalize(r.texto))
        .filter(Boolean);
      if (list.length) state.frases = list;
    } catch (e) {
      console.warn('Frases padrão carregadas:', e);
    }
    return state.frases;
  }

  function updateAuthUI() {
    const logged = !!state.session && !!state.profile;
    document.body.classList.toggle('is-logged', logged);

    const loginTop = $('#loginTopBtn');
    const heroLogin = $('#heroLoginBtn');
    const authMini = $('#authMini');
    const authMiniName = $('#authMiniName');
    const authStatus = $('#authStatusText');
    const adminPanel = $('#adminPanel');

    if (loginTop) loginTop.hidden = logged;
    if (heroLogin) {
      heroLogin.textContent = logged ? 'Sessão ativa' : 'Entrar com login e senha';
      heroLogin.disabled = logged;
    }
    if (authMini) authMini.hidden = !logged;
    if (authMiniName) authMiniName.textContent = logged ? (state.profile?.nome || state.session?.user?.email || 'Sessão ativa') : '';
    if (authStatus) {
      authStatus.textContent = logged
        ? 'Login ativo. Contatos liberados serão registrados no saldo deste plano.'
        : 'Prévia protegida. Entre para liberar contatos completos.';
    }
    if (adminPanel) adminPanel.hidden = !(logged && isAdminProfile());
    const abordadosBtn = $('#abordadosToggleBtn');
    if (abordadosBtn) abordadosBtn.hidden = !logged;
    if (!logged) showAbordadosCOR(false);
  }

  async function refreshLoggedState(session) {
    state.session = session || null;
    state.profile = null;
    if (!state.session) {
      state.frases = DEFAULT_FRASES.slice();
      updateAuthUI();
      return false;
    }
    const profile = await loadUserProfile();
    if (!profile) {
      const client = getSupabaseClient();
      if (client) await client.auth.signOut();
      state.session = null;
      state.profile = null;
      state.frases = DEFAULT_FRASES.slice();
      updateAuthUI();
      return false;
    }
    await loadFrases();
    updateAuthUI();
    if (isAdminProfile()) setTimeout(() => loadAdminDashboard({ silent: true }), 250);
    return true;
  }

  async function setupAuth() {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Módulo de login não carregou.');
      return;
    }

    const sessionResult = await client.auth.getSession();
    await refreshLoggedState(sessionResult?.data?.session || null);

    client.auth.onAuthStateChange(async (_event, session) => {
      await refreshLoggedState(session);
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
      if (!client) return setLoginMessage('O módulo de login não carregou. Recarregue a página.', 'error');

      const email = normalize($('#loginEmail')?.value).toLowerCase();
      const password = String($('#loginPassword')?.value || '');
      if (!email || !password) return setLoginMessage('Informe e-mail e senha.', 'error');

      const btn = $('#loginSubmitBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
      setLoginMessage('Validando acesso...', 'info');

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }

      if (error) return setLoginMessage('Login não autorizado. Confira e-mail, senha e usuário ativo no plano.', 'error');

      const ok = await refreshLoggedState(data.session);
      if (!ok) return setLoginMessage('Usuário inativo ou não vinculado a um plano ativo.', 'error');

      setLoginMessage('Login realizado com sucesso.', 'success');
      setTimeout(closeLoginModal, 450);
      search();
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
    const logged = !!state.session && !!state.profile;
    const ctx = `${r.cidade || 'cidade'} / ${r.ano_inscricao || 'ano'} / ${perfil}`;
    const action = logged
      ? `<button class="btn btn-primary js-open-lead" type="button" data-lead-key="${esc(r.lead_key)}">Abrir contato completo</button>`
      : `<button class="btn btn-primary js-login-lead" type="button">Entrar para liberar contato</button>`;

    return `<article class="lead-card" data-lead-key="${esc(r.lead_key)}">
      <div class="lead-head">
        <span class="badge">${logged ? 'Acesso autenticado' : 'Prévia protegida'}</span>
        <h3>${esc(r.nome_mascarado || 'Profissional selecionado')}</h3>
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
        <p class="note">${logged ? 'Ao abrir, o contato será registrado somente neste plano.' : 'Contato completo e mensagem pronta são liberados somente com login contratado.'}</p>
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
    if (!append) { state.offset = 0; grid.innerHTML = ''; }
    more.hidden = true;
    status(append ? 'Carregando mais resultados...' : 'Buscando corretores...');

    let rows = [];

    try {
      if (state.session && state.profile) {
        rows = await rpc('search_leads_plano', {
          p_cidade: state.city || null,
          p_ano_inscricao: state.year || null,
          p_cargo: state.cargo || null,
          p_termo: state.term || null,
          p_limit: PAGE_SIZE,
          p_offset: state.offset
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
        if (state.term) {
          const term = state.term.toLowerCase();
          rows = rows.filter((r) => [r.cidade, r.cargo, r.tags_publicas, r.ano_inscricao].join(' ').toLowerCase().includes(term));
        }
      }

      if (!append && !rows.length) {
        grid.innerHTML = '<div class="empty">Nenhum resultado encontrado. Tente outra cidade, ano ou perfil.</div>';
      } else {
        grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
        bindLeadButtons(grid);
      }

      state.offset += rows.length;
      more.hidden = rows.length < PAGE_SIZE;
      status(`${rows.length} resultados exibidos nesta página${state.session ? ' • contatos já liberados ficam fora da lista' : ''}`);
    } catch (e) {
      console.error(e);
      if (!append) grid.innerHTML = `<div class="error">Não foi possível carregar os resultados agora. ${esc(e.message)}</div>`;
      status('Falha ao carregar resultados.');
    } finally {
      state.loading = false;
    }
  }

  function bindLeadButtons(context) {
    $$('.js-login-lead', context).forEach((btn) => btn.addEventListener('click', openLoginModal));
    $$('.js-open-lead', context).forEach((btn) => btn.addEventListener('click', () => abrirLead(btn.dataset.leadKey)));
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

  function friendlyOpenLeadError(message) {
    if (/LIMITE_DE_ACESSOS_DO_PLANO_ESGOTADO/i.test(message)) {
      return 'Seu plano atingiu o limite de acessos contratados. Fale com a RH IMOB para renovar ou fazer upgrade.';
    }
    if (/USUARIO_SEM_CONTA_ATIVA|CONTA_INATIVA/i.test(message)) {
      return 'Seu usuário ou plano não está ativo. Fale com o administrador do plano ou com a RH IMOB.';
    }
    return 'Não foi possível liberar este contato.\n\n' + message;
  }

  function normalizarRetornoAbrirLead(data) {
    if (!data) return null;
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (_) { return null; }
    }
    if (Array.isArray(data)) {
      if (!data.length) return null;
      return normalizarRetornoAbrirLead(data[0]);
    }
    if (data.lead) return data;
    if (data.abrir_lead) return normalizarRetornoAbrirLead(data.abrir_lead);
    if (data.result) return normalizarRetornoAbrirLead(data.result);
    if (data.data) return normalizarRetornoAbrirLead(data.data);
    return data;
  }

  async function abrirLead(leadKey) {
    if (!state.session || !state.profile) return openLoginModal();
    try {
      status('Liberando contato completo...');
      const payload = await rpc('abrir_lead', { p_lead_key: leadKey });
      const result = normalizarRetornoAbrirLead(payload);
      const lead = result?.lead || result;
      if (!lead?.lead_key) throw new Error('Contato não retornado pela plataforma.');
      renderLeadDetail(lead, result?.plano || null, result?.ja_consumido_antes);
      openLeadModal();
      registrarAbordagemCOR(lead).catch(() => {});
      const plano = result?.plano || {};
      if (plano.aviso) setAdminAlert(plano.aviso, statusTypeFromSaldo(plano.leads_restantes));
      status(`Contato liberado. Usados: ${plano.leads_consumidos ?? '-'} • Disponíveis: ${plano.leads_restantes ?? '-'}`);
      if (isAdminProfile()) loadAdminDashboard({ silent: true });
    } catch (e) {
      console.error(e);
      alert(friendlyOpenLeadError(e.message));
      status('Falha ao liberar contato.');
    }
  }

  function renderLeadDetail(lead, plano, jaConsumidoAntes) {
    const frases = state.frases.length ? state.frases : DEFAULT_FRASES;
    const firstMsg = buildMessage(frases[0], lead);
    const waUrl = whatsappLeadUrl(lead, firstMsg);
    const content = $('#leadDetailContent');
    if (!content) return;

    const subtitle = $('#leadModalSubtitle');
    if (subtitle) {
      subtitle.textContent = plano?.aviso || (jaConsumidoAntes ? 'Este contato já estava liberado para o seu plano.' : 'Contato liberado para o seu plano.');
    }

    content.innerHTML = `
      ${plano?.aviso ? `<div class="plan-warning ${esc(statusTypeFromSaldo(plano.leads_restantes))}">${esc(plano.aviso)}</div>` : ''}
      <div class="detail-grid">
        <div><strong>Nome completo</strong><span>${esc(lead.nome_completo || 'Não informado')}</span></div>
        <div><strong>CRECI</strong><span>${esc(lead.creci || 'Não informado')}</span></div>
        <div><strong>Cidade</strong><span>${esc(lead.cidade || 'Não informado')}</span></div>
        <div><strong>Ano de inscrição</strong><span>${esc(lead.ano_inscricao || 'Não informado')}</span></div>
        <div><strong>Perfil</strong><span>${esc(lead.cargo || 'Perfil imobiliário')}</span></div>
        <div><strong>Telefone</strong><span>${esc(lead.telefone_txt || lead.telefone_base || 'Não informado')}</span></div>
        <div><strong>Instagram</strong><span>${lead.instagram_url ? `<a href="${esc(lead.instagram_url)}" target="_blank" rel="noopener">${esc(lead.instagram_username || lead.instagram_url)}</a>` : 'Não informado'}</span></div>
        <div><strong>Registro no plano</strong><span>${jaConsumidoAntes ? 'Já liberado neste plano' : 'Liberado agora'}</span></div>
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

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    if (diffMin < 2) return 'agora';
    if (diffMin < 60) return `há ${diffMin}min`;
    if (diffH < 24) return `há ${diffH}h`;
    if (diffD === 1) return 'ontem';
    if (diffD < 30) return `há ${diffD} dias`;
    const diffM = Math.floor(diffD / 30);
    if (diffM < 12) return `há ${diffM} ${diffM === 1 ? 'mês' : 'meses'}`;
    return 'há mais de 1 ano';
  }

  function timeAgoClass(dateStr) {
    if (!dateStr) return 'stale';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'stale';
    const diffD = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffD <= 7) return 'fresh';
    if (diffD <= 30) return 'warn';
    return 'stale';
  }

  function recordKey(r) {
    return `${r.data_consumo || ''}::${r.operador || r.usuario_email || ''}::${r.nome_mascarado || r.lead_key || ''}`;
  }

  function applyTrend(elId, current, previous) {
    const el = $('#' + elId);
    if (!el) return;
    if (!previous || previous === 0) { el.hidden = true; return; }
    const pct = Math.round(((current - previous) / previous) * 100);
    el.hidden = false;
    if (Math.abs(pct) < 3) { el.className = 'trend neutral'; el.textContent = '→ estável'; }
    else if (pct > 0) { el.className = 'trend up'; el.textContent = `↑ ${pct}%`; }
    else { el.className = 'trend down'; el.textContent = `↓ ${Math.abs(pct)}%`; }
  }

  function updatePhrasePreview() {
    const text = ($('#phraseText')?.value || '').trim();
    const preview = $('#ntPhrasePreview');
    if (!preview) return;
    if (!text) { preview.hidden = true; return; }
    const nome = state.profile?.nome || 'Ana Silva';
    const result = text
      .replace(/\{nome\}/gi, nome)
      .replace(/\{primeiro_nome\}/gi, nome.split(' ')[0])
      .replace(/\{Usuário\}/g, state.profile?.nome || 'Paulo')
      .replace(/\{empresa\}/gi, 'RH IMOB')
      .replace(/\{cidade\}/gi, 'Campinas');
    preview.hidden = false;
    preview.textContent = result;
    const counter = $('#phraseCharCount');
    if (counter) counter.textContent = text.length;
  }

  function exportAdminCSV() {
    const users = state.adminUsers || [];
    const report = state.adminReport || [];
    const recent = state.adminRecent || [];
    if (!users.length && !recent.length) return setAdminAlert('Sem dados para exportar. Atualize o relatório primeiro.', 'warn');
    const sep = ';';
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let csv = 'OPERADORES DO PLANO\n';
    csv += ['Nome', 'E-mail', 'Perfil', 'Status', 'Total'].map(q).join(sep) + '\n';
    users.forEach((u) => {
      csv += [u.nome, u.email, u.perfil, u.status, u.consumidos_total || 0].map(q).join(sep) + '\n';
    });
    if (report.length) {
      csv += '\nCONSUMO POR OPERADOR\n';
      csv += ['Operador', 'Hoje', '7 dias', 'Total'].map(q).join(sep) + '\n';
      report.forEach((r) => {
        csv += [r.nome || r.email, r.consumidos_hoje || 0, r.consumidos_7_dias || 0, r.consumidos_total || 0].map(q).join(sep) + '\n';
      });
    }
    if (recent.length) {
      csv += '\nÚLTIMOS CONTATOS LIBERADOS\n';
      csv += ['Data/hora', 'Operador', 'Lead', 'Cidade', 'Perfil'].map(q).join(sep) + '\n';
      recent.forEach((r) => {
        csv += [formatDateTimeBR(r.data_consumo), r.operador || r.usuario_email || '',
          r.nome_mascarado || r.lead_key || '', r.cidade || '', r.cargo || ''].map(q).join(sep) + '\n';
      });
    }
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_corretores_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function filterAdminUsers() {
    const val = ($('#usersFilterStatus')?.value || '').toUpperCase();
    const filtered = val ? (state.adminUsers || []).filter((u) => String(u.status || '').toUpperCase() === val) : (state.adminUsers || []);
    renderAdminUsers(filtered, true);
  }

  function filterRecentTable() {
    const opFilter = normalize($('#recentFilterOp')?.value || '').toLowerCase();
    const de = $('#recentFilterDe')?.value;
    const ate = $('#recentFilterAte')?.value;
    let rows = state.adminRecent || [];
    if (opFilter) rows = rows.filter((r) => String(r.operador || r.usuario_email || '').toLowerCase().includes(opFilter));
    if (de) { const deDate = new Date(de); rows = rows.filter((r) => new Date(r.data_consumo) >= deDate); }
    if (ate) { const ateDate = new Date(ate + 'T23:59:59'); rows = rows.filter((r) => new Date(r.data_consumo) <= ateDate); }
    renderAdminRecent(rows);
    const count = $('#adminRecentCount');
    if (count) count.textContent = `${rows.length} registro(s) filtrado(s)`;
  }

  async function marcarConvertido(key) {
    if (!key || !confirm('Marcar este contato como convertido?')) return;
    state.convertidos = state.convertidos || new Set();
    state.convertidos.add(key);
    renderAdminRecent(state.adminRecent || []);
    try {
      const record = (state.adminRecent || []).find((r) => recordKey(r) === key);
      if (record) {
        await rpc('rhi_marcar_lead_convertido', {
          p_operador: record.operador || record.usuario_email || '',
          p_lead: record.nome_mascarado || record.lead_key || '',
          p_data: record.data_consumo || ''
        });
        setAdminAlert('Conversão registrada no banco com sucesso.', 'success');
      }
    } catch (_) {
      setAdminAlert('Conversão marcada localmente (sessão atual). Para persistir, crie rhi_marcar_lead_convertido no Supabase.', 'warn');
    }
  }

  function renderAdminUsers(users = [], skipStore = false) {
    if (!skipStore) state.adminUsers = users;
    const tbody = $('#adminUsersTable');
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum usuário cadastrado neste plano.</td></tr>';
      return;
    }
    tbody.innerHTML = users.map((u) => {
      const ativo = String(u.status || '').toUpperCase() === 'ATIVO';
      const self = state.profile?.id && u.usuario_id === state.profile.id;
      const nextStatus = ativo ? 'INATIVO' : 'ATIVO';
      return `<tr>
        <td>${esc(u.nome || '-')}</td>
        <td>${esc(u.email || '-')}</td>
        <td><span class="pill ${String(u.perfil || '').toLowerCase()}">${esc(u.perfil || '-')}</span></td>
        <td><span class="status-chip ${String(u.status || '').toLowerCase()}">${esc(u.status || '-')}</span></td>
        <td><strong>${Number(u.consumidos_total || 0)}</strong></td>
        <td class="access-${timeAgoClass(u.ultimo_acesso || u.last_sign_in_at)}">${esc(formatTimeAgo(u.ultimo_acesso || u.last_sign_in_at))}</td>
        <td><button class="mini-action js-user-status" data-user-id="${esc(u.usuario_id)}" data-next-status="${nextStatus}" ${self ? 'disabled title="Você não pode inativar a si mesmo"' : ''}>${ativo ? 'Inativar' : 'Reativar'}</button></td>
      </tr>`;
    }).join('');

    $$('.js-user-status', tbody).forEach((btn) => {
      btn.addEventListener('click', () => alterarStatusOperador(btn.dataset.userId, btn.dataset.nextStatus));
    });
  }

  function renderAdminReport(rows = []) {
    const tbody = $('#adminReportTable');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">Sem contatos liberados.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${esc(r.nome || r.email || 'Operador')}</td>
        <td><strong>${Number(r.consumidos_hoje || 0)}</strong></td>
        <td><strong>${Number(r.consumidos_7_dias || 0)}</strong></td>
        <td><strong>${Number(r.consumidos_total || 0)}</strong></td>
      </tr>
    `).join('');
  }

  function renderAdminRecent(rows = []) {
    const tbody = $('#adminRecentTable');
    if (!tbody) return;
    const list = (rows || []).slice(0, 30);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6">Sem contatos liberados.</td></tr>';
      return;
    }
    const convertidos = state.convertidos || new Set();
    tbody.innerHTML = list.map((r) => {
      const key = recordKey(r);
      const jaConvertido = convertidos.has(key);
      return `<tr>
        <td>${esc(formatDateTimeBR(r.data_consumo))}</td>
        <td>${esc(r.operador || r.usuario_email || 'Operador')}</td>
        <td>${esc(r.nome_mascarado || r.lead_key || '-')}</td>
        <td>${esc(r.cidade || '-')}</td>
        <td>${esc(r.cargo || '-')}</td>
        <td class="nowrap">${jaConvertido
          ? '<span class="badge-converted">✓ Convertido</span>'
          : `<button class="mini-action js-mark-converted" data-key="${esc(key)}">Marcar</button>`
        }</td>
      </tr>`;
    }).join('');
    $$('.js-mark-converted', tbody).forEach((btn) => {
      btn.addEventListener('click', () => marcarConvertido(btn.dataset.key));
    });
  }

  async function loadAdminDashboard({ silent = false } = {}) {
    if (!state.session || !state.profile || !isAdminProfile()) return;
    const panel = $('#adminPanel');
    if (panel) panel.hidden = false;

    if (!silent) setAdminAlert('Atualizando relatório do plano...', 'info');

    try {
      const data = await rpc('rhi_painel_plano', {});
      const conta = data?.conta || {};
      const operadores = data?.operadores || [];
      const consumo = data?.consumo_operadores || [];
      const ultimos = data?.ultimos_contatos || [];

      setText('adminEmpresa', conta.nome_empresa || 'Plano sem nome');
      setText('adminPlanoStatus', `Status: ${conta.status || '-'} • Conta: ${String(conta.id || '').slice(0, 8)}...`);
      setText('adminUsuariosResumo', `${conta.usuarios_ativos || 0}/${conta.usuarios_contratados || 0}`);
      setText('adminUsuariosStatus', `${conta.usuarios_disponiveis || 0} usuário(s) disponível(is)`);
      setText('adminLeadsConsumidos', conta.leads_consumidos || 0);
      setText('adminLeadsDisponiveis', `${conta.leads_disponiveis || 0} disponíveis`);
      setText('adminPeriodo', `${formatDateBR(conta.data_inicio)} até ${formatDateBR(conta.data_fim)}`);
      setText('adminLimite', `Limite: ${conta.limite_leads || 0} leads`);
      setText('adminUsersCount', `${operadores.length} usuário(s)`);
      setText('adminRecentCount', `${ultimos.length} registro(s) recentes`);

      const alertMsg = conta.aviso_consumo || conta.aviso_usuarios || 'Relatório atualizado com sucesso.';
      const alertType = conta.aviso_consumo ? statusTypeFromSaldo(conta.leads_disponiveis) : 'success';
      setAdminAlert(alertMsg, alertType);

      state.adminReport = consumo;
      state.adminRecent = ultimos;
      renderAdminUsers(operadores);
      renderAdminReport(consumo);
      renderAdminRecent(ultimos);

      const consumed = conta.leads_consumidos || 0;
      const total = consumed + (conta.leads_disponiveis || 0);
      if (total > 0) {
        const pct = Math.round((consumed / total) * 100);
        const el = $('#adminLeadsTrend');
        if (el) {
          el.hidden = false;
          el.className = pct > 80 ? 'trend down' : pct > 50 ? 'trend neutral' : 'trend up';
          el.textContent = `${pct}% usado`;
        }
      }

      const saldo = conta.leads_disponiveis || 0;
      const totalLimit = saldo + (conta.leads_consumidos || 0);
      const criticoEl = $('#saldoCritico');
      if (criticoEl) {
        if (totalLimit > 0 && saldo / totalLimit < 0.2) {
          const msg = saldo <= 5
            ? `Restam apenas ${saldo} acesso(s) no plano. Risco de interrupção imediata.`
            : `${saldo} de ${totalLimit} acessos disponíveis (${Math.round(saldo / totalLimit * 100)}% restante).`;
          $('#saldoCriticoMsg') && ($('#saldoCriticoMsg').textContent = msg);
          criticoEl.hidden = false;
        } else {
          criticoEl.hidden = true;
        }
      }

      await loadAdminPhrases({ silent: true });
      await loadFunilGestorCOR();
    } catch (e) {
      console.error(e);
      setAdminAlert('Não foi possível carregar o painel do plano. Detalhe: ' + e.message, 'error');
    }
  }

  async function alterarStatusOperador(usuarioId, nextStatus) {
    if (!usuarioId || !nextStatus) return;
    const label = nextStatus === 'INATIVO' ? 'inativar' : 'reativar';
    if (!confirm(`Confirmar ${label} este operador?`)) return;
    try {
      setAdminAlert('Atualizando operador...', 'info');
      await rpc('rhi_admin_alterar_status_operador', {
        p_usuario_id: usuarioId,
        p_status: nextStatus
      });
      setAdminAlert('Operador atualizado com sucesso.', 'success');
      await loadAdminDashboard({ silent: true });
    } catch (e) {
      console.error(e);
      setAdminAlert('Falha ao alterar operador: ' + e.message, 'error');
    }
  }

  function renderPhrases(rows = []) {
    const tbody = $('#adminPhrasesTable');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhuma frase encontrada.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((f) => {
      const ativa = String(f.status || '').toUpperCase() === 'ATIVA';
      return `<tr>
        <td>${esc(f.prioridade || '-')}</td>
        <td>${esc(f.texto || '-')}</td>
        <td><span class="status-chip ${ativa ? 'ativo' : 'inativo'}">${esc(f.status || '-')}</span></td>
        <td>${esc(f.escopo || '-')}</td>
        <td class="nowrap">
          <button class="mini-action js-copy-phrase" data-text="${esc(f.texto || '')}">Copiar</button>
          <button class="mini-action js-edit-phrase" data-id="${esc(f.id)}">Editar</button>
          <button class="mini-action js-toggle-phrase" data-id="${esc(f.id)}" data-status="${ativa ? 'INATIVA' : 'ATIVA'}">${ativa ? 'Inativar' : 'Ativar'}</button>
        </td>
      </tr>`;
    }).join('');
    $$('.js-copy-phrase', tbody).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.dataset.text || '';
        try { await navigator.clipboard.writeText(text); } catch (_) {}
        const orig = btn.textContent;
        btn.textContent = 'Copiado!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      });
    });

    $$('.js-edit-phrase', tbody).forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = state.phrasesAdmin?.find((x) => x.id === btn.dataset.id);
        if (!item) return;
        state.currentPhraseId = item.id;
        $('#phraseText').value = item.texto || '';
        $('#phraseStatus').value = item.status || 'ATIVA';
        $('#phrasePriority').value = item.prioridade || 1;
        $('#phraseFavorite').checked = !!item.is_favorite;
        $('#phraseText')?.focus();
      });
    });
    $$('.js-toggle-phrase', tbody).forEach((btn) => {
      btn.addEventListener('click', () => togglePhrase(btn.dataset.id, btn.dataset.status));
    });
  }

  async function loadAdminPhrases({ silent = false } = {}) {
    if (!state.session || !isAdminProfile()) return;
    try {
      const rows = await rpc('rhi_listar_frases_abordagem', {});
      state.phrasesAdmin = rows || [];
      renderPhrases(state.phrasesAdmin);
      const own = state.phrasesAdmin.some((f) => String(f.escopo || '').toUpperCase() === 'PLANO');
      const note = $('#phrasesNote');
      if (note) note.textContent = own ? 'Este plano está usando frases próprias.' : 'Este plano está usando frases padrão RH IMOB. Para editar, clique em Personalizar frases para este plano.';
    } catch (e) {
      console.error(e);
      if (!silent) setAdminAlert('Não foi possível carregar frases: ' + e.message, 'error');
    }
  }

  async function savePhrase() {
    try {
      const texto = normalize($('#phraseText')?.value);
      if (!texto || texto.length < 10) return setAdminAlert('Digite uma frase com pelo menos 10 caracteres.', 'warn');
      await rpc('rhi_salvar_frase_abordagem', {
        p_id: state.currentPhraseId || null,
        p_texto: texto,
        p_status: $('#phraseStatus')?.value || 'ATIVA',
        p_prioridade: Number($('#phrasePriority')?.value || 1),
        p_is_favorite: !!$('#phraseFavorite')?.checked
      });
      state.currentPhraseId = null;
      $('#phraseText').value = '';
      $('#phrasePriority').value = '';
      $('#phraseFavorite').checked = false;
      await loadAdminPhrases();
      await loadFrases();
      setAdminAlert('Frase salva com sucesso.', 'success');
    } catch (e) {
      console.error(e);
      setAdminAlert('Falha ao salvar frase: ' + e.message, 'error');
    }
  }

  async function togglePhrase(id, statusValue) {
    if (!id) return;
    try {
      await rpc('rhi_alterar_status_frase_abordagem', { p_id: id, p_status: statusValue });
      await loadAdminPhrases();
      await loadFrases();
      setAdminAlert('Status da frase atualizado.', 'success');
    } catch (e) {
      console.error(e);
      setAdminAlert('Falha ao alterar status da frase: ' + e.message, 'error');
    }
  }

  async function clonePhrases() {
    if (!confirm('Personalizar frases para este plano? As frases padrão serão copiadas para edição deste cliente.')) return;
    try {
      const res = await rpc('rhi_clonar_frases_padrao_para_plano', {});
      await loadAdminPhrases();
      await loadFrases();
      setAdminAlert(`Frases personalizadas para o plano. Clonadas: ${res?.clonadas ?? 0}.`, 'success');
    } catch (e) {
      console.error(e);
      setAdminAlert('Falha ao personalizar frases: ' + e.message, 'error');
    }
  }

  function clearPhraseForm() {
    state.currentPhraseId = null;
    if ($('#phraseText')) $('#phraseText').value = '';
    if ($('#phraseStatus')) $('#phraseStatus').value = 'ATIVA';
    if ($('#phrasePriority')) $('#phrasePriority').value = '';
    if ($('#phraseFavorite')) $('#phraseFavorite').checked = false;
  }

  // ── ABORDADOS CORRETORES ────────────────────────────────────────────────────

  const COR_STATUS_LABELS = {
    ABORDADO:         'Abordado',
    TEM_INTERESSE:    'Tem interesse',
    CHAMAR_NOVAMENTE: 'Chamar novamente',
    AGENDADO:         'Agendado',
    REAGENDAR:        'Reagendar',
    REUNIAO_OK:       'Reunião OK',
    DECLINOU:         'Declinou',
    INICIOU:          'Iniciou',
  };

  const COR_STATUS_ORDER = Object.keys(COR_STATUS_LABELS);
  const COR_STATUS_COM_DATA = new Set(['AGENDADO', 'REAGENDAR']);

  function getCorSupabaseClient() {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Cliente Supabase não disponível.');
    return sb;
  }

  function ultimosDigitosCOR(tel, n = 5) {
    const d = String(tel || '').replace(/\D/g, '');
    return d.length >= n ? `*${d.slice(-n)}` : (d || '');
  }

  async function registrarAbordagemCOR(lead) {
    if (!state.session || !state.profile) return;
    const client = getCorSupabaseClient();
    const usuario_id = state.session.user?.id;
    const conta_id = state.profile?.conta_id;
    if (!usuario_id || !conta_id) return;
    const tel = lead.telefone_txt || lead.telefone_base || '';
    const historico = [{ status: 'ABORDADO', em: new Date().toISOString() }];
    const { error } = await client.from('cor_abordagens').upsert({
      lead_key: lead.lead_key,
      usuario_id,
      conta_id,
      status: 'ABORDADO',
      nome_display: lead.nome_completo || lead.nome_mascarado || lead.lead_key,
      telefone_display: String(tel).replace(/\D/g, ''),
      historico,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lead_key,usuario_id,conta_id', ignoreDuplicates: true });
    if (error) console.warn('[COR] registrar abordagem:', error);
    if (state.abordadosVisible) loadAbordadosCOR();
  }

  async function atualizarStatusAbordagemCOR(id, novoStatus, agendadoEm, historicoAtual) {
    const client = getCorSupabaseClient();
    const patch = { updated_at: new Date().toISOString() };
    if (novoStatus) {
      patch.status = novoStatus;
      const arr = Array.isArray(historicoAtual) ? historicoAtual : [];
      patch.historico = [...arr, { status: novoStatus, em: new Date().toISOString() }];
    }
    if (agendadoEm) patch.agendado_em = agendadoEm;
    const { error } = await client.from('cor_abordagens').update(patch).eq('id', id);
    if (error) throw error;
  }

  async function loadAbordadosCOR() {
    const client = getCorSupabaseClient();
    const usuario_id = state.session?.user?.id;
    if (!usuario_id) return;
    const statusFiltro = $('#abordadosStatusFiltro')?.value || '';
    let query = client
      .from('cor_abordagens')
      .select('id,lead_key,nome_display,telefone_display,status,agendado_em,historico,created_at,updated_at')
      .eq('usuario_id', usuario_id)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (statusFiltro) query = query.eq('status', statusFiltro);
    const { data, error } = await query;
    if (error) { console.warn('[COR] abordados:', error); return; }
    renderAbordadosCOR(data || []);
  }

  function corStatusColor(s) {
    const map = { ABORDADO:'#6d2df2', TEM_INTERESSE:'#1a6640', CHAMAR_NOVAMENTE:'#7a5500',
      AGENDADO:'#4b178b', REAGENDAR:'#c05000', REUNIAO_OK:'#0d5530', DECLINOU:'#a33', INICIOU:'#2b124d' };
    return map[s] || '#999';
  }

  function buildWaConfirmacaoCOR(r) {
    const frase = state.profile?.frase_agendamento ||
      '{saudacao_completa}, {primeiro_nome}! Tudo bem? Meu nome é {operador}, represento a {empresa}. Estou entrando em contato para confirmar nosso agendamento.';
    const operador = state.profile?.nome || 'RH IMOB';
    const nome = r.nome_display || 'você';
    const primeiro = nome.split(' ')[0];
    const hr = new Date().getHours();
    const saudacao = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
    const msg = frase
      .replace(/\{saudacao_completa\}/gi, saudacao)
      .replace(/\{primeiro_nome\}/gi, primeiro)
      .replace(/\{nome\}/gi, nome)
      .replace(/\{operador\}/gi, operador)
      .replace(/\{empresa\}/gi, 'RH IMOB');
    const tel = String(r.telefone_display || '').replace(/\D/g, '');
    if (!tel || tel.length < 5) return '';
    const url = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
    return `<a class="btn btn-primary nt-wa-confirm" href="${esc(url)}" target="_blank" rel="noopener">📱 Confirmar agendamento via WhatsApp</a>`;
  }

  function renderAbordadosCOR(rows) {
    const container = $('#abordadosLista');
    if (!container) return;
    const count = $('#abordadosCount');
    if (count) count.textContent = `${rows.length} registro(s)`;
    if (!rows.length) {
      container.innerHTML = '<p class="nt-abordados-vazio">Nenhum abordado encontrado.</p>';
      return;
    }
    const isMaster = isAdminProfile();
    container.innerHTML = rows.map((r) => {
      const label = COR_STATUS_LABELS[r.status] || r.status;
      const temData = COR_STATUS_COM_DATA.has(r.status);
      const agendadoStr = r.agendado_em ? new Date(r.agendado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
      const historico = Array.isArray(r.historico) ? r.historico : [];
      const historicoHtml = historico.map((h) =>
        `<span class="nt-hist-item"><span class="nt-hist-dot" style="background:${corStatusColor(h.status)}"></span>${esc(COR_STATUS_LABELS[h.status] || h.status)} <em>${h.em ? new Date(h.em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''}</em></span>`
      ).join('');
      const nome = r.nome_display || r.lead_key;
      const telNum = String(r.telefone_display || '').replace(/\D/g, '');
      const tel = telNum ? ` · ${esc(telNum)}` : '';
      const waBtn = isMaster && r.agendado_em && r.status === 'AGENDADO' ? buildWaConfirmacaoCOR(r) : '';
      const botoesStatus = COR_STATUS_ORDER.filter((s) => s !== r.status).map((s) =>
        `<button class="mini-action js-cor-status" data-id="${esc(r.id)}" data-status="${esc(s)}" data-historico='${JSON.stringify(historico)}'>${esc(COR_STATUS_LABELS[s])}</button>`
      ).join('');
      return `<div class="nt-abordado-card" data-id="${esc(r.id)}">
        <div class="nt-abordado-top">
          <span class="nt-abordado-nome">${esc(nome)}${tel}</span>
          <span class="nt-abordado-status nt-abordado-status--${r.status.toLowerCase().replace(/_/g,'-')}">${esc(label)}</span>
        </div>
        ${historicoHtml ? `<div class="nt-historico">${historicoHtml}</div>` : ''}
        ${agendadoStr ? `<div class="nt-abordado-agendado-info">📅 Agendado: <strong>${agendadoStr}</strong></div>` : ''}
        ${temData ? `<div class="nt-abordado-agenda">
          <input type="datetime-local" class="js-cor-agenda-dt" data-id="${esc(r.id)}" value="${r.agendado_em ? r.agendado_em.slice(0,16) : ''}" />
          <button class="mini-action js-cor-salvar-agenda" data-id="${esc(r.id)}">Salvar data</button>
        </div>` : ''}
        ${waBtn}
        <div class="nt-abordado-acoes">${botoesStatus}</div>
      </div>`;
    }).join('');

    container.querySelectorAll('.js-cor-status').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { id, status } = btn.dataset;
        let historico = [];
        try { historico = JSON.parse(btn.dataset.historico || '[]'); } catch (_) {}
        try {
          await atualizarStatusAbordagemCOR(id, status, null, historico);
          await loadAbordadosCOR();
        } catch (err) { alert('Erro ao atualizar status.'); }
      });
    });

    container.querySelectorAll('.js-cor-salvar-agenda').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { id } = btn.dataset;
        const dt = container.querySelector(`.js-cor-agenda-dt[data-id="${id}"]`)?.value;
        if (!dt) { alert('Selecione uma data e hora.'); return; }
        try {
          await atualizarStatusAbordagemCOR(id, null, new Date(dt).toISOString(), []);
          await loadAbordadosCOR();
        } catch (err) { alert('Erro ao salvar data.'); }
      });
    });
  }

  function showAbordadosCOR(show) {
    const section = $('#abordadosPanel');
    if (section) section.hidden = !show;
    state.abordadosVisible = show;
    if (show) loadAbordadosCOR();
  }

  // ── FIM ABORDADOS CORRETORES ────────────────────────────────────────────────

  // ── FUNIL GESTOR CORRETORES ─────────────────────────────────────────────────

  const COR_FUNIL_ORDEM = [
    { key: 'ABORDADO',         label: 'Abordados',        cor: '#6d2df2' },
    { key: 'TEM_INTERESSE',    label: 'Interesse',         cor: '#1a6640' },
    { key: 'CHAMAR_NOVAMENTE', label: 'Chamar novamente',  cor: '#7a5500' },
    { key: 'AGENDADO',         label: 'Agendados',         cor: '#4b178b' },
    { key: 'REAGENDAR',        label: 'Reagendar',         cor: '#c05000' },
    { key: 'REUNIAO_OK',       label: 'Reunião OK',        cor: '#0d5530' },
    { key: 'DECLINOU',         label: 'Declinou',          cor: '#a33333' },
    { key: 'INICIOU',          label: 'Iniciou',           cor: '#2b124d' },
  ];

  async function loadFunilGestorCOR() {
    const box = $('#funilBox');
    if (!box) return;
    box.hidden = false;
    try {
      const data = await rpc('cor_abordagens_painel_v1', {});
      const parsed = typeof data === 'string' ? JSON.parse(data) : (Array.isArray(data) ? data[0] : data);
      renderFunilGestorCOR(parsed || {});
    } catch (err) {
      console.warn('[COR] funil gestor:', err);
    }
  }

  function renderFunilGestorCOR(data) {
    const funil      = Array.isArray(data.funil)        ? data.funil        : [];
    const operadores = Array.isArray(data.por_operador) ? data.por_operador : [];
    const agendamentos = Array.isArray(data.agendamentos) ? data.agendamentos : [];
    const timeline   = Array.isArray(data.timeline)     ? data.timeline     : [];

    const totalGeral = funil.reduce((s, r) => s + Number(r.total || 0), 0);
    const funilTotal = $('#funilTotal');
    if (funilTotal) funilTotal.textContent = `${totalGeral} abordagens registradas`;

    const grid = $('#funilGrid');
    if (grid) {
      const map = Object.fromEntries(funil.map((r) => [r.status, Number(r.total || 0)]));
      const max = Math.max(...COR_FUNIL_ORDEM.map((f) => map[f.key] || 0), 1);
      grid.innerHTML = COR_FUNIL_ORDEM.map(({ key, label, cor }) => {
        const val = map[key] || 0;
        const pct = Math.round((val / max) * 100);
        return `<div class="nt-funil-item">
          <div class="nt-funil-bar-wrap">
            <div class="nt-funil-bar" style="width:${pct}%;background:${cor}"></div>
          </div>
          <span class="nt-funil-label">${esc(label)}</span>
          <strong class="nt-funil-val">${val}</strong>
        </div>`;
      }).join('');
    }

    const tbody = $('#funilOperadoresTable');
    if (tbody) {
      tbody.innerHTML = operadores.length
        ? operadores.map((r) => `<tr>
            <td>${esc(r.nome || r.email || 'Operador')}</td>
            <td>${r.abordados || 0}</td>
            <td>${r.interesse || 0}</td>
            <td>${r.agendados || 0}</td>
            <td>${r.reuniao_ok || 0}</td>
            <td><strong>${r.iniciou || 0}</strong></td>
            <td>${r.declinou || 0}</td>
          </tr>`).join('')
        : '<tr><td colspan="7">Nenhum registro ainda.</td></tr>';
    }

    const tbodyAg = $('#funilAgendamentosTable');
    if (tbodyAg) {
      tbodyAg.innerHTML = agendamentos.length
        ? agendamentos.map((r) => {
            const dt = r.agendado_em ? new Date(r.agendado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-';
            return `<tr>
              <td>${esc(dt)}</td>
              <td>${esc(r.operador_nome || '-')}</td>
              <td>${esc(r.lead_key || '-')}</td>
              <td>${esc(COR_STATUS_LABELS[r.status] || r.status)}</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="4">Nenhum agendamento futuro.</td></tr>';
    }

    const tl = $('#funilTimeline');
    if (tl && timeline.length) {
      const maxTl = Math.max(...timeline.map((d) => Number(d.total || 0)), 1);
      tl.innerHTML = `<div class="nt-timeline-bars">
        ${timeline.map((d) => {
          const h = Math.max(Math.round((Number(d.total) / maxTl) * 80), 4);
          const dia = d.dia ? new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '';
          return `<div class="nt-tl-col" title="${dia}: ${d.total}">
            <div class="nt-tl-bar" style="height:${h}px"></div>
            <span class="nt-tl-label">${dia}</span>
          </div>`;
        }).join('')}
      </div>`;
    } else if (tl) {
      tl.innerHTML = '<p class="nt-abordados-vazio">Nenhuma abordagem nos últimos 30 dias.</p>';
    }
  }

  // ── FIM FUNIL GESTOR CORRETORES ─────────────────────────────────────────────

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
      state = { ...state, city: '', year: '', cargo: '', term: '', offset: 0, loading: false };
      cidade.value = '';
      termo.value = '';
      await loadYears('');
      await search();
    });

    $('#maisBtn').addEventListener('click', () => search({ append: true }));
    $('#adminRefreshBtn')?.addEventListener('click', () => loadAdminDashboard());
    $('#funilRefreshBtn')?.addEventListener('click', () => loadFunilGestorCOR());
    $('#exportCsvBtn')?.addEventListener('click', exportAdminCSV);
    $('#clonePhrasesBtn')?.addEventListener('click', clonePhrases);
    $('#usersFilterStatus')?.addEventListener('change', filterAdminUsers);
    $('#phraseText')?.addEventListener('input', () => {
      updatePhrasePreview();
      const counter = $('#phraseCharCount');
      if (counter) counter.textContent = ($('#phraseText')?.value || '').length;
    });
    ['recentFilterOp', 'recentFilterDe', 'recentFilterAte'].forEach((id) => {
      $('#' + id)?.addEventListener('input', filterRecentTable);
    });
    $('#recentFilterClear')?.addEventListener('click', () => {
      ['recentFilterOp', 'recentFilterDe', 'recentFilterAte'].forEach((id) => {
        const el = $('#' + id);
        if (el) el.value = '';
      });
      renderAdminRecent(state.adminRecent || []);
      const count = $('#adminRecentCount');
      if (count) count.textContent = `${(state.adminRecent || []).length} registro(s) recentes`;
    });
    $('#savePhraseBtn')?.addEventListener('click', savePhrase);
    $('#newPhraseBtn')?.addEventListener('click', clearPhraseForm);

    $('#abordadosToggleBtn')?.addEventListener('click', () => {
      showAbordadosCOR(!state.abordadosVisible);
    });
    $('#abordadosStatusFiltro')?.addEventListener('change', loadAbordadosCOR);
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
      $('#cardsGrid').innerHTML = `<div class="error">Não foi possível carregar a consulta agora. ${esc(e.message)}</div>`;
      status('Falha ao carregar dados públicos.');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
