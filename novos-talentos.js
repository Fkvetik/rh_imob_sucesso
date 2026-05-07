(() => {
  'use strict';

  // RH IMOB • Novos Talentos v8
  // Filtros com contagem precisa no banco, sem amostra no navegador.

  const EMBEDDED_NT_CONFIG = {
    enabled: true,
    url: 'https://pufxvskozfdvfscqnays.supabase.co',
    publishableKey: 'sb_publishable_hYJDyj6C0f2uBZF__t35Yw_E1S9SIEj'
  };

  const rawCfg = window.RHIMOB_NOVOS_TALENTOS_SUPABASE_CONFIG || EMBEDDED_NT_CONFIG;

  const cfg = {
    enabled: rawCfg.enabled !== false,
    url: String(rawCfg.url || EMBEDDED_NT_CONFIG.url).replace(/\/+$/, ''),
    publishableKey: rawCfg.publishableKey || rawCfg.anonKey || rawCfg.key || EMBEDDED_NT_CONFIG.publishableKey
  };

  const PRODUCT_CODE = 'NOVOS_TALENTOS';
  const PAGE_SIZE = 24;

  let sb = null;

  const state = {
    session: null,
    context: null,
    frases: [],
    offset: 0,
    total: 0,
    loading: false,
    currentTalent: null,
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
    }
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
    if (!window.supabase || !cfg.enabled || !cfg.url || !cfg.publishableKey) return null;

    sb = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    return sb;
  }

  function friendlyError(error) {
    const raw = String(error && error.message ? error.message : error || '');

    if (raw.includes('nt_opcoes_publicas_v8') || raw.includes('nt_listar_talentos_publico_v8')) {
      return 'A leitura dos filtros ainda não foi ativada neste ambiente. Aguarde a publicação da atualização e recarregue a página.';
    }

    if (
      raw.includes('Could not find the table') ||
      raw.includes('schema cache') ||
      raw.includes('PGRST205') ||
      raw.includes('PGRST204')
    ) {
      return 'A prévia ainda não está disponível neste ambiente. Atualize a página em alguns instantes ou fale com o suporte para revisar a conexão.';
    }

    if (
      raw.toLowerCase().includes('permission') ||
      raw.toLowerCase().includes('not authorized') ||
      raw.toLowerCase().includes('row-level security') ||
      raw.toLowerCase().includes('unauthorized') ||
      raw.toLowerCase().includes('jwt')
    ) {
      return 'A prévia protegida ainda não foi liberada para visualização. Fale com o suporte para ativar o acesso inicial.';
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
    setTimeout(() => $('#loginEmail')?.focus(), 60);
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
      setText('summaryText', 'Você pode consultar perfis públicos protegidos. Telefone, e-mail e mensagem só aparecem após login e liberação do perfil.');
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

  async function rpcPublic(fn, payload = {}) {
    const client = getClient();
    if (!client) throw new Error('Configuração da plataforma indisponível.');

    const { data, error } = await client.rpc(fn, payload);
    if (error) throw error;
    return data || [];
  }

  async function loadContext() {
    const client = getClient();
    if (!client) throw new Error('Configuração da plataforma indisponível.');

    const { data: userData } = await client.auth.getUser();
    const authUser = userData?.user;
    if (!authUser) throw new Error('Sessão não encontrada.');

    const { data: userLink, error: userError } = await client
      .from('nt_usuarios_conta')
      .select('usuario_id,usuario_seed_id,conta_id,produto_codigo,nome,email_login,perfil,status,auth_user_id')
      .eq('auth_user_id', authUser.id)
      .eq('produto_codigo', PRODUCT_CODE)
      .eq('status', 'ATIVO')
      .maybeSingle();

    if (userError) throw userError;
    if (!userLink) throw new Error('Acesso não liberado para esta plataforma.');

    const { data: conta, error: contaError } = await client
      .from('nt_contas')
      .select('conta_id,produto_codigo,nome_conta,plano_tipo,status,limite_total,limite_por_usuario,usuarios_contratados')
      .eq('conta_id', userLink.conta_id)
      .eq('produto_codigo', PRODUCT_CODE)
      .eq('status', 'ATIVA')
      .maybeSingle();

    if (contaError) throw contaError;
    if (!conta) throw new Error('Conta não localizada ou inativa.');

    const { count, error: countError } = await client
      .from('nt_talento_consumos')
      .select('consumo_id', { count: 'exact', head: true })
      .eq('conta_id', conta.conta_id)
      .eq('produto_codigo', PRODUCT_CODE);

    if (countError) throw countError;

    const consumidos = count || 0;
    const limite = Number(conta.limite_total || 0);

    state.context = {
      ...userLink,
      ...conta,
      consumidos,
      saldo: limite ? Math.max(limite - consumidos, 0) : 0
    };

    updateSummary();
    updateHeader();
    showWorkspace(true);
    return state.context;
  }

  async function loadFrases() {
    state.frases = [{ texto: DEFAULT_FRASE, titulo: 'Frase padrão' }];

    const client = getClient();
    if (!client || !state.context) return;

    try {
      const { data, error } = await client
        .from('nt_frases_abordagem')
        .select('frase_id,prioridade,titulo,texto,status')
        .eq('produto_codigo', PRODUCT_CODE)
        .eq('plano_tipo', state.context.plano_tipo || 'EMPRESARIAL')
        .eq('status', 'ATIVA')
        .order('prioridade', { ascending: true });

      if (error) throw error;

      if (Array.isArray(data) && data.length) {
        state.frases = data
          .map((r) => ({
            frase_id: r.frase_id,
            titulo: normalize(r.titulo) || `Frase ${r.prioridade || ''}`,
            texto: normalize(r.texto)
          }))
          .filter((r) => r.texto);
      }
    } catch (err) {
      console.warn('[NT] Frases padrão locais usadas:', err);
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

  function fillOptions(select, rows, tipo, placeholder, selectedValue = '') {
    resetSelect(select, placeholder);

    (rows || [])
      .filter((row) => row.tipo === tipo && normalize(row.valor))
      .forEach((row) => {
        select.appendChild(option(row.label || row.valor, row.valor, formatNumber(row.total)));
      });

    if (selectedValue && [...select.options].some((o) => o.value === selectedValue)) {
      select.value = selectedValue;
    }
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

  async function loadAllOptions(preserve = true) {
    collectFilters();

    const current = {
      cidade: $('#cidadeSelect')?.value || '',
      regiao: $('#regiaoSelect')?.value || '',
      micro: $('#microSelect')?.value || '',
      bairro: $('#bairroSelect')?.value || '',
      idade: $('#idadeSelect')?.value || '',
      cargo: $('#cargoSelect')?.value || '',
      metro: $('#metroSelect')?.value || ''
    };

    const rows = await rpcPublic('nt_opcoes_publicas_v8', {
      p_cidade: state.filters.cidade || null,
      p_estado_uf: state.filters.estado_uf || null,
      p_regiao_macro: state.filters.regiao_macro || null,
      p_micro_regiao: state.filters.micro_regiao || null,
      p_bairro: state.filters.bairro || null,
      p_faixa_idade: state.filters.faixa_idade || null,
      p_cargo: state.filters.cargo || null,
      p_estacao: state.filters.estacao || null,
      p_termo: state.filters.termo || null
    });

    fillOptions($('#cidadeSelect'), rows, 'cidade', 'Todas as cidades', preserve ? current.cidade : '');
    fillOptions($('#regiaoSelect'), rows, 'regiao_macro', 'Todas as regiões', preserve ? current.regiao : '');
    fillOptions($('#microSelect'), rows, 'micro_regiao', 'Todas as micro regiões', preserve ? current.micro : '');
    fillOptions($('#bairroSelect'), rows, 'bairro', 'Todos os bairros', preserve ? current.bairro : '');
    fillOptions($('#idadeSelect'), rows, 'faixa_idade', 'Todas as idades', preserve ? current.idade : '');
    fillOptions($('#cargoSelect'), rows, 'cargo', 'Todos os perfis', preserve ? current.cargo : '');
    fillOptions($('#metroSelect'), rows, 'metro', 'Todas as estações', preserve ? current.metro : '');
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
      const macro = normalize(row.macro_calc || row.regiao_macro);
      const micro = normalize(row.micro_calc || row.micro_regiao || row.estacao_mais_proxima);

      const metro = row.estacao_mais_proxima
        ? `${esc(row.estacao_mais_proxima)}${row.linha_metro_mais_proxima ? ` • ${esc(row.linha_metro_mais_proxima)}` : ''}`
        : 'Metrô não informado';

      const geo = row.tem_geo ? 'Geolocalizado' : 'Localização aproximada';
      const canal = row.tem_whatsapp ? 'Canal disponível após login' : (row.tem_email ? 'Contato disponível após login' : 'Contato protegido');
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
            <span>🧭 ${esc([macro, micro].filter(Boolean).join(' • ') || 'Região em classificação')}</span>
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
      const grid = $('#cardsGrid');
      if (grid) grid.innerHTML = '';
    }

    const btn = $('#buscarBtn');
    if (btn) btn.textContent = 'Buscando...';
    status('Consultando talentos disponíveis...');

    try {
      const rows = await rpcPublic('nt_listar_talentos_publico_v8', {
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
      });

      const list = Array.isArray(rows) ? rows : [];
      state.total = Number(list[0]?.total_count || state.total || list.length);
      renderCards(list, !reset);
      state.offset += list.length;

      const more = $('#maisBtn');
      if (more) more.hidden = state.offset >= state.total || !list.length;

      status(`${formatNumber(state.total)} talentos disponíveis para os filtros atuais. Exibindo ${formatNumber(Math.min(state.offset, state.total))}.`);
    } catch (err) {
      console.error('[NT] search error:', err);
      const msg = friendlyError(err);
      status(msg);
      const grid = $('#cardsGrid');
      if (grid) grid.innerHTML = `<div class="nt-empty">${esc(msg)}</div>`;
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
      const client = getClient();
      const { data, error } = await client.rpc('nt_consumir_talento', { p_talento_key: key });
      if (error) throw error;

      const talent = Array.isArray(data) ? data[0] : data;
      if (!talent) throw new Error('Contato não localizado.');

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
      alert('Abordagem copiada.');
    } catch (_) {
      $('#mensagemTextarea')?.select();
      document.execCommand('copy');
      alert('Abordagem copiada.');
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

      closeLoginModal();
      setLoginMessage('', '');
      await search(true);
    } catch (err) {
      console.error('[NT] login error:', err);
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
    await search(true);
  }

  async function restoreSession() {
    const client = getClient();

    if (!client) {
      showWorkspace(true);
      updateHeader();
      updateSummary();
      status('Não foi possível carregar a configuração da plataforma.');
      return;
    }

    try {
      const { data } = await client.auth.getSession();
      state.session = data.session || null;

      showWorkspace(true);
      updateHeader();
      updateSummary();

      await loadAllOptions(false);

      if (state.session) {
        try {
          await loadContext();
          await loadFrases();
        } catch (err) {
          console.warn('[NT] Sessão sem contexto válido:', err);
          await client.auth.signOut();
          state.session = null;
          state.context = null;
          updateHeader();
          updateSummary();
        }
      }

      await search(true);
    } catch (err) {
      console.error('[NT] restore error:', err);
      const msg = friendlyError(err);
      status(msg);
      const grid = $('#cardsGrid');
      if (grid) grid.innerHTML = `<div class="nt-empty">${esc(msg)}</div>`;
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
      $('#regiaoSelect').value = '';
      $('#microSelect').value = '';
      $('#bairroSelect').value = '';
      await loadAllOptions(true);
      await search(true);
    });

    $('#regiaoSelect')?.addEventListener('change', async () => {
      $('#microSelect').value = '';
      $('#bairroSelect').value = '';
      await loadAllOptions(true);
      await search(true);
    });

    $('#microSelect')?.addEventListener('change', async () => {
      $('#bairroSelect').value = '';
      await loadAllOptions(true);
      await search(true);
    });

    ['bairroSelect', 'idadeSelect', 'cargoSelect', 'metroSelect'].forEach((id) => {
      $('#' + id)?.addEventListener('change', async () => {
        await loadAllOptions(true);
        await search(true);
      });
    });

    $('#termoInput')?.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        await loadAllOptions(true);
        await search(true);
      }
    });

    $('#buscarBtn')?.addEventListener('click', async () => {
      await loadAllOptions(true);
      await search(true);
    });

    $('#maisBtn')?.addEventListener('click', () => search(false));

    $('#limparBtn')?.addEventListener('click', async () => {
      ['cidadeSelect', 'regiaoSelect', 'microSelect', 'bairroSelect', 'idadeSelect', 'cargoSelect', 'metroSelect'].forEach((id) => {
        const el = $('#' + id);
        if (el) el.value = '';
      });
      const termo = $('#termoInput');
      if (termo) termo.value = '';

      collectFilters();
      await loadAllOptions(false);
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
