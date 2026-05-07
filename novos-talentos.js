(() => {
  // HOTFIX v1.2 — prévia pública sem login + detalhes somente com login.
  const rawCfg = window.RHIMOB_SUPABASE_CONFIG || {};
  const cfg = {
    url: rawCfg.url || rawCfg.supabaseUrl || rawCfg.SUPABASE_URL || '',
    publishableKey: rawCfg.publishableKey || rawCfg.anonKey || rawCfg.supabaseAnonKey || rawCfg.SUPABASE_ANON_KEY || '',
    enabled: rawCfg.enabled !== false
  };

  const PAGE_SIZE = 24;
  const PRODUCT_CODE = 'NOVOS_TALENTOS';

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
    currentTalent: null,
    lastError: ''
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

  async function rpc(fn, payload = {}) {
    const client = getClient();
    if (!client) throw new Error('A plataforma não carregou a configuração de acesso. Atualize a página ou fale com o suporte.');
    if (!state.session?.access_token) throw new Error('Faça login para continuar.');
    const { data, error } = await client.rpc(fn, payload);
    if (error) throw error;
    return data;
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

  function showLoginWarning(message) {
    const warn = $('#loginWarning');
    if (!warn) return;
    warn.hidden = false;
    const span = warn.querySelector('span');
    if (span && message) span.textContent = message;
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
    const client = getClient();
    if (!client) throw new Error('A plataforma não carregou a configuração de acesso. Atualize a página ou fale com o suporte.');

    try {
      const rows = await rpc('nt_app_context', {});
      const ctx = rows?.[0] || null;
      if (ctx) {
        state.context = ctx;
        updateSummary();
        updateHeader();
        showWorkspace(true);
        return ctx;
      }
    } catch (err) {
      console.warn('[NT] nt_app_context indisponível, usando leitura direta:', err);
    }

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    const authUser = userData?.user;
    if (!authUser?.id) throw new Error('Sessão inválida. Entre novamente.');

    const { data: usuario, error: usuarioError } = await client
      .from('nt_usuarios_conta')
      .select('usuario_id,conta_id,produto_codigo,nome,email_login,perfil,status,auth_user_id')
      .eq('auth_user_id', authUser.id)
      .eq('produto_codigo', PRODUCT_CODE)
      .eq('status', 'ATIVO')
      .maybeSingle();

    if (usuarioError) throw usuarioError;
    if (!usuario) throw new Error('Login válido, mas o usuário não está vinculado à Plataforma Novos Talentos. Confira auth_user_id em nt_usuarios_conta.');

    const { data: conta, error: contaError } = await client
      .from('nt_contas')
      .select('conta_id,produto_codigo,nome_conta,plano_tipo,status,limite_total,limite_por_usuario,usuarios_contratados')
      .eq('conta_id', usuario.conta_id)
      .eq('produto_codigo', PRODUCT_CODE)
      .eq('status', 'ATIVA')
      .maybeSingle();

    if (contaError) throw contaError;
    if (!conta) throw new Error('Usuário vinculado, mas a conta está inativa ou não foi localizada em nt_contas.');

    const { count, error: countError } = await client
      .from('nt_talento_consumos')
      .select('consumo_id', { count: 'exact', head: true })
      .eq('conta_id', conta.conta_id)
      .eq('produto_codigo', PRODUCT_CODE);

    if (countError) throw countError;

    const consumidos = count || 0;
    state.context = {
      usuario_id: usuario.usuario_id,
      conta_id: conta.conta_id,
      produto_codigo: PRODUCT_CODE,
      nome: usuario.nome,
      email_login: usuario.email_login,
      perfil: usuario.perfil,
      nome_conta: conta.nome_conta,
      plano_tipo: conta.plano_tipo,
      limite_total: Number(conta.limite_total || 0),
      limite_por_usuario: Number(conta.limite_por_usuario || 0),
      usuarios_contratados: Number(conta.usuarios_contratados || 0),
      consumidos,
      saldo: Math.max(Number(conta.limite_total || 0) - consumidos, 0)
    };

    updateSummary();
    updateHeader();
    showWorkspace(true);
    return state.context;
  }

  async function loadFrases() {
    const client = getClient();
    state.frases = [{ texto: DEFAULT_FRASE, titulo: 'Frase padrão' }];

    try {
      const rows = await rpc('nt_listar_frases_plano', {});
      if (Array.isArray(rows) && rows.length) {
        state.frases = rows.map((r) => ({
          frase_id: r.frase_id,
          titulo: normalize(r.titulo) || `Frase ${r.prioridade || ''}`,
          texto: normalize(r.texto)
        })).filter((r) => r.texto);
        return;
      }
    } catch (err) {
      console.warn('[NT] nt_listar_frases_plano indisponível, usando leitura direta:', err);
    }

    if (!state.context) return;
    const { data, error } = await client
      .from('nt_frases_abordagem')
      .select('frase_id,prioridade,titulo,texto,status')
      .eq('produto_codigo', PRODUCT_CODE)
      .eq('plano_tipo', state.context.plano_tipo || 'EMPRESARIAL')
      .eq('status', 'ATIVA')
      .order('prioridade', { ascending: true });

    if (error) throw error;
    if (Array.isArray(data) && data.length) {
      state.frases = data.map((r) => ({
        frase_id: r.frase_id,
        titulo: normalize(r.titulo) || `Frase ${r.prioridade || ''}`,
        texto: normalize(r.texto)
      })).filter((r) => r.texto);
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
    const client = getClient();
    const select = $('#cidadeSelect');
    resetSelect(select, 'Todas as cidades');

    const { data, error } = await client
      .from('nt_filtro_cidade')
      .select('cidade,estado_uf,total')
      .order('cidade', { ascending: true })
      .limit(1000);

    if (error) throw error;

    (data || []).forEach((row) => {
      const label = `${row.cidade}/${row.estado_uf}`;
      const value = `${row.cidade}||${row.estado_uf}`;
      select.appendChild(option(label, value, formatNumber(row.total)));
    });
  }

  async function loadDependentFilters() {
    const client = getClient();
    const [cidade, uf] = String($('#cidadeSelect')?.value || '').split('||');

    state.filters.cidade = cidade || '';
    state.filters.estado_uf = uf || '';

    const idadeSelect = $('#idadeSelect');
    const cargoSelect = $('#cargoSelect');
    const metroSelect = $('#metroSelect');

    resetSelect(idadeSelect, 'Todas as idades');
    resetSelect(cargoSelect, 'Todos os perfis');
    resetSelect(metroSelect, 'Todas as estações');

    if (!cidade || !uf) return;

    const [idades, cargos, metros] = await Promise.all([
      client.from('nt_filtro_cidade_idade').select('faixa_idade,total').eq('cidade', cidade).eq('estado_uf', uf).order('faixa_idade', { ascending: true }).limit(1000),
      client.from('nt_filtro_cidade_cargo').select('cargo,total').eq('cidade', cidade).eq('estado_uf', uf).order('total', { ascending: false }).limit(1000),
      client.from('nt_filtro_cidade_metro').select('estacao_mais_proxima,linha_metro_mais_proxima,cor_linha_metro,total').eq('cidade', cidade).eq('estado_uf', uf).order('total', { ascending: false }).limit(1000)
    ]);

    if (idades.error) throw idades.error;
    if (cargos.error) throw cargos.error;
    if (metros.error) throw metros.error;

    (idades.data || []).forEach((row) => {
      idadeSelect.appendChild(option(row.faixa_idade, row.faixa_idade, formatNumber(row.total)));
    });

    (cargos.data || []).forEach((row) => {
      cargoSelect.appendChild(option(row.cargo, row.cargo, formatNumber(row.total)));
    });

    (metros.data || []).forEach((row) => {
      const linha = row.linha_metro_mais_proxima ? ` • ${row.linha_metro_mais_proxima}` : '';
      metroSelect.appendChild(option(`${row.estacao_mais_proxima}${linha}`, row.estacao_mais_proxima, formatNumber(row.total)));
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
    // A prévia de talentos segue o padrão da Plataforma Corretores:
    // sem login mostra dados públicos protegidos; login é exigido apenas para liberar detalhes/contato.
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
      let rows = null;

      try {
        rows = await rpc('nt_listar_talentos', {
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
      } catch (rpcErr) {
        console.warn('[NT] nt_listar_talentos indisponível, usando leitura direta:', rpcErr);
        const client = getClient();
        let q = client
          .from('nt_talentos_publicos')
          .select('talento_key,nome_mascarado,primeiro_nome,cargo,idade_anos,faixa_idade,cidade,estado_uf,bairro,regiao_macro,micro_regiao,tem_whatsapp,tem_email,tem_geo,estacao_mais_proxima,linha_metro_mais_proxima,cor_linha_metro,distancia_metro_km,tags_publicas', { count: 'exact' })
          .eq('produto_codigo', PRODUCT_CODE)
          .eq('ativo', true);

        if (state.filters.cidade) q = q.eq('cidade', state.filters.cidade);
        if (state.filters.estado_uf) q = q.eq('estado_uf', state.filters.estado_uf);
        if (state.filters.faixa_idade) q = q.eq('faixa_idade', state.filters.faixa_idade);
        if (state.filters.cargo) q = q.eq('cargo', state.filters.cargo);
        if (state.filters.estacao) q = q.eq('estacao_mais_proxima', state.filters.estacao);

        if (state.filters.termo) {
          const term = state.filters.termo.replace(/[%,()]/g, ' ').trim();
          q = q.or(`cargo.ilike.%${term}%,cidade.ilike.%${term}%,bairro.ilike.%${term}%,regiao_macro.ilike.%${term}%,micro_regiao.ilike.%${term}%,tags_publicas.ilike.%${term}%`);
        }

        const { data, error, count } = await q
          .order('cidade', { ascending: true })
          .range(state.offset, state.offset + PAGE_SIZE - 1);

        if (error) throw error;
        const list = data || [];
        state.total = Number(count || list.length || 0);
        renderCards(list, !reset);
        state.offset += list.length;
      }

      const more = $('#maisBtn');
      if (more) more.hidden = state.offset >= state.total || state.total === 0;

      status(`${formatNumber(state.total)} talentos disponíveis para os filtros atuais. Exibindo ${formatNumber(Math.min(state.offset, state.total))}.`);
    } catch (err) {
      console.error(err);
      status('Não foi possível consultar agora.');
      $('#cardsGrid').innerHTML = `<div class="nt-empty">${esc(err.message || err)}</div>`;
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
      let talent = null;

      try {
        const rows = await rpc('nt_consumir_talento', { p_talento_key: key });
        talent = rows?.[0] || null;
      } catch (rpcErr) {
        console.warn('[NT] nt_consumir_talento indisponível, usando fluxo direto:', rpcErr);

        if (!state.context) await loadContext();
        if (Number(state.context?.limite_total || 0) > 0 && Number(state.context?.saldo || 0) <= 0) {
          throw new Error('Limite do plano atingido.');
        }

        const client = getClient();
        const authUserId = state.session?.user?.id;

        const { error: consumeError } = await client
          .from('nt_talento_consumos')
          .upsert({
            conta_id: state.context.conta_id,
            produto_codigo: PRODUCT_CODE,
            talento_key: key,
            usuario_id: state.context.usuario_id,
            auth_user_id: authUserId,
            operador_nome: state.context.nome || '',
            origem: 'PLATAFORMA_NOVOS_TALENTOS'
          }, { onConflict: 'conta_id,talento_key', ignoreDuplicates: true });

        if (consumeError) throw consumeError;

        const { data, error } = await client
          .from('nt_talentos')
          .select('talento_key,nome_completo,primeiro_nome,email,whatsapp,telefone_principal,cargo,pretensao_salarial,sexo,idade_anos,faixa_idade,cidade,estado_uf,bairro,cep,regiao_macro,micro_regiao,bairro_macro,estacao_mais_proxima,linha_metro_mais_proxima,cor_linha_metro,distancia_metro_km,curriculo_url')
          .eq('talento_key', key)
          .eq('produto_codigo', PRODUCT_CODE)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Contato consumido, mas os detalhes não foram liberados pela política. Revise a RLS de nt_talentos.');

        await loadContext();
        talent = {
          ...data,
          consumido_agora: true,
          saldo_restante: state.context.saldo
        };
      }

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

    setText('talentoSubtitle', `${used} Saldo restante: ${formatNumber(talent.saldo_restante ?? state.context?.saldo)}.`);

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
      await loadCidadeOptions();
      await loadDependentFilters();

      closeLoginModal();
      setLoginMessage('', '');
      await search(true);
    } catch (err) {
      console.error(err);
      state.lastError = err.message || String(err);
      setLoginMessage(state.lastError, 'error');
      showLoginWarning(`Login aceito, mas os dados da conta não carregaram: ${state.lastError}`);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Entrar';
      }
      updateHeader();
      updateSummary();
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
      updateHeader();
      updateSummary();
      showLoginWarning('A plataforma não carregou a configuração de acesso. Atualize a página ou fale com o suporte. Verifique o arquivo supabase-config.js.');
      return;
    }

    const { data } = await client.auth.getSession();
    state.session = data.session || null;

    if (!state.session) {
      // Sem login: carrega prévia pública protegida.
      showWorkspace(true);
      updateHeader();
      updateSummary();

      try {
        await loadCidadeOptions();
        await loadDependentFilters();
        await search(true);
      } catch (err) {
        console.warn('[NT] Falha ao carregar prévia pública:', err);
        status('Não foi possível carregar a prévia neste momento. Atualize a página ou fale com o suporte.');
        const grid = $('#cardsGrid');
        if (grid) grid.innerHTML = `<div class="nt-empty">${esc(err.message || err)}</div>`;
      }
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
      state.lastError = err.message || String(err);
      showWorkspace(false);
      showLoginWarning(`Sessão encontrada, mas os dados não carregaram: ${state.lastError}`);
    } finally {
      updateHeader();
      updateSummary();
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
