(() => {
  const cfg = window.RHIMOB_SUPABASE_CONFIG || {};
  const PAGE_SIZE = 24;

  let sb = null;

  const state = {
    session: null,
    context: null,
    frases: [],
    filters: {
      cidade: '',
      estado_uf: '',
      faixa_idade: '',
      cargo: '',
      estacao: '',
      termo: ''
    },
    offset: 0,
    total: 0,
    loading: false,
    currentTalent: null
  };

  const DEFAULT_FRASE = '{saudacao_completa}, {primeiro_nome}. Aqui é {operador}. Temos uma oportunidade comercial em {cidade} e seu perfil apareceu em uma busca próxima da nossa operação. Se fizer sentido, te passo os detalhes por aqui.';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function onlyDigits(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function getClient() {
    if (sb) return sb;
    if (!window.supabase || !cfg.url || !cfg.publishableKey) return null;
    sb = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return sb;
  }

  function restUrl(path, params = {}) {
    const base = String(cfg.url || '').replace(/\/+$/, '');
    const url = new URL(`${base}/rest/v1/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function token() {
    return state.session?.access_token || cfg.publishableKey;
  }

  async function api(path, params = {}) {
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) {
      throw new Error('Configuração da plataforma indisponível.');
    }

    const res = await fetch(restUrl(path, params), {
      headers: {
        apikey: cfg.publishableKey,
        Authorization: `Bearer ${token()}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const raw = await res.text();
      throw new Error(`Falha na consulta. Código ${res.status}: ${raw.slice(0, 300)}`);
    }

    return res.json();
  }

  async function rpc(fn, payload = {}) {
    if (!state.session?.access_token) throw new Error('Faça login para continuar.');
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
      let msg = raw;
      try {
        const parsed = JSON.parse(raw);
        msg = parsed.message || parsed.details || raw;
      } catch (_) {}
      throw new Error(msg);
    }

    return res.json();
  }

  function setText(id, value) {
    const el = $('#' + id);
    if (el) el.textContent = value == null || value === '' ? '-' : String(value);
  }

  function formatNumber(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '-';
  }

  function firstName(value) {
    const txt = normalize(value);
    return txt.split(' ')[0] || 'Profissional';
  }

  function saudacao() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function openLoginModal() {
    const modal = $('#loginModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('nt-modal-open');
    setTimeout(() => $('#loginEmail')?.focus(), 50);
  }

  function closeLoginModal() {
    const modal = $('#loginModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nt-modal-open');
  }

  function openTalentModal() {
    const modal = $('#talentoModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('nt-modal-open');
  }

  function closeTalentModal() {
    const modal = $('#talentoModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nt-modal-open');
    state.currentTalent = null;
    search(true);
  }

  function setLoginMessage(message, type = '') {
    const el = $('#loginMessage');
    if (!el) return;
    el.textContent = message || '';
    el.className = `nt-form-message ${type}`.trim();
  }

  function showWorkspace(show) {
    const workspace = $('#workspace');
    const warn = $('#loginWarning');
    if (workspace) workspace.hidden = !show;
    if (warn) warn.hidden = show;
  }

  function updateHeader() {
    const logged = !!state.session && !!state.context;
    const sessionBox = $('#sessionBox');
    const loginBtn = $('#openLoginBtn');

    if (sessionBox) sessionBox.hidden = !logged;
    if (loginBtn) loginBtn.hidden = logged;

    if (logged) {
      setText('sessionName', `${state.context.nome || 'Usuário'} • ${state.context.perfil || 'Acesso'}`);
    }
  }

  function updateSummary() {
    const ctx = state.context;
    if (!ctx) {
      setText('summaryConta', 'Acesso contratado');
      setText('summaryPlano', 'Entre para carregar seu plano');
      setText('summaryStatus', 'Protegido');
      setText('metricSaldo', '-');
      setText('metricUsados', '-');
      setText('metricLimite', '-');
      setText('summaryText', 'Nenhum telefone ou e-mail é exibido antes do login e da liberação do contato.');
      setText('saldoStatus', 'Saldo do plano: -');
      return;
    }

    setText('summaryConta', ctx.nome_conta || 'Conta ativa');
    setText('summaryPlano', `${ctx.plano_tipo || 'Plano'} • ${ctx.nome || 'Usuário'}`);
    setText('summaryStatus', ctx.perfil || 'Ativo');
    setText('metricSaldo', formatNumber(ctx.saldo));
    setText('metricUsados', formatNumber(ctx.consumidos));
    setText('metricLimite', formatNumber(ctx.limite_total));
    setText('summaryText', 'A liberação de contato consome saldo apenas da sua conta.');
    setText('saldoStatus', `Saldo do plano: ${formatNumber(ctx.saldo)} disponíveis • ${formatNumber(ctx.consumidos)} liberados`);
  }

  async function loadContext() {
    const rows = await rpc('nt_app_context', {});
    const ctx = rows?.[0] || null;
    if (!ctx) throw new Error('Usuário sem acesso ativo à Plataforma Novos Talentos.');
    state.context = ctx;
    updateSummary();
    updateHeader();
    showWorkspace(true);
    return ctx;
  }

  async function loadFrases() {
    state.frases = [{ texto: DEFAULT_FRASE, titulo: 'Frase padrão' }];

    try {
      const rows = await rpc('nt_listar_frases_plano', {});
      if (Array.isArray(rows) && rows.length) {
        state.frases = rows
          .map((r) => ({
            frase_id: r.frase_id,
            titulo: normalize(r.titulo) || `Frase ${r.prioridade || ''}`,
            texto: normalize(r.texto)
          }))
          .filter((r) => r.texto);
      }
    } catch (err) {
      console.warn('Frases padrão locais carregadas:', err);
    }
  }

  function option(label, value, extra = '') {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = extra ? `${label} (${extra})` : label;
    return opt;
  }

  function resetSelect(select, placeholder) {
    if (!select) return;
    select.innerHTML = '';
    select.appendChild(option(placeholder, ''));
  }

  async function loadCidadeOptions() {
    const select = $('#cidadeSelect');
    resetSelect(select, 'Todas as cidades');

    const rows = await api('nt_filtro_cidade', {
      select: 'cidade,estado_uf,total',
      order: 'cidade.asc',
      limit: '1000'
    });

    (rows || []).forEach((row) => {
      const label = `${row.cidade}/${row.estado_uf}`;
      const value = `${row.cidade}||${row.estado_uf}`;
      select.appendChild(option(label, value, formatNumber(row.total)));
    });
  }

  async function loadDependentFilters() {
    const [cidade, uf] = String($('#cidadeSelect')?.value || '').split('||');

    state.filters.cidade = cidade || '';
    state.filters.estado_uf = uf || '';

    const idadeSelect = $('#idadeSelect');
    const cargoSelect = $('#cargoSelect');
    const metroSelect = $('#metroSelect');

    resetSelect(idadeSelect, 'Todas as idades');
    resetSelect(cargoSelect, 'Todos os perfis');
    resetSelect(metroSelect, 'Todas as estações');

    const baseEq = cidade && uf ? { cidade: `eq.${cidade}`, estado_uf: `eq.${uf}` } : null;

    if (!baseEq) return;

    const [idades, cargos, metros] = await Promise.all([
      api('nt_filtro_cidade_idade', {
        select: 'faixa_idade,total',
        cidade: baseEq.cidade,
        estado_uf: baseEq.estado_uf,
        order: 'faixa_idade.asc',
        limit: '1000'
      }),
      api('nt_filtro_cidade_cargo', {
        select: 'cargo,total',
        cidade: baseEq.cidade,
        estado_uf: baseEq.estado_uf,
        order: 'total.desc',
        limit: '1000'
      }),
      api('nt_filtro_cidade_metro', {
        select: 'estacao_mais_proxima,linha_metro_mais_proxima,cor_linha_metro,total',
        cidade: baseEq.cidade,
        estado_uf: baseEq.estado_uf,
        order: 'total.desc',
        limit: '1000'
      })
    ]);

    (idades || []).forEach((row) => {
      idadeSelect.appendChild(option(row.faixa_idade, row.faixa_idade, formatNumber(row.total)));
    });

    (cargos || []).forEach((row) => {
      cargoSelect.appendChild(option(row.cargo, row.cargo, formatNumber(row.total)));
    });

    (metros || []).forEach((row) => {
      const linha = row.linha_metro_mais_proxima ? ` • ${row.linha_metro_mais_proxima}` : '';
      const label = `${row.estacao_mais_proxima}${linha}`;
      metroSelect.appendChild(option(label, row.estacao_mais_proxima, formatNumber(row.total)));
    });
  }

  function collectFilters() {
    const [cidade, uf] = String($('#cidadeSelect')?.value || '').split('||');
    state.filters = {
      cidade: cidade || '',
      estado_uf: uf || '',
      faixa_idade: normalize($('#idadeSelect')?.value),
      cargo: normalize($('#cargoSelect')?.value),
      estacao: normalize($('#metroSelect')?.value),
      termo: normalize($('#termoInput')?.value)
    };
  }

  function status(message) {
    const el = $('#resultadoStatus');
    if (el) el.textContent = message;
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
      const metro = row.estacao_mais_proxima
        ? `${esc(row.estacao_mais_proxima)}${row.linha_metro_mais_proxima ? ` • ${esc(row.linha_metro_mais_proxima)}` : ''}`
        : 'Sem estação vinculada';

      const geo = row.tem_geo ? 'Geolocalizado' : 'Sem geolocalização';
      const canal = row.tem_whatsapp ? 'WhatsApp disponível' : (row.tem_email ? 'E-mail disponível' : 'Canal limitado');
      const idade = row.faixa_idade || (row.idade_anos ? `${row.idade_anos} anos` : 'Idade não informada');

      return `
        <article class="nt-card" data-key="${esc(row.talento_key)}">
          <div class="nt-card__top">
            <div>
              <h3>${esc(row.nome_mascarado || row.primeiro_nome || 'Profissional')}</h3>
              <p>${esc(row.cargo || 'Perfil comercial')}</p>
            </div>
            <span class="nt-pill">${esc(idade)}</span>
          </div>

          <div class="nt-card__meta">
            <span>📍 ${esc([row.bairro, row.cidade, row.estado_uf].filter(Boolean).join(' • '))}</span>
            <span>🧭 ${esc([row.regiao_macro, row.micro_regiao].filter(Boolean).join(' • ') || 'Região não informada')}</span>
            <span>🚇 ${metro}</span>
          </div>

          <div class="nt-card__signals">
            <span class="nt-signal">${esc(canal)}</span>
            <span class="nt-signal ${row.tem_geo ? '' : 'muted'}">${esc(geo)}</span>
          </div>

          <button class="nt-btn nt-btn-primary js-consumir" type="button" data-key="${esc(row.talento_key)}">Ver detalhes</button>
        </article>
      `;
    }).join('');

    grid.insertAdjacentHTML('beforeend', html);

    $$('.js-consumir', grid).forEach((btn) => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => consumirTalento(btn.dataset.key, btn));
    });
  }

  async function search(reset = true) {
    if (!state.session) return;
    if (state.loading) return;

    state.loading = true;
    collectFilters();

    if (reset) {
      state.offset = 0;
      state.total = 0;
      $('#cardsGrid').innerHTML = '';
    }

    const btn = $('#buscarBtn');
    if (btn) btn.textContent = 'Buscando...';
    status('Consultando talentos disponíveis...');

    try {
      const rows = await rpc('nt_listar_talentos', {
        p_cidade: state.filters.cidade || null,
        p_estado_uf: state.filters.estado_uf || null,
        p_faixa_idade: state.filters.faixa_idade || null,
        p_cargo: state.filters.cargo || null,
        p_estacao: state.filters.estacao || null,
        p_termo: state.filters.termo || null,
        p_limit: PAGE_SIZE,
        p_offset: state.offset
      });

      const list = Array.isArray(rows) ? rows : [];
      state.total = Number(list[0]?.total_count || state.total || 0);
      renderCards(list, !reset);
      state.offset += list.length;

      const more = $('#maisBtn');
      if (more) more.hidden = state.offset >= state.total || !list.length;

      status(`${formatNumber(state.total)} talentos disponíveis para os filtros atuais. Exibindo ${formatNumber(Math.min(state.offset, state.total))}.`);
    } catch (err) {
      console.error(err);
      status('Não foi possível consultar agora. Verifique o acesso e as funções SQL da Etapa 4.');
      $('#cardsGrid').innerHTML = `<div class="nt-empty">${esc(err.message || err)}</div>`;
    } finally {
      state.loading = false;
      if (btn) btn.textContent = 'Buscar';
    }
  }

  async function consumirTalento(key, button) {
    if (!key) return;
    if (!state.session) {
      openLoginModal();
      return;
    }

    const original = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Liberando...';
    }

    try {
      const rows = await rpc('nt_consumir_talento', { p_talento_key: key });
      const talent = rows?.[0];

      if (!talent) throw new Error('Contato não encontrado.');

      state.currentTalent = talent;
      await loadContext();
      renderTalentModal(talent);
      openTalentModal();
    } catch (err) {
      alert(err.message || 'Não foi possível liberar o contato.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = original || 'Ver detalhes';
      }
    }
  }

  function detail(label, value) {
    return `<div class="nt-detail"><small>${esc(label)}</small><strong>${esc(value || '-')}</strong></div>`;
  }

  function renderTalentModal(talent) {
    setText('talentoTitle', talent.nome_completo || talent.primeiro_nome || 'Contato completo');

    const used = talent.consumido_agora
      ? 'Este contato foi liberado agora para sua conta.'
      : 'Este contato já estava liberado para sua conta.';

    setText('talentoSubtitle', `${used} Saldo restante: ${formatNumber(talent.saldo_restante)}.`);

    const grid = $('#talentoDetalhes');
    if (grid) {
      grid.innerHTML = [
        detail('Nome', talent.nome_completo),
        detail('Cargo', talent.cargo),
        detail('WhatsApp', talent.whatsapp || talent.telefone_principal),
        detail('E-mail', talent.email),
        detail('Cidade', [talent.cidade, talent.estado_uf].filter(Boolean).join('/')),
        detail('Bairro', talent.bairro),
        detail('Idade', talent.idade_anos ? `${talent.idade_anos} anos` : talent.faixa_idade),
        detail('Pretensão', talent.pretensao_salarial),
        detail('Metrô próximo', [talent.estacao_mais_proxima, talent.linha_metro_mais_proxima].filter(Boolean).join(' • ')),
        detail('Distância metrô', talent.distancia_metro_km ? `${talent.distancia_metro_km} km` : ''),
        detail('Região', [talent.regiao_macro, talent.micro_regiao].filter(Boolean).join(' • ')),
        detail('CEP', talent.cep)
      ].join('');
    }

    renderFrases(talent);
  }

  function renderFrases(talent) {
    const select = $('#fraseSelect');
    if (!select) return;

    select.innerHTML = '';
    state.frases.forEach((frase, index) => {
      select.appendChild(option(frase.titulo || `Frase ${index + 1}`, String(index)));
    });

    select.value = '0';
    updateMensagem(talent);

    select.onchange = () => updateMensagem(talent);
  }

  function preencherMensagem(template, talent) {
    const operador = state.context?.nome || 'RH IMOB';
    const empresa = state.context?.nome_conta || 'RH IMOB';
    const primeiro = talent.primeiro_nome || firstName(talent.nome_completo);

    return String(template || DEFAULT_FRASE)
      .replaceAll('{saudacao_completa}', saudacao())
      .replaceAll('{saudacao}', saudacao())
      .replaceAll('{primeiro_nome}', primeiro)
      .replaceAll('{primeiroNome}', primeiro)
      .replaceAll('{nome}', primeiro)
      .replaceAll('{operador}', operador)
      .replaceAll('{Usuário}', operador)
      .replaceAll('{empresa}', empresa)
      .replaceAll('{cidade}', talent.cidade || 'sua região')
      .replace(/\s+\n/g, '\n')
      .trim();
  }

  function updateMensagem(talent) {
    const select = $('#fraseSelect');
    const idx = Number(select?.value || 0);
    const frase = state.frases[idx]?.texto || DEFAULT_FRASE;
    const msg = preencherMensagem(frase, talent);

    const area = $('#mensagemTextarea');
    if (area) area.value = msg;

    const phone = onlyDigits(talent.whatsapp || talent.telefone_principal);
    const link = $('#abrirWhatsappBtn');
    if (link) {
      if (phone.length >= 10) {
        link.href = `https://wa.me/55${phone.replace(/^55/, '')}?text=${encodeURIComponent(msg)}`;
        link.removeAttribute('aria-disabled');
      } else {
        link.href = '#';
        link.setAttribute('aria-disabled', 'true');
      }
    }
  }

  async function copyMessage() {
    const text = $('#mensagemTextarea')?.value || '';
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      alert('Mensagem copiada.');
    } catch (_) {
      $('#mensagemTextarea')?.select();
      document.execCommand('copy');
      alert('Mensagem copiada.');
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const client = getClient();
    if (!client) {
      setLoginMessage('Configuração da plataforma indisponível.', 'error');
      return;
    }

    const email = normalize($('#loginEmail')?.value).toLowerCase();
    const password = $('#loginPassword')?.value || '';
    const submit = $('#loginSubmitBtn');

    if (!email || !password) {
      setLoginMessage('Preencha e-mail e senha.', 'error');
      return;
    }

    try {
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Entrando...';
      }

      setLoginMessage('Validando acesso...', '');

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      state.session = data.session;
      await loadContext();
      await loadFrases();
      await loadCidadeOptions();
      await loadDependentFilters();

      closeLoginModal();
      setLoginMessage('', '');
      await search(true);
    } catch (err) {
      console.error(err);
      setLoginMessage(err.message || 'Não foi possível entrar.', 'error');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Entrar';
      }
    }
  }

  async function logout() {
    const client = getClient();
    if (client) await client.auth.signOut();

    state.session = null;
    state.context = null;
    state.offset = 0;
    state.total = 0;

    updateHeader();
    updateSummary();
    showWorkspace(false);

    const grid = $('#cardsGrid');
    if (grid) grid.innerHTML = '';
  }

  async function restoreSession() {
    const client = getClient();
    if (!client) {
      showWorkspace(false);
      return;
    }

    const { data } = await client.auth.getSession();
    state.session = data.session || null;

    if (!state.session) {
      showWorkspace(false);
      updateHeader();
      updateSummary();
      return;
    }

    try {
      await loadContext();
      await loadFrases();
      await loadCidadeOptions();
      await loadDependentFilters();
      await search(true);
    } catch (err) {
      console.warn(err);
      await logout();
    }
  }

  function setupEvents() {
    ['openLoginBtn', 'heroLoginBtn', 'warningLoginBtn'].forEach((id) => {
      $('#' + id)?.addEventListener('click', openLoginModal);
    });

    $$('[data-close-login]').forEach((el) => el.addEventListener('click', closeLoginModal));
    $$('[data-close-talento]').forEach((el) => el.addEventListener('click', closeTalentModal));

    $('#logoutBtn')?.addEventListener('click', logout);
    $('#loginForm')?.addEventListener('submit', handleLogin);

    $('#togglePassword')?.addEventListener('click', () => {
      const input = $('#loginPassword');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    $('#cidadeSelect')?.addEventListener('change', async () => {
      await loadDependentFilters();
      await search(true);
    });

    ['idadeSelect', 'cargoSelect', 'metroSelect'].forEach((id) => {
      $('#' + id)?.addEventListener('change', () => search(true));
    });

    $('#termoInput')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') search(true);
    });

    $('#buscarBtn')?.addEventListener('click', () => search(true));
    $('#maisBtn')?.addEventListener('click', () => search(false));

    $('#limparBtn')?.addEventListener('click', async () => {
      $('#cidadeSelect').value = '';
      $('#termoInput').value = '';
      await loadDependentFilters();
      $('#idadeSelect').value = '';
      $('#cargoSelect').value = '';
      $('#metroSelect').value = '';
      await search(true);
    });

    $('#copiarMensagemBtn')?.addEventListener('click', copyMessage);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeLoginModal();
        closeTalentModal();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    setText('year', new Date().getFullYear());
    setupEvents();
    updateHeader();
    updateSummary();

    await restoreSession();
  });
})();
