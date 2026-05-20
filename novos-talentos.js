(() => {
  'use strict';

  // RH IMOB • Novos Talentos v16
  // Metrô até 5 km visível no card e filtros sem competição com painel/admin.

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
  const FALLBACK_LIMIT = 5000;

  let sb = null;

  const state = {
    session: null,
    context: null,
    frases: [],
    offset: 0,
    total: 0,
    loading: false,
    loadingFilters: false,
    filterRequestSeq: 0,
    currentTalent: null,
    currentPhraseId: null,
    phrasesAdmin: [],
    adminLoaded: false,
    adminLazyTimer: null,
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

  function lower(value) {
    return normalize(value).toLowerCase();
  }


  function fixAccentCase(value) {
    return String(value || '')
      .replace(/Á/g, 'á')
      .replace(/À/g, 'à')
      .replace(/Â/g, 'â')
      .replace(/Ã/g, 'ã')
      .replace(/É/g, 'é')
      .replace(/Ê/g, 'ê')
      .replace(/Í/g, 'í')
      .replace(/Ó/g, 'ó')
      .replace(/Ô/g, 'ô')
      .replace(/Õ/g, 'õ')
      .replace(/Ú/g, 'ú')
      .replace(/Ç/g, 'ç');
  }

  function capitalizeWord(word) {
    const lowerWord = fixAccentCase(word).toLowerCase();

    const keepLower = new Set([
      'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos',
      'a', 'o', 'as', 'os', 'para', 'por'
    ]);

    if (keepLower.has(lowerWord)) return lowerWord;

    const upperAll = new Set(['SP', 'RJ', 'MG', 'BA', 'PR', 'SC', 'RS', 'PE', 'CE', 'GO', 'DF', 'ES', 'PA', 'AM', 'MA', 'MT', 'MS', 'RN', 'PB', 'PI', 'AL', 'SE', 'RO', 'RR', 'AC', 'AP', 'TO']);
    if (upperAll.has(word.toUpperCase())) return word.toUpperCase();

    return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
  }

  function titleCaseSmart(value) {
    let text = fixAccentCase(normalize(value));
    if (!text) return '';

    text = text
      .replace(/\bSÃO\b/gi, 'São')
      .replace(/\bSAO\b/gi, 'São')
      .replace(/\bGUARUJ[aá]\b/gi, 'Guarujá')
      .replace(/\bBALNE[aá]RIO\b/gi, 'Balneário')
      .replace(/\bATL[aâ]NTICA\b/gi, 'Atlântica')
      .replace(/\bATLANTICA\b/gi, 'Atlântica')
      .replace(/\bSERVI[cç]OS\b/gi, 'Serviços')
      .replace(/\bADMINISTRATIVO\b/gi, 'Administrativo')
      .replace(/\bAUXILIAR\b/gi, 'Auxiliar')
      .replace(/\bASSISTENTE\b/gi, 'Assistente')
      .replace(/\bPROFESSOR\b/gi, 'Professor')
      .replace(/\bPROFESSORA\b/gi, 'Professora');

    return text.split(/(\s+|\/|•|-)/).map(part => {
      if (!part || /^\s+$/.test(part) || ['/', '•', '-'].includes(part)) return part;
      if (/^\d/.test(part)) return part;
      return capitalizeWord(part);
    }).join('')
      .replace(/\bSão\b/g, 'São')
      .replace(/\bGuarujá\b/g, 'Guarujá')
      .replace(/\bBalneário\b/g, 'Balneário')
      .replace(/\bAtlântica\b/g, 'Atlântica');
  }

  function displayText(value) {
    return titleCaseSmart(value);
  }

  function displayJoin(values, separator = ' • ') {
    return values.filter(Boolean).map(displayText).join(separator);
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

    if (raw.includes('nt_opcoes_filtro_publico_v10') || raw.includes('nt_listar_talentos_publico_v10')) {
      return 'A leitura dos filtros ainda não foi ativada neste ambiente. Aguarde a publicação da atualização e recarregue a página.';
    }

    if (raw.includes('nt_consumir_talento') || raw.includes('nt_consumir_talento_json_v11') || raw.toLowerCase().includes('acesso não autorizado')) {
      return 'Seu acesso entrou, mas ainda não está liberado para consumir contatos neste plano. Sincronize o usuário na planilha ou fale com o administrador.';
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

    if (raw.toLowerCase().includes('limite do plano')) {
      return 'O limite contratado para este plano foi atingido. Ajuste o plano ou fale com o administrador.';
    }

    if (
      raw.toLowerCase().includes('failed to fetch') ||
      raw.toLowerCase().includes('network') ||
      raw.toLowerCase().includes('load failed')
    ) {
      return 'Não foi possível carregar a plataforma agora. Verifique sua conexão e atualize a página.';
    }

    return 'Não foi possível concluir essa ação no momento. Atualize a página ou fale com o suporte.';
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

  function inferMacro(row) {
    const regiao = normalize(row?.macro_calc || row?.regiao_macro);
    if (regiao) return regiao;

    const bairro = lower(row?.bairro);
    if (bairro.includes('zona sul')) return 'Zona Sul';
    if (bairro.includes('zona norte')) return 'Zona Norte';
    if (bairro.includes('zona leste')) return 'Zona Leste';
    if (bairro.includes('zona oeste')) return 'Zona Oeste';
    if (bairro.includes('centro') || bairro.includes('sé') || bairro.includes('se') || bairro.includes('república') || bairro.includes('republica')) return 'Centro';
    return '';
  }

  function inferMicro(row) {
    return normalize(row?.micro_calc || row?.micro_regiao || row?.estacao_mais_proxima || row?.bairro);
  }


  function parseKm(value) {
    if (value === null || value === undefined || value === '') return null;
    const normalized = String(value).replace(',', '.').replace(/[^\d.]+/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function formatKm(value) {
    const n = parseKm(value);
    if (n === null) return '';
    return `${n.toLocaleString('pt-BR', { minimumFractionDigits: n < 1 ? 2 : 1, maximumFractionDigits: 2 })} km`;
  }

  function getMetroInfo(row) {
    const estacao = normalize(row?.estacao_mais_proxima);
    const linha = normalize(row?.linha_metro_mais_proxima);
    const distancia = parseKm(row?.distancia_metro_km);

    if (!estacao || distancia === null) {
      return {
        label: 'Sem metrô até 5 km',
        detail: '',
        badge: '',
        isNear: false,
        hasMetro: false
      };
    }

    if (distancia > 5) {
      return {
        label: 'Sem metrô até 5 km',
        detail: `${estacao}${linha ? ` • ${linha}` : ''} • ${formatKm(distancia)}`,
        badge: '',
        isNear: false,
        hasMetro: true
      };
    }

    const base = `${estacao}${linha ? ` • ${linha}` : ''}`;
    const km = formatKm(distancia);

    return {
      label: `${base} • ${km}`,
      detail: `Até 5 km do metrô • ${km}`,
      badge: `🚇 ${base} • ${km}`,
      isNear: true,
      hasMetro: true
    };
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

    updateAdminVisibility();
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


  function isMasterProfile() {
    const perfil = String(state.context?.perfil || '').toUpperCase();
    return ['MASTER', 'ADMIN', 'SUPER', 'SUPER_ADMIN'].includes(perfil);
  }

  function adminAllowed() {
    return !!state.session && !!state.context && isMasterProfile();
  }

  function setAdminAlert(message, type = 'info') {
    const el = $('#adminAlert');
    if (!el) return;

    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'nt-admin-alert';
      return;
    }

    el.hidden = false;
    el.textContent = message;
    el.className = `nt-admin-alert ${type}`.trim();
  }

  function formatDateTimeBR(value) {
    if (!value) return '-';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function normalizeRpcList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.frases)) return data.frases;
    if (Array.isArray(data.rows)) return data.rows;
    return [];
  }

  function updateAdminVisibility() {
    const panel = $('#adminPanel');
    if (!panel) return;

    const show = adminAllowed();
    panel.hidden = !show;

    if (!show) {
      state.adminLoaded = false;
      setAdminAlert('', 'info');
    }
  }


  async function rpc(fn, payload = {}) {
    const client = getClient();
    if (!client) throw new Error('Configuração da plataforma indisponível.');

    const { data, error } = await client.rpc(fn, payload);
    if (error) throw error;
    return data || [];
  }


  function unwrapRpcObject(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  async function rpcOne(fn, payload = {}) {
    const data = await rpc(fn, payload);
    return unwrapRpcObject(data);
  }

  async function loadContext() {
    const client = getClient();
    if (!client) throw new Error('Configuração da plataforma indisponível.');

    // Primeiro tenta a função segura. Se RLS das tabelas bloquear, continua funcionando.
    try {
      const ctx = await rpcOne('nt_app_context_json_v11', {});
      if (ctx) {
        state.context = ctx;
        updateSummary();
        updateHeader();
        return ctx;
      }
    } catch (err) {
      console.warn('[NT] contexto RPC indisponível, tentando leitura direta:', err);
    }

    const { data: userData } = await client.auth.getUser();
    const authUser = userData?.user;
    if (!authUser) throw new Error('Sessão não encontrada.');

    const { data: userLink, error: userError } = await client
      .from('nt_usuarios_conta')
      .select('usuario_id,usuario_seed_id,conta_id,produto_codigo,nome,email_login,perfil,status,auth_user_id')
      .or(`auth_user_id.eq.${authUser.id},email_login.eq.${authUser.email}`)
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

    const { count } = await client
      .from('nt_talento_consumos')
      .select('consumo_id', { count: 'exact', head: true })
      .eq('conta_id', conta.conta_id)
      .eq('produto_codigo', PRODUCT_CODE);

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
    return state.context;
  }

  async function loadFrases() {
    state.frases = [{ texto: DEFAULT_FRASE, titulo: 'Frase padrão' }];

    if (!state.context) return;

    try {
      const data = await rpc('nt_frases_ativas_json_v15', {});
      const rows = normalizeRpcList(data);

      if (rows.length) {
        state.frases = rows
          .map((r, index) => ({
            frase_id: r.frase_id || r.id || `FRASE_${index + 1}`,
            titulo: normalize(r.titulo) || `Frase ${r.prioridade || index + 1}`,
            texto: normalize(r.texto)
          }))
          .filter((r) => r.texto);

        if (state.frases.length) return;
      }
    } catch (err) {
      console.warn('[NT] Frases V15 indisponíveis, tentando leitura direta:', err);
    }

    const client = getClient();
    if (!client) return;

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
    opt.textContent = extra ? `${displayText(label)} (${extra})` : displayText(label);
    return opt;
  }

  function stripAccents(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function optionKey(value) {
    return stripAccents(value)
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  const UF_SET = new Set([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO'
  ]);

  function cidadePareceValida(cidade, uf) {
    const c = normalize(cidade);
    const u = normalize(uf).toUpperCase();
    if (!c || !u || !UF_SET.has(u)) return false;
    if (c.length < 2 || c.length > 45) return false;
    if (/[0-9@;]/.test(c)) return false;

    const key = optionKey(c);
    const invalidTerms = [
      'dados pessoais', 'mapeamento', 'processo', 'experiencia', 'ferramenta',
      'marketing', 'public', 'manutencao', 'executando', 'cliente',
      'atendimento', 'analista', 'professor', 'estoquista'
    ];

    return !invalidTerms.some((term) => key.includes(term));
  }

  function parseCidadeOption(row) {
    const rawValor = normalize(row?.valor ?? row?.value ?? '');
    const rawLabel = normalize(row?.label ?? row?.nome ?? row?.cidade ?? rawValor);
    const total = Number(row?.total ?? row?.qtd ?? row?.quantidade ?? 0) || 0;

    let cidade = normalize(row?.cidade || '');
    let uf = normalize(row?.estado_uf || row?.uf || '').toUpperCase();

    if ((!cidade || !uf) && rawValor.includes('||')) {
      const parts = rawValor.split('||');
      cidade = normalize(parts[0] || cidade);
      uf = normalize(parts[1] || uf).toUpperCase();
    }

    if ((!cidade || !uf) && rawLabel.includes('/')) {
      const parts = rawLabel.split('/');
      cidade = normalize(parts[0] || cidade);
      uf = normalize(parts[parts.length - 1] || uf).toUpperCase();
    }

    cidade = cidade.replace(/\s*[-/]\s*[A-Za-z]{2}\s*$/, '').replace(/\s+/g, ' ').trim();

    if (!cidadePareceValida(cidade, uf)) return null;

    const cidadeDisplay = displayText(cidade);
    const key = `${optionKey(cidadeDisplay)}||${uf}`;

    return {
      key,
      valor: `${cidadeDisplay}||${uf}`,
      label: `${cidadeDisplay}/${uf}`,
      total
    };
  }

  function dedupeOptionRows(rows, tipo = '') {
    const map = new Map();

    (rows || []).forEach((row) => {
      let item;

      if (tipo === 'cidade') {
        item = parseCidadeOption(row);
        if (!item) return;
      } else {
        const valor = normalize(row?.valor ?? row?.value ?? '');
        const label = normalize(row?.label ?? row?.nome ?? valor);
        if (!valor || !label) return;

        item = {
          key: `${optionKey(valor)}||${optionKey(label)}`,
          valor,
          label,
          total: Number(row?.total ?? row?.qtd ?? row?.quantidade ?? 0) || 0
        };
      }

      const current = map.get(item.key);
      if (!current) {
        map.set(item.key, item);
        return;
      }

      // Mantém a maior contagem quando o mesmo filtro vem duplicado de RPC/cache/fallback.
      // Somar aqui dobraria números quando o HTML recebe duas fontes para a mesma cidade.
      current.total = Math.max(Number(current.total || 0), Number(item.total || 0));
      if (String(item.label || '').length < String(current.label || '').length) current.label = item.label;
      if (String(item.valor || '').length < String(current.valor || '').length) current.valor = item.valor;
    });

    return Array.from(map.values()).sort((a, b) => {
      const byTotal = Number(b.total || 0) - Number(a.total || 0);
      if (byTotal) return byTotal;
      return String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR');
    });
  }

  function resetSelect(select, placeholder) {
    if (!select) return;
    select.innerHTML = '';
    select.appendChild(option(placeholder, ''));
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

  function fillRows(select, rows, placeholder, selectedValue = '', tipo = '') {
    resetSelect(select, placeholder);

    dedupeOptionRows(rows, tipo).forEach((row) => {
      select.appendChild(option(row.label || row.valor, row.valor, formatNumber(row.total)));
    });

    if (selectedValue && [...select.options].some((o) => o.value === selectedValue)) {
      select.value = selectedValue;
    }
  }


  function dedupeCitySelect() {
    const select = $('#cidadeSelect');
    if (!select || select.options.length < 2) return;

    const seen = new Set();
    let hasDup = false;
    Array.from(select.options).forEach((opt) => {
      if (!opt.value) return;
      const k = optionKey(opt.value);
      if (seen.has(k)) { hasDup = true; } else { seen.add(k); }
    });
    if (!hasDup) return;

    const currentValue = select.value;
    const map = new Map();
    const order = [];
    Array.from(select.options).forEach((opt) => {
      if (!opt.value) return;
      const k = optionKey(opt.value);
      if (!map.has(k)) {
        order.push(k);
        map.set(k, { value: opt.value, text: opt.textContent });
      }
    });

    const placeholder = select.options[0].cloneNode(true);
    select.innerHTML = '';
    select.appendChild(placeholder);
    order.forEach((k) => {
      const item = map.get(k);
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.text;
      select.appendChild(opt);
    });

    if (currentValue && [...select.options].some((o) => o.value === currentValue)) {
      select.value = currentValue;
    }
  }

  async function loadOptionsForType(tipo, preserveValue = true) {
    const map = {
      cidade: ['cidadeSelect', 'Todas as cidades'],
      regiao_macro: ['regiaoSelect', 'Todas as regiões'],
      micro_regiao: ['microSelect', 'Todas as micro regiões'],
      bairro: ['bairroSelect', 'Todos os bairros'],
      faixa_idade: ['idadeSelect', 'Todas as idades'],
      cargo: ['cargoSelect', 'Todos os perfis'],
      metro: ['metroSelect', 'Todas as estações']
    };

    const [selectId, placeholder] = map[tipo] || [];
    const select = $('#' + selectId);
    if (!select) return;

    const previous = preserveValue ? select.value : '';
    resetSelect(select, placeholder);

    try {
      const rows = await rpc('nt_opcoes_filtro_publico_v10', {
        p_tipo: tipo,
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

      fillRows(select, rows, placeholder, previous, tipo);
      return;
    } catch (err) {
      console.warn(`[NT] fallback filtro ${tipo}:`, err);
    }

    // Fallback sem RPC: evita tela quebrada se SQL ainda estiver em cache.
    const fallbackRows = await loadOptionsFallback(tipo);
    fillRows(select, fallbackRows, placeholder, previous, tipo);
  }

  async function loadOptionsFallback(tipo) {
    const client = getClient();
    if (!client) return [];

    if (tipo === 'cidade') {
      const { data, error } = await client
        .from('nt_filtro_cidade')
        .select('cidade,estado_uf,total')
        .order('total', { ascending: false })
        .limit(500);

      if (error) throw error;

      return (data || []).map((r) => ({
        valor: `${r.cidade}||${r.estado_uf}`,
        label: `${r.cidade}/${r.estado_uf}`,
        total: r.total || 0
      }));
    }

    let query = client
      .from('nt_talentos_publicos')
      .select('cidade,estado_uf,bairro,regiao_macro,micro_regiao,faixa_idade,cargo,estacao_mais_proxima,linha_metro_mais_proxima,ativo')
      .eq('produto_codigo', PRODUCT_CODE)
      .eq('ativo', true)
      .limit(FALLBACK_LIMIT);

    if (state.filters.cidade) query = query.eq('cidade', state.filters.cidade);
    if (state.filters.estado_uf) query = query.eq('estado_uf', state.filters.estado_uf);
    if (state.filters.regiao_macro) query = query.or(`regiao_macro.eq.${state.filters.regiao_macro},bairro.ilike.%${state.filters.regiao_macro}%`);
    if (state.filters.micro_regiao) query = query.or(`micro_regiao.eq.${state.filters.micro_regiao},estacao_mais_proxima.eq.${state.filters.micro_regiao},bairro.ilike.%${state.filters.micro_regiao}%`);
    if (state.filters.bairro) query = query.eq('bairro', state.filters.bairro);
    if (state.filters.faixa_idade) query = query.eq('faixa_idade', state.filters.faixa_idade);
    if (state.filters.cargo) query = query.eq('cargo', state.filters.cargo);
    if (state.filters.estacao) query = query.eq('estacao_mais_proxima', state.filters.estacao);

    const { data, error } = await query;
    if (error) throw error;

    const map = new Map();

    (data || []).forEach((row) => {
      let valor = '';
      let label = '';

      if (tipo === 'regiao_macro') valor = label = inferMacro(row);
      if (tipo === 'micro_regiao') valor = label = inferMicro(row);
      if (tipo === 'bairro') valor = label = normalize(row.bairro);
      if (tipo === 'faixa_idade') valor = label = normalize(row.faixa_idade);
      if (tipo === 'cargo') valor = label = normalize(row.cargo);
      if (tipo === 'metro') {
        valor = normalize(row.estacao_mais_proxima);
        label = row.linha_metro_mais_proxima ? `${valor} • ${normalize(row.linha_metro_mais_proxima)}` : valor;
      }

      if (!valor) return;

      const current = map.get(valor) || { valor, label, total: 0 };
      current.total += 1;
      map.set(valor, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
  }

  async function loadSelectedOptions(types, preserve = true, opts = {}) {
    collectFilters();

    const seq = ++state.filterRequestSeq;
    if (!opts.silent) status('Atualizando filtros...');

    await Promise.all(types.map((tipo) => loadOptionsForType(tipo, preserve)));

    // Evita aplicar resultado antigo quando o operador troca filtros rápido.
    if (seq !== state.filterRequestSeq) return false;

    collectFilters();
    return true;
  }

  async function loadAllOptions(preserve = true) {
    if (state.loadingFilters) return;
    state.loadingFilters = true;

    try {
      collectFilters();

      // Carregamento inicial/limpar: todos os filtros em paralelo.
      // Antes era sequencial, gerando sensação de travamento.
      await loadSelectedOptions([
        'cidade',
        'regiao_macro',
        'micro_regiao',
        'bairro',
        'faixa_idade',
        'cargo',
        'metro'
      ], preserve);
      dedupeCitySelect();
    } catch (err) {
      console.error('[NT] filtros:', err);
      status(friendlyError(err));
    } finally {
      state.loadingFilters = false;
    }
  }

  async function reloadDependentsAndSearch(resetChildren = [], typesToReload = []) {
    resetChildren.forEach((id) => {
      const el = $('#' + id);
      if (el) el.value = '';
    });

    collectFilters();

    // Primeiro entrega a resposta principal: os cards.
    // Os combos dependentes atualizam em segundo plano para não travar a percepção.
    await search(true);

    if (typesToReload.length) {
      loadSelectedOptions(typesToReload, true, { silent: true }).catch((err) => {
        console.warn('[NT] atualização de filtros em segundo plano:', err);
      });
    }
  }

  function scheduleFilterAction(resetChildren = [], typesToReload = []) {
    clearTimeout(state.filterTimer);
    status('Preparando consulta...');

    state.filterTimer = setTimeout(() => {
      reloadDependentsAndSearch(resetChildren, typesToReload);
    }, 180);
  }

  function status(message) {
    const el = $('#resultadoStatus');
    if (el) el.textContent = message;
  }

  function renderSkeletons(count) {
    const grid = $('#cardsGrid');
    if (!grid) return;
    const n = Math.min(count || PAGE_SIZE, 6);
    grid.innerHTML = Array.from({ length: n }, () => `
      <article class="nt-card nt-card--skeleton" aria-hidden="true">
        <div class="nt-card__top">
          <div style="flex:1;display:grid;gap:8px">
            <span class="nt-skeleton" style="height:20px;width:58%"></span>
            <span class="nt-skeleton" style="height:14px;width:36%"></span>
          </div>
          <span class="nt-skeleton" style="height:26px;width:58px;border-radius:999px"></span>
        </div>
        <div style="display:grid;gap:8px">
          <span class="nt-skeleton" style="height:34px"></span>
          <span class="nt-skeleton" style="height:34px"></span>
          <span class="nt-skeleton" style="height:34px"></span>
        </div>
        <div style="display:flex;gap:8px">
          <span class="nt-skeleton" style="height:26px;width:130px;border-radius:999px"></span>
          <span class="nt-skeleton" style="height:26px;width:108px;border-radius:999px"></span>
        </div>
        <span class="nt-skeleton" style="height:44px;border-radius:999px;margin-top:auto"></span>
      </article>
    `).join('');
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
      const macro = inferMacro(row);
      const micro = inferMicro(row);

      const metroInfo = getMetroInfo(row);
      const metro = displayText(metroInfo.label);

      const geo = row.tem_geo ? 'Geolocalizado' : 'Localização aproximada';
      const canal = row.tem_whatsapp ? 'Canal disponível após login' : (row.tem_email ? 'Contato disponível após login' : 'Contato protegido');
      const idade = row.faixa_idade || (row.idade_anos ? `${row.idade_anos} anos` : 'Idade não informada');

      return `
        <article class="nt-card" data-key="${esc(row.talento_key)}">
          <div class="nt-card__top">
            <div>
              <h3>${esc(displayText(row.nome_mascarado || row.primeiro_nome || 'Profissional'))}</h3>
              <p>${esc(displayText(row.cargo || 'Perfil comercial'))}</p>
            </div>
            <span class="nt-pill">${esc(idade)}</span>
          </div>

          <div class="nt-card__meta">
            <span>📍 ${esc(displayJoin([row.bairro, row.cidade, row.estado_uf]))}</span>
            <span>🧭 ${esc(displayJoin([macro, micro]) || 'Região em classificação')}</span>
            <span>🚇 ${metro}</span>
          </div>

          ${metroInfo.isNear ? `<div class="nt-metro-card">${esc(displayText(metroInfo.badge))}</div>` : ''}

          <div class="nt-card__signals">
            <span class="nt-signal">${esc(canal)}</span>
            <span class="nt-signal ${metroInfo.isNear ? '' : 'muted'}">${esc(metroInfo.detail || geo)}</span>
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
      renderSkeletons();
    }

    const btn = $('#buscarBtn');
    if (btn) btn.textContent = 'Buscando...';
    status('Consultando talentos disponíveis...');

    try {
      let list = [];

      try {
        const rows = await rpc('nt_listar_talentos_publico_v10', {
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

        list = Array.isArray(rows) ? rows : [];
        state.total = Number(list[0]?.total_count || state.total || 0);
      } catch (err) {
        console.warn('[NT] fallback listagem:', err);
        const fallback = await searchFallback();
        list = fallback.rows;
        state.total = fallback.total;
      }

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

  async function searchFallback() {
    const client = getClient();
    if (!client) return { rows: [], total: 0 };

    let query = client
      .from('nt_talentos_publicos')
      .select('talento_key,nome_mascarado,primeiro_nome,cargo,idade_anos,faixa_idade,cidade,estado_uf,bairro,regiao_macro,micro_regiao,tem_whatsapp,tem_email,tem_geo,estacao_mais_proxima,linha_metro_mais_proxima,cor_linha_metro,distancia_metro_km,tags_publicas,ativo,updated_at', { count: 'exact' })
      .eq('produto_codigo', PRODUCT_CODE)
      .eq('ativo', true);

    if (state.filters.cidade) query = query.eq('cidade', state.filters.cidade);
    if (state.filters.estado_uf) query = query.eq('estado_uf', state.filters.estado_uf);
    if (state.filters.bairro) query = query.eq('bairro', state.filters.bairro);
    if (state.filters.faixa_idade) query = query.eq('faixa_idade', state.filters.faixa_idade);
    if (state.filters.cargo) query = query.eq('cargo', state.filters.cargo);
    if (state.filters.estacao) query = query.eq('estacao_mais_proxima', state.filters.estacao);

    const from = state.offset;
    const to = state.offset + PAGE_SIZE - 1;

    const { data, error, count } = await query.order('updated_at', { ascending: false }).range(from, to);
    if (error) throw error;

    const rows = (data || []).filter((row) => {
      if (state.filters.regiao_macro && inferMacro(row) !== state.filters.regiao_macro) return false;
      if (state.filters.micro_regiao && inferMicro(row) !== state.filters.micro_regiao) return false;

      if (state.filters.termo) {
        const haystack = [
          row.nome_mascarado,
          row.cargo,
          row.bairro,
          row.cidade,
          row.tags_publicas
        ].map(lower).join(' ');
        if (!haystack.includes(lower(state.filters.termo))) return false;
      }

      return true;
    });

    return { rows, total: count || rows.length };
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
        talent = await rpcOne('nt_consumir_talento_json_v11', { p_talento_key: key });
      } catch (v11err) {
        console.warn('[NT] consumo JSON v11 indisponível, tentando compatibilidade:', v11err);
        const rows = await rpc('nt_consumir_talento_v10', { p_talento_key: key });
        talent = Array.isArray(rows) ? rows[0] : rows;
      }

      if (!talent) throw new Error('Contato não localizado.');

      state.currentTalent = talent;

      try {
        await loadContext();
      } catch (err) {
        console.warn('[NT] contexto após consumo:', err);
      }

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
    const shouldTreat = [
      'Nome', 'Cargo', 'Cidade', 'Bairro', 'Idade', 'Pretensão',
      'Metrô próximo', 'Distância até o metrô', 'Região', 'CEP'
    ].includes(label);

    const shown = shouldTreat ? displayText(value || '-') : (value || '-');
    return `<div class="nt-detail"><small>${esc(label)}</small><strong>${esc(shown)}</strong></div>`;
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
        detail('Cidade', displayJoin([talent.cidade, talent.estado_uf], '/')),
        detail('Bairro', talent.bairro),
        detail('Idade', talent.idade_anos ? `${talent.idade_anos} anos` : talent.faixa_idade),
        detail('Pretensão', talent.pretensao_salarial),
        detail('Metrô próximo', getMetroInfo(talent).hasMetro ? displayText(getMetroInfo(talent).label) : ''),
        detail('Distância até o metrô', getMetroInfo(talent).detail || ''),
        detail('Região', displayJoin([talent.regiao_macro, talent.micro_regiao])),
        detail('CEP', talent.cep)
      ].join('');
    }

    renderCurriculoBox(talent);
    renderFrases(talent);
  }

  function renderCurriculoBox(talent) {
    const box = $('#curriculoBox');
    if (!box) return;

    const url = normalize(talent?.curriculo_url);
    if (!url) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    box.hidden = false;
    box.innerHTML = `<div><strong>Currículo disponível</strong><span>Abra o currículo original do talento antes de abordar.</span></div><a class="nt-btn nt-btn-secondary" href="${esc(url)}" target="_blank" rel="noopener">Abrir currículo</a>`;
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


  function applyTrend(elId, current, previous) {
    const el = $('#' + elId);
    if (!el) return;
    if (!previous || previous === 0) { el.hidden = true; return; }
    const pct = Math.round(((current - previous) / previous) * 100);
    el.hidden = false;
    if (Math.abs(pct) < 3) { el.className = 'nt-trend neutral'; el.textContent = '→ estável'; }
    else if (pct > 0) { el.className = 'nt-trend up'; el.textContent = `↑ ${pct}%`; }
    else { el.className = 'nt-trend down'; el.textContent = `↓ ${Math.abs(pct)}%`; }
  }

  function updatePhrasePreview() {
    const text = ($('#phraseText')?.value || '').trim();
    const preview = $('#ntPhrasePreview');
    if (!preview) return;
    if (!text) { preview.hidden = true; return; }
    const nome = state.context?.primeiro_nome || 'Maria';
    const result = text
      .replace(/\{saudacao_completa\}/gi, 'Bom dia')
      .replace(/\{primeiro_nome\}/gi, nome)
      .replace(/\{nome\}/gi, nome)
      .replace(/\{operador\}/gi, state.context?.nome || 'João')
      .replace(/\{empresa\}/gi, state.context?.nome_conta || 'RH IMOB')
      .replace(/\{cidade\}/gi, 'São Paulo');
    preview.hidden = false;
    preview.textContent = result;
  }

  function exportAdminCSV() {
    const users = state.adminUsers || [];
    const recent = state.adminRecent || [];
    if (!users.length && !recent.length) return setAdminAlert('Sem dados para exportar. Atualize o painel primeiro.', 'warn');
    const sep = ';';
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let csv = 'RELATÓRIO DE OPERADORES\n';
    csv += ['Nome', 'E-mail', 'Perfil', 'Status', 'Hoje', '7 dias', '15 dias', 'Mês', 'Total'].map(q).join(sep) + '\n';
    users.forEach((u) => {
      csv += [u.nome, u.email_login || u.email, u.perfil, u.status,
        u.consumidos_hoje || 0, u.consumidos_7_dias || 0, u.consumidos_15_dias || 0,
        u.consumidos_30_dias || 0, u.consumidos_total || 0].map(q).join(sep) + '\n';
    });
    if (recent.length) {
      csv += '\nÚLTIMAS LIBERAÇÕES\n';
      csv += ['Data/hora', 'Operador', 'Talento', 'Cidade', 'Perfil'].map(q).join(sep) + '\n';
      recent.forEach((r) => {
        csv += [formatDateTimeBR(r.created_at || r.data_consumo),
          r.operador_nome || r.operador || '', r.nome_mascarado || r.primeiro_nome || '',
          [r.cidade, r.estado_uf].filter(Boolean).join('/'), r.cargo || ''].map(q).join(sep) + '\n';
      });
    }
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_nt_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function filterAdminUsers() {
    const val = ($('#usersFilterStatus')?.value || '').toUpperCase();
    const filtered = val ? (state.adminUsers || []).filter((u) => String(u.status || '').toUpperCase() === val) : (state.adminUsers || []);
    renderAdminUsers(filtered, true);
  }

  async function clonePhrasesNT() {
    if (!confirm('Personalizar frases para este plano? As frases padrão serão copiadas para edição deste cliente.')) return;
    try {
      setAdminAlert('Clonando frases padrão...', 'info');
      const res = await rpc('nt_admin_clonar_frases_v15', {});
      await loadAdminPhrases();
      await loadFrases();
      setAdminAlert(`Frases personalizadas. Clonadas: ${res?.clonadas ?? 0}.`, 'success');
    } catch (err) {
      console.error('[NT] clonar frases:', err);
      setAdminAlert('Não foi possível clonar frases. Verifique se nt_admin_clonar_frases_v15 existe no Supabase.', 'error');
    }
  }

  function renderAdminUsers(users = [], skipStore = false) {
    if (!skipStore) state.adminUsers = users;
    const tbody = $('#adminUsersTable');
    if (!tbody) return;

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="10">Nenhum usuário cadastrado neste plano.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map((u) => {
      const ativo = String(u.status || '').toUpperCase() === 'ATIVO';
      const self = state.context?.usuario_id && String(u.usuario_id) === String(state.context.usuario_id);
      const nextStatus = ativo ? 'INATIVO' : 'ATIVO';

      return `<tr>
        <td>${esc(displayText(u.nome || '-'))}</td>
        <td>${esc(u.email_login || u.email || '-')}</td>
        <td><span class="nt-pill">${esc(u.perfil || '-')}</span></td>
        <td><span class="nt-status-chip ${ativo ? 'ativo' : 'inativo'}">${esc(u.status || '-')}</span></td>
        <td><strong>${formatNumber(u.consumidos_hoje || 0)}</strong></td>
        <td><strong>${formatNumber(u.consumidos_7_dias || 0)}</strong></td>
        <td><strong>${formatNumber(u.consumidos_15_dias || 0)}</strong></td>
        <td><strong>${formatNumber(u.consumidos_30_dias || 0)}</strong></td>
        <td><strong>${formatNumber(u.consumidos_total || 0)}</strong></td>
        <td><button class="nt-mini-action js-user-status" data-user-id="${esc(u.usuario_id)}" data-next-status="${nextStatus}" ${self ? 'disabled title="Você não pode inativar a si mesmo"' : ''}>${ativo ? 'Inativar' : 'Ativar'}</button></td>
      </tr>`;
    }).join('');

    $$('.js-user-status', tbody).forEach((btn) => {
      btn.addEventListener('click', () => alterarStatusUsuario(btn.dataset.userId, btn.dataset.nextStatus));
    });
  }

  function renderAdminRecent(rows = []) {
    const tbody = $('#adminRecentTable');
    if (!tbody) return;

    const list = (rows || []).slice(0, 30);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5">Sem contatos liberados.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((r) => `
      <tr>
        <td>${esc(formatDateTimeBR(r.created_at || r.data_consumo))}</td>
        <td>${esc(displayText(r.operador_nome || r.operador || 'Operador'))}</td>
        <td>${esc(displayText(r.nome_mascarado || r.primeiro_nome || r.talento_key || '-'))}</td>
        <td>${esc(displayJoin([r.cidade, r.estado_uf], '/'))}</td>
        <td>${esc(displayText(r.cargo || '-'))}</td>
      </tr>
    `).join('');
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
      const id = f.frase_id || f.id || '';

      return `<tr>
        <td>${esc(f.prioridade || '-')}</td>
        <td>${esc(f.texto || '-')}</td>
        <td><span class="nt-status-chip ${ativa ? 'ativo' : 'inativo'}">${esc(f.status || '-')}</span></td>
        <td>${esc(f.escopo || (f.conta_id ? 'CONTA' : 'GLOBAL'))}</td>
        <td class="nt-nowrap">
          <button class="nt-mini-action js-edit-phrase" data-id="${esc(id)}">Editar</button>
          <button class="nt-mini-action js-toggle-phrase" data-id="${esc(id)}" data-status="${ativa ? 'INATIVA' : 'ATIVA'}">${ativa ? 'Inativar' : 'Ativar'}</button>
        </td>
      </tr>`;
    }).join('');

    $$('.js-edit-phrase', tbody).forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = state.phrasesAdmin?.find((x) => String(x.frase_id || x.id) === String(btn.dataset.id));
        if (!item) return;

        state.currentPhraseId = item.frase_id || item.id;
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
    if (!adminAllowed()) return;

    try {
      const data = await rpc('nt_admin_listar_frases_json_v15', {});
      const rows = normalizeRpcList(data);

      state.phrasesAdmin = rows || [];
      renderPhrases(state.phrasesAdmin);

      const own = state.phrasesAdmin.some((f) => String(f.escopo || '').toUpperCase() === 'CONTA' || f.conta_id);
      const note = $('#phrasesNote');
      if (note) {
        note.textContent = own
          ? 'Este plano possui frases personalizadas.'
          : 'Este plano está usando frases padrão. Ao salvar, a frase fica personalizada para esta conta.';
      }
      const cloneBtn = $('#clonePhrasesBtn');
      if (cloneBtn) cloneBtn.hidden = own;
    } catch (err) {
      console.error('[NT] frases admin:', err);
      if (!silent) setAdminAlert('Não foi possível carregar frases do plano.', 'error');
    }
  }


  function queueAdminLoad() {
    if (!adminAllowed()) return;

    clearTimeout(state.adminLazyTimer);
    state.adminLazyTimer = setTimeout(() => {
      if (state.loading || state.loadingFilters) {
        queueAdminLoad();
        return;
      }

      loadAdminDashboard({ silent: true }).catch((err) => {
        console.warn('[NT] painel master em segundo plano:', err);
      });
    }, 1800);
  }

  async function loadAdminDashboard({ silent = false } = {}) {
    if (!adminAllowed()) return;

    const panel = $('#adminPanel');
    if (panel) panel.hidden = false;

    if (!silent) setAdminAlert('Atualizando painel master...', 'info');

    try {
      const data = await rpcOne('nt_admin_painel_json_v15', {});
      const conta = data?.conta || {};
      const operadores = data?.operadores || [];
      const ultimos = data?.ultimos || [];

      setText('adminEmpresa', conta.nome_conta || 'Plano sem nome');
      setText('adminPlanoStatus', `Status: ${conta.status || '-'} • Conta: ${conta.conta_id || '-'}`);
      setText('adminUsuariosResumo', `${formatNumber(conta.usuarios_ativos || 0)}/${formatNumber(conta.usuarios_contratados || 0)}`);
      setText('adminUsuariosStatus', `${formatNumber(conta.usuarios_disponiveis || 0)} usuário(s) disponível(is)`);
      setText('adminLeadsConsumidos', formatNumber(conta.consumidos || 0));
      setText('adminLeadsDisponiveis', `${formatNumber(conta.saldo || 0)} disponíveis`);
      setText('adminMesResumo', formatNumber(conta.consumidos_30_dias || 0));
      setText('adminQuinzenaResumo', `${formatNumber(conta.consumidos_15_dias || 0)} nos últimos 15 dias`);
      setText('adminUsersCount', `${formatNumber(operadores.length)} usuário(s)`);
      setText('adminRecentCount', `${formatNumber(ultimos.length)} registro(s) recentes`);

      state.adminRecent = ultimos;
      renderAdminUsers(operadores);
      renderAdminRecent(ultimos);

      const mes = conta.consumidos_30_dias || 0;
      const quinzena = conta.consumidos_15_dias || 0;
      applyTrend('adminMesTrend', quinzena, Math.max(0, mes - quinzena));
      const consumed = conta.consumidos || 0;
      const total = consumed + (conta.saldo || 0);
      if (total > 0) {
        const pct = Math.round((consumed / total) * 100);
        const el = $('#adminLeadsTrend');
        if (el) {
          el.hidden = false;
          el.className = pct > 80 ? 'nt-trend down' : pct > 50 ? 'nt-trend neutral' : 'nt-trend up';
          el.textContent = `${pct}% usado`;
        }
      }

      await loadAdminPhrases({ silent: true });

      setAdminAlert('Painel atualizado com sucesso.', 'success');
      state.adminLoaded = true;
    } catch (err) {
      console.error('[NT] admin dashboard:', err);
      setAdminAlert('Não foi possível carregar o painel master. Rode o SQL V15 no Supabase Novos Talentos e tente novamente.', 'error');
    }
  }

  async function alterarStatusUsuario(usuarioId, nextStatus) {
    if (!usuarioId || !nextStatus) return;

    const label = nextStatus === 'INATIVO' ? 'inativar' : 'ativar';
    if (!confirm(`Confirmar ${label} este usuário?`)) return;

    try {
      setAdminAlert('Atualizando usuário...', 'info');
      await rpc('nt_admin_alterar_status_usuario_v15', {
        p_usuario_id: usuarioId,
        p_status: nextStatus
      });

      setAdminAlert('Usuário atualizado com sucesso.', 'success');
      await loadAdminDashboard({ silent: true });
    } catch (err) {
      console.error('[NT] status usuario:', err);
      setAdminAlert('Falha ao alterar usuário. Verifique se seu acesso é MASTER.', 'error');
    }
  }

  async function savePhrase() {
    try {
      const texto = normalize($('#phraseText')?.value);
      if (!texto || texto.length < 10) {
        return setAdminAlert('Digite uma frase com pelo menos 10 caracteres.', 'warn');
      }

      await rpc('nt_admin_salvar_frase_v15', {
        p_frase_id: state.currentPhraseId || null,
        p_texto: texto,
        p_status: $('#phraseStatus')?.value || 'ATIVA',
        p_prioridade: Number($('#phrasePriority')?.value || 1),
        p_is_favorite: !!$('#phraseFavorite')?.checked
      });

      clearPhraseForm();
      await loadAdminPhrases();
      await loadFrases();
      setAdminAlert('Frase salva com sucesso.', 'success');
    } catch (err) {
      console.error('[NT] salvar frase:', err);
      setAdminAlert('Falha ao salvar frase. Verifique se seu acesso é MASTER.', 'error');
    }
  }

  async function togglePhrase(id, statusValue) {
    if (!id) return;

    try {
      await rpc('nt_admin_alterar_status_frase_v15', {
        p_frase_id: id,
        p_status: statusValue
      });

      await loadAdminPhrases();
      await loadFrases();
      setAdminAlert('Status da frase atualizado.', 'success');
    } catch (err) {
      console.error('[NT] status frase:', err);
      setAdminAlert('Falha ao alterar status da frase.', 'error');
    }
  }

  function clearPhraseForm() {
    state.currentPhraseId = null;

    if ($('#phraseText')) $('#phraseText').value = '';
    if ($('#phraseStatus')) $('#phraseStatus').value = 'ATIVA';
    if ($('#phrasePriority')) $('#phrasePriority').value = '';
    if ($('#phraseFavorite')) $('#phraseFavorite').checked = false;
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

      if (adminAllowed()) {
        queueAdminLoad();
      }
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
    state.adminLoaded = false;
    state.currentPhraseId = null;
    state.phrasesAdmin = [];

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

      // Entrega cards primeiro; filtros carregam em paralelo/segundo plano.
      search(true).catch((err) => console.warn('[NT] busca inicial:', err));
      loadAllOptions(false).catch((err) => console.warn('[NT] filtros iniciais:', err));

      if (state.session) {
        try {
          await loadContext();
          await loadFrases();

          if (adminAllowed()) {
            queueAdminLoad();
          }
        } catch (err) {
          console.warn('[NT] Sessão sem contexto válido:', err);
          // Mantém a sessão logada para o consumo via RPC tentar corrigir vínculo por e-mail.
          state.context = null;
          updateHeader();
          updateSummary();
        }
      }

      // Busca inicial já disparada acima.
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

    $('#cidadeSelect')?.addEventListener('change', () => scheduleFilterAction(
      ['regiaoSelect', 'microSelect', 'bairroSelect'],
      ['regiao_macro', 'micro_regiao', 'bairro', 'faixa_idade', 'cargo', 'metro']
    ));

    $('#regiaoSelect')?.addEventListener('change', () => scheduleFilterAction(
      ['microSelect', 'bairroSelect'],
      ['micro_regiao', 'bairro', 'faixa_idade', 'cargo', 'metro']
    ));

    $('#microSelect')?.addEventListener('change', () => scheduleFilterAction(
      ['bairroSelect'],
      ['bairro', 'faixa_idade', 'cargo', 'metro']
    ));

    // Filtros finais não precisam recalcular todos os outros filtros a cada clique.
    // Isso deixa a percepção de resposta muito mais rápida.
    ['bairroSelect', 'idadeSelect', 'cargoSelect', 'metroSelect'].forEach((id) => {
      $('#' + id)?.addEventListener('change', () => scheduleFilterAction([], []));
    });

    $('#termoInput')?.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        scheduleFilterAction([], []);
      }
    });

    $('#buscarBtn')?.addEventListener('click', () => scheduleFilterAction([], []));
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

    $('#adminRefreshBtn')?.addEventListener('click', () => loadAdminDashboard());
    $('#exportCsvBtn')?.addEventListener('click', exportAdminCSV);
    $('#clonePhrasesBtn')?.addEventListener('click', clonePhrasesNT);
    $('#usersFilterStatus')?.addEventListener('change', filterAdminUsers);
    $('#phraseText')?.addEventListener('input', updatePhrasePreview);
    $('#savePhraseBtn')?.addEventListener('click', savePhrase);
    $('#newPhraseBtn')?.addEventListener('click', clearPhraseForm);

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
