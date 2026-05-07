(() => {
  // RH IMOB • Novos Talentos v5
  // Supabase separado + prévia pública + filtros completos.
  const EMBEDDED_NT_CONFIG = {
    enabled: true,
    url: 'https://tnzmxpoxvdlckmjwdala.supabase.co',
    publishableKey: 'sb_publishable_C_KCEs0Kd_l6NoDOFPmNOA_qBuyIxSv'
  };

  const rawCfg = window.RHIMOB_NOVOS_TALENTOS_SUPABASE_CONFIG || EMBEDDED_NT_CONFIG;
  const cfg = {
    url: rawCfg.url || rawCfg.supabaseUrl || rawCfg.SUPABASE_URL || '',
    publishableKey: rawCfg.publishableKey || rawCfg.anonKey || rawCfg.supabaseAnonKey || rawCfg.SUPABASE_ANON_KEY || '',
    enabled: rawCfg.enabled !== false
  };

  const PAGE_SIZE = 24;
  let sb = null;

  const state = {
    session: null,
    context: null,
    frases: [],
    filters: {
      cidade: '',
      estado_uf: '',
      regiao_macro: '',
      micro_regiao: '',
      bairro: '',
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

  function friendlyError(error) {
    const raw = String(error && error.message ? error.message : error || '');

    if (
      raw.includes('Could not find the table') ||
      raw.includes('Could not find the function') ||
      raw.includes('schema cache') ||
      raw.includes('PGRST202') ||
      raw.includes('PGRST204') ||
      raw.includes('PGRST205')
    ) {
      return 'A prévia da Plataforma Novos Talentos ainda não está disponível neste ambiente. Rode o SQL de ativação da V5 no Supabase correto e atualize a página.';
    }

    if (
      raw.toLowerCase().includes('permission') ||
      raw.toLowerCase().includes('not authorized') ||
      raw.toLowerCase().includes('row-level security')
    ) {
      return 'A prévia protegida ainda não foi liberada para consulta. Fale com o suporte para ativar a visualização inicial.';
    }

    if (
      raw.toLowerCase().includes('failed to fetch') ||
      raw.toLowerCase().includes('network') ||
      raw.toLowerCase().includes('load failed')
    ) {
      return 'Não foi possível carregar a plataforma agora. Verifique sua conexão e atualize a página.';
    }

    return 'Não foi possível carregar a prévia neste momento. Atualize a página ou fale com o suporte.';
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

  async function rpc(fn, payload = {}, requireLogin = false) {
    if (requireLogin && !state.session?.access_token) {
      throw new Error('Faça login para continuar.');
    }

    const base = String(cfg.url || '').replace(/\/+$/, '');
    const token = state.session?.access_token || cfg.publishableKey;

    const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: cfg.publishableKey,
        Authorization: `Bearer ${token}`,
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
    return normalize(value).split(' ')[0] || 'Profissional';
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
      setText('summaryConta', 'Prévia pública protegida');
      setText('summaryPlano', 'Entre para liberar contatos');
      setText('summaryStatus', 'Prévia');
      setText('metricSaldo', 'Login');
      setText('metricUsados', 'Prévia');
      setText('metricLimite', 'Plano');
      setText('summaryText', 'Você pode consultar perfis públicos protegidos. Telefone, e-mail e mensagem só aparecem após login e consumo do plano.');
      setText('saldoStatus', 'Prévia pública: detalhes liberados somente com login.');
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
    const rows = await rpc('nt_app_context', {}, true);
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
      const rows = await rpc('nt_listar_frases_plano', {}, true);
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
    opt.value = value || '';
    opt.textContent = extra ? `${label} (${extra})` : label;
    return opt;
  }

  function resetSelect(select, placeholder) {
    if (!select) return;
    select.innerHTML = '';
    select.appendChild(option(placeholder, ''));
  }

  function fillOptions(select, rows, tipo, placeholder) {
    resetSelect(select, placeholder);
    (rows || [])
      .filter((row) => row.tipo === tipo && normalize(row.valor))
      .forEach((row) => {
        select.appendChild(option(row.label || row.valor, row.valor, formatNumber(row.total)));
      });
  }

  async function loadAllFilterOptions() {
    const rows = await rpc('nt_opcoes_publicas_v2', {
      p_cidade: state.filters.cidade || null,
      p_estado_uf: state.filters.estado_uf || null,
      p_regiao_macro: state.filters.regiao_macro || null,
      p_micro_regiao: state.filters.micro_regiao || null,
      p_bairro: state.filters.bairro || null
    }, false);

    fillOptions($('#cidadeSelect'), rows, 'cidade', 'Todas as cidades');
    fillOptions($('#regiaoSelect'), rows, 'regiao_macro', 'Todas as regiões');
    fillOptions($('#microSelect'), rows, 'micro_regiao', 'Todas as micro regiões');
    fillOptions($('#bairroSelect'), rows, 'bairro', 'Todos os bairros');
    fillOptions($('#idadeSelect'), rows, 'faixa_idade', 'Todas as idades');
    fillOptions($('#cargoSelect'), rows, 'cargo', 'Todos os perfis');
    fillOptions($('#metroSelect'), rows, 'metro', 'Todas as estações');
  }

  async function refreshDependentOptions() {
    const current = {
      cidade: $('#cidadeSelect')?.value || '',
      regiao: $('#regiaoSelect')?.value || '',
      micro: $('#microSelect')?.value || '',
      bairro: $('#bairroSelect')?.value || '',
      idade: $('#idadeSelect')?.value || '',
      cargo: $('#cargoSelect')?.value || '',
      metro: $('#metroSelect')?.value || ''
    };

    collectFilters();

    const rows = await rpc('nt_opcoes_publicas_v2', {
      p_cidade: state.filters.cidade || null,
      p_estado_uf: state.filters.estado_uf || null,
      p_regiao_macro: state.filters.regiao_macro || null,
      p_micro_regiao: state.filters.micro_regiao || null,
      p_bairro: state.filters.bairro || null
    }, false);

    const selects = [
      ['regiaoSelect', 'regiao_macro', 'Todas as regiões', current.regiao],
      ['microSelect', 'micro_regiao', 'Todas as micro regiões', current.micro],
      ['bairroSelect', 'bairro', 'Todos os bairros', current.bairro],
      ['idadeSelect', 'faixa_idade', 'Todas as idades', current.idade],
      ['cargoSelect', 'cargo', 'Todos os perfis', current.cargo],
      ['metroSelect', 'metro', 'Todas as estações', current.metro]
    ];

    selects.forEach(([id, tipo, placeholder, oldValue]) => {
      const select = $('#' + id);
      fillOptions(select, rows, tipo, placeholder);
      if ([...select.options].some((o) => o.value === oldValue)) select.value = oldValue;
    });
  }

  function collectFilters() {
    const [cidade, uf] = String($('#cidadeSelect')?.value || '').split('||');
    state.filters = {
      cidade: cidade || '',
      estado_uf: uf || '',
      regiao_macro: normalize($('#regiaoSelect')?.value),
      micro_regiao: normalize($('#microSelect')?.value),
      bairro: normalize($('#bairroSelect')?.value),
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
      const canal = row.tem_whatsapp ? 'WhatsApp disponível' : (row.tem_email ? 'E-mail disponível' : 'Canal protegido');
      const idade = row.faixa_idade || (row.idade_anos ? `${row.idade_anos} anos` : 'Idade não informada');
      const regiao = [row.regiao_macro_ui || row.regiao_macro, row.micro_regiao_ui || row.micro_regiao].filter(Boolean).join(' • ');

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
            <span class="nt-region-line">🧭 ${esc(regiao || 'Região em classificação')}</span>
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
      const rows = await rpc('nt_listar_talentos_publico_v2', {
        p_cidade: state.filters.cidade || null,
        p_estado_uf: state.filters.estado_uf || null,
        p_regiao_macro: state.filters.regiao_macro || null,
        p_micro_regiao: state.filters.micro_regiao || null,
        p_bairro: state.filters.bairro || null,
        p_faixa_idade: state.filters.faixa_idade || null,
        p_cargo: state.filters.cargo || null,
        p_estacao: state.filters.estacao || null,
        p_termo: state.filters.termo || null,
        p_limit: PAGE_SIZE,
        p_offset: state.offset
      }, false);

      const list = Array.isArray(rows) ? rows : [];
      state.total = Number(list[0]?.total_count || state.total || 0);
      renderCards(list, !reset);
      state.offset += list.length;

      const more = $('#maisBtn');
      if (more) more.hidden = state.offset >= state.total || !list.length;

      status(`${formatNumber(state.total)} talentos disponíveis para os filtros atuais. Exibindo ${formatNumber(Math.min(state.offset, state.total))}.`);
    } catch (err) {
      console.error(err);
      const msg = friendlyError(err);
      status(msg);
      $('#cardsGrid').innerHTML = `<div class="nt-empty">${esc(msg)}</div>`;
    } finally {
      state.loading = false;
      if (btn) btn.textContent = 'Buscar';
    }
  }

  async function consumirTalento(key, button) {
    if (!key) return;
    if (!state.session) {
      setLoginMessage('Entre com seu acesso contratado para liberar telefone, e-mail e mensagem de abordagem.', '');
      openLoginModal();
      return;
    }

    const original = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Liberando...';
    }

    try {
      const rows = await rpc('nt_consumir_talento', { p_talento_key: key }, true);
      const talent = rows?.[0];

      if (!talent) throw new Error('Contato não encontrado.');

      state.currentTalent = talent;
      await loadContext();
      renderTalentModal(talent);
      openTalentModal();
    } catch (err) {
      alert(friendlyError(err));
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
      setLoginMessage('A plataforma não carregou a configuração de acesso. Atualize a página ou fale com o suporte.', 'error');
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
      await loadAllFilterOptions();

      closeLoginModal();
      setLoginMessage('', '');
      await search(true);
    } catch (err) {
      console.error(err);
      const raw = String(err && err.message ? err.message : err);
      const msg = raw.toLowerCase().includes('invalid login credentials')
        ? 'E-mail ou senha não conferem. Solicite ao administrador a redefinição do acesso.'
        : friendlyError(err);
      setLoginMessage(msg, 'error');
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
    showWorkspace(true);

    await loadAllFilterOptions();
    await search(true);
  }

  async function restoreSession() {
    const client = getClient();
    if (!client) {
      showWorkspace(true);
      status('Não foi possível carregar a configuração da plataforma. Atualize a página ou fale com o suporte.');
      return;
    }

    const { data } = await client.auth.getSession();
    state.session = data.session || null;

    if (!state.session) {
      showWorkspace(true);
      updateHeader();
      updateSummary();

      try {
        await loadAllFilterOptions();
        await search(true);
      } catch (err) {
        console.warn('[NT] Falha ao carregar prévia pública:', err);
        const msg = friendlyError(err);
        status(msg);
        const grid = $('#cardsGrid');
        if (grid) grid.innerHTML = `<div class="nt-empty">${esc(msg)}</div>`;
      }
      return;
    }

    try {
      await loadContext();
      await loadFrases();
      await loadAllFilterOptions();
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

    ['cidadeSelect', 'regiaoSelect', 'microSelect', 'bairroSelect'].forEach((id) => {
      $('#' + id)?.addEventListener('change', async () => {
        await refreshDependentOptions();
        await search(true);
      });
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
      ['cidadeSelect', 'regiaoSelect', 'microSelect', 'bairroSelect', 'idadeSelect', 'cargoSelect', 'metroSelect'].forEach((id) => {
        const el = $('#' + id);
        if (el) el.value = '';
      });
      const termo = $('#termoInput');
      if (termo) termo.value = '';
      collectFilters();
      await loadAllFilterOptions();
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
