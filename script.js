(() => {
  const EMPRESA_WHATSAPP = '5511953973268';
  const VAGAS_WHATSAPP = '5511953973268'; // fallback técnico: usado só quando a vaga não tiver responsavel_whatsapp
  const DEFAULT_EMPRESA_MESSAGE = 'Olá, vim pelo site da RH IMOB e gostaria de entender melhor como vocês podem apoiar minha empresa no recrutamento imobiliário.';
  const DEFAULT_VAGA_MESSAGE = 'Olá. Vim pelo site da RH IMOB e quero saber mais sobre as vagas.';
  const SITE_VAGAS_TABLE = 'site_vagas_publicas';
  const SITE_BASE_URL = 'https://www.rhimob.com.br';


  let JOBS = [];

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const normalizeLower = (value) => normalize(value).toLowerCase();
  const escapeHTML = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const slugify = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  function openWhatsApp(number, message) {
    const text = encodeURIComponent(message || '');
    window.open(`https://api.whatsapp.com/send?phone=${number}&text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function formatPhoneField(input) {
    if (!input) return;
    input.addEventListener('input', () => {
      let value = input.value.replace(/\D/g, '').slice(0, 11);
      if (value.length > 10) value = value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
      else if (value.length > 6) value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
      else if (value.length > 2) value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
      input.value = value;
    });
  }

  function getNtSupabaseConfig() {
    const cfg = window.RHIMOB_NOVOS_TALENTOS_SUPABASE_CONFIG || {};
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) return null;
    return cfg;
  }

  function getCorretoresSupabaseConfig() {
    const cfg = window.RHIMOB_SUPABASE_CONFIG || {};
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) return null;
    return cfg;
  }

  function supabaseHeaders(cfg, extra = {}) {
    return {
      apikey: cfg.publishableKey,
      Authorization: `Bearer ${cfg.publishableKey}`,
      ...extra
    };
  }

  function parseContentRangeTotal(response) {
    const range = response.headers.get('content-range') || response.headers.get('Content-Range') || '';
    const match = range.match(/\/(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  async function countSupabaseRows(cfg, table, query = '') {
    const base = cfg.url.replace(/\/$/, '');
    const url = `${base}/rest/v1/${table}?select=*&limit=1${query ? `&${query}` : ''}`;
    const response = await fetch(url, { headers: supabaseHeaders(cfg, { Prefer: 'count=exact' }) });
    if (!response.ok) throw new Error(`Falha ao contar ${table}: HTTP ${response.status}`);
    const total = parseContentRangeTotal(response);
    if (Number.isFinite(total)) return total;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows.length : 0;
  }

  function formatInteger(value) {
    const number = Number(value || 0);
    return number.toLocaleString('pt-BR');
  }

  function formatRoundedMil(value) {
    const number = Number(value || 0);
    if (!number) return '57 mil+';
    if (number >= 1000) return `${Math.ceil(number / 1000)} mil+`;
    return `${formatInteger(number)}+`;
  }

  function setMetric(name, value) {
    $$(`[data-rhimob-metric="${name}"]`).forEach((el) => {
      const format = el.dataset.format || 'integer';
      el.textContent = format === 'rounded-mil' ? formatRoundedMil(value) : formatInteger(value);
      el.dataset.loaded = 'true';
    });
  }

  async function hydratePublicMetrics() {
    const corretoresCfg = getCorretoresSupabaseConfig();
    const ntCfg = getNtSupabaseConfig();

    if (corretoresCfg) {
      Promise.allSettled([
        countSupabaseRows(corretoresCfg, corretoresCfg.publicTable || 'leads_publicos'),
        countSupabaseRows(corretoresCfg, 'lead_filtros_cidade'),
        countSupabaseRows(corretoresCfg, 'lead_filtros_cidade_ano_cargo')
      ]).then(([total, cidades, combinacoes]) => {
        if (total.status === 'fulfilled') setMetric('corretores_total', total.value);
        if (cidades.status === 'fulfilled') setMetric('corretores_cidades', cidades.value);
        if (combinacoes.status === 'fulfilled') setMetric('corretores_combinacoes', combinacoes.value);
      });
    }

    if (ntCfg) {
      Promise.allSettled([
        countSupabaseRows(ntCfg, 'nt_talentos_publicos', 'produto_codigo=eq.NOVOS_TALENTOS&ativo=eq.true'),
        countSupabaseRows(ntCfg, 'nt_filtro_cidade'),
        countSupabaseRows(ntCfg, 'nt_filtro_cidade_metro')
      ]).then(([total, cidades, metro]) => {
        if (total.status === 'fulfilled') setMetric('nt_total_rounded', total.value);
        if (cidades.status === 'fulfilled') setMetric('nt_cidades', cidades.value);
        if (metro.status === 'fulfilled') setMetric('nt_metro', metro.value);
      });
    }
  }

  function splitJobText(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return String(value || '')
      .split(/\n|\r|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizePhone(value) {
    const digits = String(value || '').replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    if (digits.length >= 12 && digits.length <= 13) return digits;
    if (digits.length > 13) return digits.slice(-13);
    return digits;
  }

  function inferMediaType(row) {
    const explicit = normalizeLower(row.midia_tipo || row.media_type);
    if (['imagem', 'image'].includes(explicit)) return 'imagem';
    if (['video', 'vídeo'].includes(explicit)) return 'video';
    if (explicit === 'instagram') return 'instagram';
    if (normalize(row.video_url || row.videoUrl)) return 'video';
    if (normalize(row.instagram_url || row.instagramUrl)) return 'instagram';
    if (normalize(row.imagem_url || row.imageUrl)) return 'imagem';
    return 'nenhum';
  }

  function normalizeJobFromSupabase(row) {
    const title = normalize(row.titulo || 'Vaga RH IMOB');
    const cidadeUf = [row.cidade, row.estado_uf].filter(Boolean).join('/');
    const location = normalize(row.localidade || cidadeUf || 'Consultar região');
    const id = normalize(row.vaga_id);
    const imageUrl = normalize(row.imagem_url);
    const videoUrl = normalize(row.video_url);
    const instagramUrl = normalize(row.instagram_url);
    const mediaType = inferMediaType(row);
    const responsibleName = normalize(row.responsavel_nome || 'Mariana');
    const responsibleWhatsapp = normalizePhone(row.responsavel_whatsapp || '');
    const responsibleCompany = normalize(row.responsavel_empresa || 'RH IMOB');
    const responsibleRole = normalize(row.responsavel_cargo || 'Recrutamento imobiliário');
    const responsibleEmail = normalize(row.responsavel_email || '');

    const isNew = row.updated_at && (Date.now() - new Date(row.updated_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
    const badgeText = normalize(row.selo) || (isNew ? '🆕 Nova' : normalize(row.categoria || 'Vaga ativa'));
    return {
      id,
      title,
      category: normalize(row.categoria || 'Vagas'),
      location,
      contract: normalize(row.modalidade || 'Consultar condição'),
      pay: normalize(row.remuneracao || 'Condição informada pela RH IMOB'),
      schedule: normalize(row.horario || ''),
      summary: normalize(row.resumo || 'Oportunidade cadastrada pela RH IMOB.'),
      highlights: splitJobText(row.destaques).slice(0, 5),
      details: splitJobText(row.detalhes || row.requisitos || row.atividades).slice(0, 8),
      badge: badgeText,
      isNew,
      media: {
        type: mediaType,
        imageUrl,
        videoUrl,
        instagramUrl,
        alt: normalize(row.midia_alt || title)
      },
      responsible: {
        name: responsibleName,
        whatsapp: responsibleWhatsapp,
        company: responsibleCompany,
        role: responsibleRole,
        email: responsibleEmail
      }
    };
  }

  function setJobsLoading(isLoading) {
    const grid = $('#jobsGrid');
    if (!grid) return;
    if (isLoading) {
      grid.innerHTML = '<div class="jobs-note reveal in-view"><strong>Atualizando vagas...</strong><span>Buscando oportunidades ativas cadastradas pela RH IMOB.</span></div>';
    }
  }

  async function fetchDynamicJobsRows(cfg) {
    const base = cfg.url.replace(/\/$/, '');
    const selectFields = [
      'vaga_id','titulo','categoria','localidade','cidade','estado_uf','modalidade','remuneracao','horario',
      'resumo','destaques','detalhes','requisitos','atividades','selo','prioridade','status','updated_at',
      'imagem_url','video_url','instagram_url','midia_tipo','midia_alt',
      'responsavel_nome','responsavel_whatsapp','responsavel_empresa','responsavel_cargo','responsavel_email'
    ];

    const params = new URLSearchParams();
    params.set('select', selectFields.join(','));
    params.set('status', 'eq.ATIVA');
    params.set('order', 'prioridade.asc,updated_at.desc');

    const url = `${base}/rest/v1/${SITE_VAGAS_TABLE}?${params.toString()}`;
    const response = await fetch(url, { headers: supabaseHeaders(cfg) });
    const text = await response.text().catch(() => '');

    if (!response.ok) {
      throw new Error(`Falha ao carregar vagas: HTTP ${response.status} ${text}`);
    }

    return text ? JSON.parse(text) : [];
  }

  async function loadDynamicJobs() {
    const cfg = getNtSupabaseConfig();
    if (!cfg || !$('#jobsGrid')) return false;

    const rows = await fetchDynamicJobsRows(cfg);

    if (!Array.isArray(rows) || !rows.length) return false;
    JOBS = rows.map(normalizeJobFromSupabase).filter((job) => job.id && job.title);
    return JOBS.length > 0;
  }

  async function initJobs() {
    if (!$('#jobsGrid')) return;
    setJobsLoading(true);
    try {
      const loaded = await loadDynamicJobs();
      if (!loaded) JOBS = [];
      renderJobs('todas');
      if (loaded) setTimeout(highlightSharedJobFromUrl, 120);
      if (!loaded) console.warn('RH IMOB: nenhuma vaga ativa retornada pelo Supabase.');
    } catch (error) {
      console.warn('RH IMOB: falha ao carregar vagas dinâmicas.', error);
      JOBS = [];
      renderJobs('todas');
    }
  }

  function setupMenu() {
    const toggle = $('.nav-toggle');
    const nav = $('#menu-principal');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    $$('a', nav).forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function setupReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => obs.observe(el));
  }

  function setupWhatsAppLinks() {
    $$('.js-whatsapp').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const type = link.dataset.type || 'suporte';
        if (type === 'empresa') {
          openCompanyLeadModal(link);
          return;
        }
        openSupportModal(type);
      });
    });
  }

  function getTriggerOrigin(trigger) {
    if (!trigger) return 'Site RH IMOB';
    return normalize(trigger.dataset?.message) || normalize(trigger.textContent) || normalize(trigger.getAttribute?.('aria-label')) || 'Site RH IMOB';
  }

  function openSupportModal(context = 'suporte') {
    const modal = $('#supportModal');
    if (!modal) {
      if (context === 'vaga') window.location.href = '/vagas.html#vagas';
      else openCompanyLeadModal(null);
      return;
    }
    modal.dataset.context = context || 'suporte';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeSupportModal() {
    const modal = $('#supportModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  // ── MOTOR DE CAPTAÇÃO CONTEXTUAL ──────────────────────────────
  // Cada página ranqueia para uma busca diferente no Google e chega gente com
  // intenção diferente (contratar vs. trabalhar). O modal é UM componente, mas
  // a copy, a jornada e a origem vêm do contexto da página (mapa abaixo).
  const LEAD_DEFAULT = {
    empresa: {
      titulo: 'Receba uma proposta de recrutamento',
      subtitulo: 'Conte o que você precisa. A Mariana retorna em até 1 dia útil.',
      cta: 'Enviar minha demanda →',
      campoLabel: 'O que você precisa contratar?',
      campoPlaceholder: 'Ex.: Corretor com CRECI, SDR, Gerente comercial',
      origem: 'Site RH IMOB'
    },
    candidato: {
      titulo: 'Entre no banco de talentos',
      subtitulo: 'Deixe seu contato e receba oportunidades no seu perfil.',
      cta: 'Quero receber vagas →',
      campoLabel: 'Cargo/área em que você atua',
      campoPlaceholder: 'Ex.: Corretor, SDR, Gerente, Estágio',
      origem: 'Site RH IMOB'
    }
  };
  // Mapa por página: journey = intenção primária; copy sob medida do ângulo da busca.
  const LEAD_CONTEXTS = {
    '/': { journey: 'empresa', empresa: { titulo: 'Receba uma proposta de recrutamento', subtitulo: 'Conte o perfil que precisa e a Mariana volta em 1 dia útil.', origem: 'Home — proposta' } },
    '/index.html': { journey: 'empresa', empresa: { titulo: 'Receba uma proposta de recrutamento', subtitulo: 'Conte o perfil que precisa e a Mariana volta em 1 dia útil.', origem: 'Home — proposta' } },
    '/contratar.html': { journey: 'empresa', empresa: { titulo: 'Contratar corretores e talentos', subtitulo: 'Diga o perfil e o volume — montamos a seleção para você.', origem: 'Contratar' } },
    '/corretores.html': { journey: 'empresa', empresa: { titulo: 'Quero corretores para minha operação', subtitulo: 'Base com CRECI ativo. Conte sua necessidade.', origem: 'Plataforma Corretores' } },
    '/plataformas.html': { journey: 'empresa', empresa: { titulo: 'Quero acesso às plataformas', subtitulo: 'Fale com a Mariana para liberar seu acesso.', origem: 'Plataformas' } },
    '/vagas.html': { journey: 'candidato', candidato: { titulo: 'Quero vagas de corretor', subtitulo: 'Entre no banco e receba oportunidades no seu perfil.', origem: 'Vagas SP' } },
    '/carreira.html': { journey: 'candidato', candidato: { titulo: 'Vagas com leads e ajuda de custo', subtitulo: 'Trabalhe em imobiliária com estrutura. Deixe seu contato.', origem: 'Carreira — autônomo SP' } },
    '/salario-corretor-imoveis.html': { journey: 'candidato', candidato: { titulo: 'Quero ganhar mais como corretor', subtitulo: 'Receba vagas com a comissão e as condições que você busca.', origem: 'Página salário' } },
    '/vendedor-alto-ticket.html': { journey: 'candidato', candidato: { titulo: 'Quero vender alto ticket', subtitulo: 'Oportunidades com comissões de R$10 a R$30 mil por venda.', campoLabel: 'Sua experiência em vendas', origem: 'Alto ticket' } },
    '/aberto-a-propostas.html': { journey: 'candidato', candidato: { titulo: 'Estou aberto a propostas', subtitulo: 'Corretor ou gestor em transição? Receba oportunidades certas.', origem: 'Aberto a propostas' } },
    '/contrato-corretor-autonomo.html': { journey: 'candidato', candidato: { titulo: 'Quero atuar como corretor autônomo', subtitulo: 'Vagas de parceria com contrato claro. Deixe seu contato.', origem: 'Contrato autônomo' } },
    '/blog/como-contratar-corretor-imoveis.html': { journey: 'empresa', empresa: { titulo: 'Contratar corretor autônomo', subtitulo: 'Fazemos a seleção pra você. Conte sua necessidade.', origem: 'Blog — como contratar' } },
    '/blog/como-montar-equipe-corretores.html': { journey: 'empresa', empresa: { titulo: 'Montar minha equipe de corretores', subtitulo: 'Do perfil ao time pronto. Fale com a Mariana.', origem: 'Blog — montar equipe' } },
    '/blog/equipe-lancamento-imobiliario.html': { journey: 'empresa', empresa: { titulo: 'Equipe para lançamento', subtitulo: 'Time comercial dimensionado para o seu lançamento.', origem: 'Blog — lançamento' } },
    '/blog/corretor-autonomo-vs-clt.html': { journey: 'empresa', empresa: { titulo: 'Recrutar no modelo certo', subtitulo: 'Autônomo, PJ ou CLT — montamos a seleção conforme sua operação.', origem: 'Blog — autônomo vs CLT' } },
    '/blog/quanto-custa-recrutamento-imobiliario.html': { journey: 'empresa', empresa: { titulo: 'Receber proposta de recrutamento', subtitulo: 'Sem custo fixo de RH interno. Conte sua demanda.', origem: 'Blog — custo recrutamento' } },
    '/blog/creci-o-que-e-como-verificar.html': { journey: 'candidato', candidato: { titulo: 'Quero vagas para corretor com CRECI', subtitulo: 'Tem CRECI ativo? Receba oportunidades no seu perfil.', origem: 'Blog — CRECI' } }
  };

  function titleCaseCidade(slug) {
    return String(slug || '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Resolve o contexto da página atual (+ cidade dinâmica das páginas corretor-<cidade>).
  function resolvePageContext() {
    let path = location.pathname.replace(/\/index\.html$/, '/');
    if (path.length > 1) path = path.replace(/\/$/, '');
    if (LEAD_CONTEXTS[path]) return LEAD_CONTEXTS[path];
    // (?:\.html)? — o cleanUrls do Vercel serve sem extensão em produção, mas o
    // arquivo local ainda é .html; aceitar os dois evita o contexto quebrar.
    const m = path.match(/\/corretor-([a-z-]+)(?:\.html)?$/);
    if (m) {
      const cidade = titleCaseCidade(m[1]);
      return { journey: 'empresa', empresa: { titulo: `Contratar corretor em ${cidade}`, subtitulo: 'Selecionamos profissionais da região para sua operação.', origem: `Contratar ${cidade}`, prefill: { cidade } } };
    }
    const mv = path.match(/\/vagas-corretor-([a-z-]+)(?:\.html)?$/);
    if (mv) {
      const cidade = titleCaseCidade(mv[1]);
      return { journey: 'candidato', candidato: { titulo: `Vagas de corretor em ${cidade}`, subtitulo: 'Receba oportunidades reais de imobiliárias e incorporadoras da região.', origem: `Vagas ${cidade}`, campoLabel: 'Cargo/área em que você atua', prefill: { cidade } } };
    }
    return null;
  }

  // Monta o contexto final para abrir o modal: página + jornada + overrides do CTA.
  function buildLeadContext(journey, trigger) {
    const page = resolvePageContext();
    const jn = journey || trigger?.dataset?.journey || page?.journey || 'empresa';
    const base = { ...LEAD_DEFAULT[jn], ...(page && page[jn]) };
    // Overrides no próprio botão (data-*): permite CTA específico dentro da página.
    if (trigger?.dataset?.origem) base.origem = trigger.dataset.origem;
    if (trigger?.dataset?.titulo) base.titulo = trigger.dataset.titulo;
    if (trigger?.dataset?.subtitulo) base.subtitulo = trigger.dataset.subtitulo;
    // Contexto vindo do template (ex.: notícia) via window.RH_LEAD_CONTEXT.
    if (window.RH_LEAD_CONTEXT && window.RH_LEAD_CONTEXT[jn]) Object.assign(base, window.RH_LEAD_CONTEXT[jn]);
    base.journey = jn;
    return base;
  }

  // Injeta UMA vez o markup + o CSS do modal (funciona em qualquer página).
  function ensureLeadModal() {
    if ($('#companyLeadModal')) return;
    const css = document.createElement('style');
    css.textContent = `
      #companyLeadModal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:16px}
      #companyLeadModal[aria-hidden="false"]{display:flex}
      #companyLeadModal .rhlm-ov{position:absolute;inset:0;background:rgba(22,8,38,.62);backdrop-filter:blur(2px)}
      #companyLeadModal .rhlm-card{position:relative;width:100%;max-width:440px;background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(22,8,38,.4);padding:26px 24px 22px;max-height:92vh;overflow:auto;animation:rhlmIn .22s ease}
      @keyframes rhlmIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
      #companyLeadModal .rhlm-x{position:absolute;top:12px;right:14px;border:none;background:none;font-size:24px;line-height:1;color:#9385a8;cursor:pointer}
      #companyLeadModal h3{margin:0 6px 6px 0;font-size:20px;font-weight:900;color:#2b124d;line-height:1.25}
      #companyLeadModal .rhlm-sub{margin:0 0 18px;font-size:14px;color:#6b5e7e;line-height:1.5}
      #companyLeadModal label{display:block;font-size:12.5px;font-weight:700;color:#2b124d;margin-bottom:12px}
      #companyLeadModal input,#companyLeadModal select,#companyLeadModal textarea{width:100%;box-sizing:border-box;margin-top:5px;padding:12px 13px;border:1.5px solid #e5ddf2;border-radius:11px;font-size:15px;font-family:inherit;outline:none}
      #companyLeadModal input:focus,#companyLeadModal select:focus,#companyLeadModal textarea:focus{border-color:#7c3aed}
      #companyLeadModal .rhlm-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      #companyLeadModal .rhlm-more{margin:2px 0 14px}
      #companyLeadModal .rhlm-more summary{cursor:pointer;font-size:12.5px;font-weight:700;color:#7c3aed;list-style:none}
      #companyLeadModal .rhlm-btn{width:100%;padding:14px;border:none;border-radius:12px;background:#7c3aed;color:#fff;font-size:15px;font-weight:800;cursor:pointer}
      #companyLeadModal .rhlm-help{margin:12px 0 0;font-size:11.5px;color:#9385a8;line-height:1.5;text-align:center}
      body.modal-open{overflow:hidden}
    `;
    document.head.appendChild(css);
    const wrap = document.createElement('div');
    wrap.id = 'companyLeadModal';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = `
      <div class="rhlm-ov" data-close-company-lead-modal></div>
      <div class="rhlm-card">
        <button type="button" class="rhlm-x" data-close-company-lead-modal aria-label="Fechar">×</button>
        <h3 id="rhlmTitulo">Fale com a Mariana</h3>
        <p class="rhlm-sub" id="rhlmSub">Deixe seu contato.</p>
        <form id="companyLeadForm" class="js-company-lead-form">
          <input type="hidden" name="origem" value="" />
          <input type="hidden" name="tipo" value="empresa" />
          <label>Nome<input type="text" name="nome" autocomplete="name" placeholder="Seu nome" required /></label>
          <label>WhatsApp<input type="tel" name="whatsapp" autocomplete="tel" placeholder="(11) 99999-9999" required /></label>
          <label>Cidade/Estado<input type="text" name="cidade" placeholder="Ex.: São Paulo/SP" /></label>
          <label id="rhlmCampoWrap"><span id="rhlmCampoLabel">O que você precisa contratar?</span><input type="text" name="cargoVaga" id="rhlmCampo" placeholder="" /></label>
          <label id="rhlmPerfilWrap">Já atua como corretor?<select name="perfilCandidato"><option value="">Selecione</option><option value="Sim, já atua como corretor">Sim, já atua como corretor</option><option value="Não, estou começando agora">Não, estou começando agora</option></select></label>
          <details class="rhlm-more" id="rhlmMore">
            <summary>Detalhar (opcional)</summary>
            <div class="rhlm-row" style="margin-top:10px">
              <label>Quantidade<input type="text" name="quantidade" placeholder="Ex.: 3" /></label>
              <label>Urgência<select name="urgencia"><option value="">Selecione</option><option>Imediata</option><option>Até 15 dias</option><option>Até 30 dias</option><option>Sem pressa</option></select></label>
            </div>
            <label>Mensagem<textarea name="mensagem" rows="2" placeholder="Algo que a Mariana deva saber"></textarea></label>
          </details>
          <button type="submit" class="rhlm-btn" id="rhlmSubmit">Enviar →</button>
          <p class="rhlm-help">A mensagem abre no WhatsApp da Mariana para você revisar. Seus dados seguem a <a href="/politica.html">LGPD</a>.</p>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => { if (e.target === wrap.querySelector('.rhlm-ov')) closeCompanyLeadModal(); });
  }

  function openLeadModal(journey, trigger) {
    ensureLeadModal();
    const ctx = buildLeadContext(journey, trigger);
    const modal = $('#companyLeadModal');
    const form = $('#companyLeadForm');
    if (!modal || !form) return;
    form.reset();
    $('#rhlmTitulo').textContent = ctx.titulo;
    $('#rhlmSub').textContent = ctx.subtitulo;
    $('#rhlmCampoLabel').textContent = ctx.campoLabel || LEAD_DEFAULT[ctx.journey].campoLabel;
    $('#rhlmCampo').placeholder = ctx.campoPlaceholder || LEAD_DEFAULT[ctx.journey].campoPlaceholder;
    $('#rhlmSubmit').textContent = ctx.cta || LEAD_DEFAULT[ctx.journey].cta;
    // quantidade/urgência só fazem sentido para empresa; perfil (já é corretor?) só para candidato
    $('#rhlmMore').style.display = ctx.journey === 'empresa' ? '' : 'none';
    $('#rhlmPerfilWrap').style.display = ctx.journey === 'candidato' ? '' : 'none';
    if (form.elements.origem) form.elements.origem.value = ctx.origem || 'Site RH IMOB';
    if (form.elements.tipo) form.elements.tipo.value = ctx.journey;
    if (ctx.prefill?.cidade && form.elements.cidade) form.elements.cidade.value = ctx.prefill.cidade;
    closeSupportModal();
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => form.elements.nome?.focus(), 60);
  }

  // Compatível com os 29 CTAs js-company já existentes.
  function openCompanyLeadModal(trigger) { openLeadModal('empresa', trigger); }
  function openCandidateLeadModal(trigger) { openLeadModal('candidato', trigger); }
  window.RHLead = { open: openLeadModal };

  function closeCompanyLeadModal() {
    const modal = $('#companyLeadModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  // Religа CTAs de âncora/scroll para ABRIR o modal (empresa ou candidato conforme a página).
  function setupLeadEngine() {
    ensureLeadModal();
    const page = resolvePageContext();
    const pageJourney = page?.journey || 'empresa';
    // Qualquer link que aponte para a seção de proposta/contato/formulário — na
    // própria página OU na home (/#contato) — passa a ABRIR o modal contextual,
    // em vez de rolar a tela ou navegar para a home e perder o contexto.
    const wantsLead = (href) => /(^|\/)#(proposta|contato|formulario|planos|inscricao|cadastro)$/.test(href || '');
    $$('a[href]').forEach((el) => {
      if (el.dataset.leadWired) return;
      const href = el.getAttribute('href') || '';
      const isCandidate = el.classList.contains('js-candidato') || href.replace(/\/$/, '').endsWith('#banco-talentos') || href.replace(/\/$/, '').endsWith('#vagas-cta');
      if (!wantsLead(href) && !el.classList.contains('js-open-lead') && !isCandidate) return;
      el.dataset.leadWired = '1';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openLeadModal(el.dataset.journey || (isCandidate ? 'candidato' : pageJourney), el);
      });
    });
    // Botões/spans que não são <a> (ex.: .js-open-lead, perfil-card-cta):
    $$('.js-open-lead, .js-candidato').forEach((el) => {
      if (el.tagName === 'A' || el.dataset.leadWired) return; el.dataset.leadWired = '1';
      el.addEventListener('click', (e) => { e.preventDefault(); openLeadModal(el.dataset.journey || (el.classList.contains('js-candidato') ? 'candidato' : pageJourney), el); });
    });
    // Fecha no ESC:
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCompanyLeadModal(); });
  }

  function openJobsPath() {
    closeSupportModal();
    const jobsSection = $('#vagas');
    if (jobsSection) {
      jobsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.location.href = '/vagas.html#vagas';
  }

  function setupSupportModal() {
    const supportModal = $('#supportModal');
    if (supportModal) {
      $$('[data-close-support-modal]').forEach((el) => el.addEventListener('click', closeSupportModal));
      $$('.js-support-company', supportModal).forEach((el) => el.addEventListener('click', () => openCompanyLeadModal(el)));
      $$('.js-support-jobs', supportModal).forEach((el) => el.addEventListener('click', openJobsPath));
    }

    $$('.js-open-company-lead, a[href="#contratar"], a[href="/#contratar"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openCompanyLeadModal(link);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (supportModal?.getAttribute('aria-hidden') === 'false') closeSupportModal();
      if ($('#companyLeadModal')?.getAttribute('aria-hidden') === 'false') closeCompanyLeadModal();
    });
  }

  function buildCompanyLeadMessage(data) {
    const lines = [];
    if (data.origem) lines.push(`📋 Novo contato — ${data.origem}`);
    lines.push('Olá, Mariana. Vim pelo site da RH IMOB e quero contratar profissionais.');
    const add = (label, val) => { if (val) lines.push(`${label}: ${val}`); };
    lines.push('');
    add('Nome', data.nome);
    add('Empresa', data.empresa);
    add('WhatsApp', data.whatsapp);
    add('Cidade/Estado', data.cidade);
    add('Tipo de demanda', data.demanda);
    add('O que precisa contratar', data.cargoVaga);
    add('Quantidade', data.quantidade);
    add('Urgência/prazo', data.urgencia);
    add('Formato de contratação', data.formatoContratacao);
    add('Remuneração oferecida', data.remuneracao);
    add('Benefícios', data.beneficios);
    add('Exigências da vaga', data.exigencias);
    add('Mensagem', data.mensagem);
    return lines.join('\n');
  }

  // ── CAPTURA PROGRESSIVA DE LEAD ────────────────────────────────
  // Salva o lead no Supabase (site_leads) assim que houver nome ou telefone,
  // ANTES de abrir o WhatsApp. Nunca perde lead, mesmo com envio incompleto.
  let _leadSession = null;
  function ensureLeadSession() {
    if (_leadSession) return _leadSession;
    try { _leadSession = sessionStorage.getItem('rh_lead_sid'); } catch (e) {}
    if (!_leadSession) {
      _leadSession = 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      try { sessionStorage.setItem('rh_lead_sid', _leadSession); } catch (e) {}
    }
    return _leadSession;
  }
  function saveLeadEmpresa(form, enviou) {
    const cfg = getNtSupabaseConfig();
    if (!cfg) return;
    const g = (n) => normalize(form.elements[n]?.value);
    const nome = g('nome'), whatsapp = g('whatsapp');
    if (!nome && !whatsapp) return; // ainda não há nada útil para salvar
    // Cada gravação recebe um id único (prefixo estável da sessão + sufixo único),
    // porque session_id tem constraint UNIQUE. O painel agrupa pelo prefixo antes
    // do "#" e funde as linhas da mesma pessoa em 1 lead completo.
    const base = ensureLeadSession();
    const tipo = g('tipo') || 'empresa';
    const row = {
      session_id: base + '#' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome, whatsapp,
      empresa: g('empresa'), cidade: g('cidade'), cargo_vaga: g('cargoVaga'),
      quantidade: g('quantidade'), urgencia: g('urgencia'),
      formato_contratacao: g('formatoContratacao'), remuneracao: g('remuneracao'),
      beneficios: g('beneficios'), exigencias: g('exigencias'),
      mensagem: g('mensagem') || [g('perfilDesejado'), g('detalhes')].filter(Boolean).join(' | '),
      tipo,
      origem: g('origem') || document.title || location.pathname,
      pagina: location.href,
      enviou_whatsapp: !!enviou
    };
    // INSERT simples (cada gravação = foto completa do formulário naquele momento).
    // Não uso upsert/merge-duplicates porque o público não tem permissão de
    // LEITURA na tabela (protege os telefones dos leads), e o upsert do PostgREST
    // precisa de SELECT interno. O painel deduplica por session_id no servidor.
    const url = `${cfg.url.replace(/\/$/, '')}/rest/v1/site_leads`;
    const headers = supabaseHeaders(cfg, { 'Content-Type': 'application/json', Prefer: 'return=minimal' });
    fetch(url, { method: 'POST', headers, body: JSON.stringify(row) })
      .then((r) => {
        // Se a coluna `tipo` ainda não existir no banco (migração pendente),
        // reenvia sem ela — nunca perde o lead. O tipo também vai na origem.
        if (!r.ok) {
          const { tipo: _t, ...semTipo } = row;
          semTipo.origem = `[${tipo}] ${semTipo.origem}`;
          return fetch(url, { method: 'POST', headers, body: JSON.stringify(semTipo) });
        }
      })
      .catch(() => {});
  }

  function setupCompanyForm() {
    const forms = $$('.js-company-lead-form, #leadForm, #companyLeadForm');
    forms.forEach((form) => {
      if (!form || form.dataset.companyFormReady === 'true') return;
      form.dataset.companyFormReady = 'true';
      formatPhoneField(form.elements.whatsapp);
      // captura progressiva: salva ao sair dos campos-chave
      ['nome', 'whatsapp', 'cidade', 'cargoVaga'].forEach((n) => {
        const el = form.elements[n];
        if (el) el.addEventListener('blur', () => saveLeadEmpresa(form, false));
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = {
          nome: normalize(form.elements.nome?.value),
          empresa: normalize(form.elements.empresa?.value),
          whatsapp: normalize(form.elements.whatsapp?.value),
          cidade: normalize(form.elements.cidade?.value),
          cargoVaga: normalize(form.elements.cargoVaga?.value),
          perfilCandidato: normalize(form.elements.perfilCandidato?.value),
          quantidade: normalize(form.elements.quantidade?.value),
          urgencia: normalize(form.elements.urgencia?.value),
          // demanda não tem coluna própria no site_leads (não sai daqui pro banco,
          // só entra na mensagem) — ver saveLeadEmpresa/nota 2026-08-04.
          demanda: normalize(form.elements.demanda?.value),
          formatoContratacao: normalize(form.elements.formatoContratacao?.value),
          remuneracao: normalize(form.elements.remuneracao?.value),
          beneficios: normalize(form.elements.beneficios?.value),
          exigencias: normalize(form.elements.exigencias?.value),
          origem: normalize(form.elements.origem?.value),
          mensagem: normalize(form.elements.mensagem?.value)
        };
        // Só bloqueia campos que estão VISÍVEIS e marcados como required no HTML.
        // Evita a armadilha de exigir campo escondido (dentro de <details> fechado).
        const missingEl = Array.from(form.querySelectorAll('[required]'))
          .find((el) => el.offsetParent !== null && !normalize(el.value));
        if (missingEl) {
          missingEl.focus();
          missingEl.reportValidity?.();
          return;
        }
        saveLeadEmpresa(form, true);
        const tipo = normalize(form.elements.tipo?.value) || 'empresa';
        if (tipo === 'candidato') {
          openWhatsApp(VAGAS_WHATSAPP, buildCandidateLeadMessage(data));
        } else {
          openWhatsApp(EMPRESA_WHATSAPP, buildCompanyLeadMessage(data));
        }
        closeCompanyLeadModal();
      });
    });

    $$('[data-close-company-lead-modal]').forEach((el) => el.addEventListener('click', closeCompanyLeadModal));
  }

  function buildCandidateLeadMessage(data) {
    const lines = [];
    const perfilTag = data.perfilCandidato ? ` · ${data.perfilCandidato}` : '';
    if (data.origem) lines.push(`📋 Novo contato — ${data.origem}${perfilTag}`);
    lines.push('Olá, Mariana! Vim pelo site da RH IMOB e quero receber vagas.');
    const add = (label, val) => { if (val) lines.push(`${label}: ${val}`); };
    lines.push('');
    add('Nome', data.nome);
    add('Cidade', data.cidade);
    add('Já atua como corretor?', data.perfilCandidato);
    add('Cargo/área', data.cargoVaga);
    add('Observação', data.mensagem);
    return lines.join('\n');
  }


  function getJobShareKey(job) {
    return normalize(job?.id || 'vaga-rh-imob');
  }

  function getJobShareUrl(job) {
    const key = getJobShareKey(job);
    // Página individual da vaga (OG próprio, compartilhável isoladamente)
    return `${SITE_BASE_URL.replace(/\/$/, '')}/vaga/${key}`;
  }

  function buildJobShareText(job) {
    const url = getJobShareUrl(job);
    const highlights = (job.highlights || []).slice(0, 3).map((item) => `✅ ${item}`);
    return [
      'Olá! Estou te enviando uma oportunidade publicada no site da RH IMOB.',
      '',
      `🏢 Vaga: ${job.title}`,
      job.location ? `📍 Local: ${job.location}` : '',
      job.contract ? `💼 Modalidade/condição: ${job.contract}` : '',
      job.pay ? `💰 Remuneração: ${job.pay}` : '',
      job.schedule ? `🕒 Rotina/horário: ${job.schedule}` : '',
      '',
      job.summary ? `Resumo: ${job.summary}` : '',
      '',
      highlights.length ? 'Destaques:' : '',
      ...highlights,
      '',
      'Para ver a vaga completa no site da RH IMOB:',
      url
    ].filter(Boolean).join('\n');
  }

  async function shareJob(jobId, button) {
    const job = getJobById(jobId);
    if (!job) return;

    const text = buildJobShareText(job);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    flashShareButton(button, 'Abrindo...');

    try {
      const popup = window.open(whatsappUrl, '_blank', 'noopener');
      if (popup) return;
    } catch (error) {
      console.warn('RH IMOB: não foi possível abrir o compartilhamento direto.', error);
    }

    try {
      await navigator.clipboard.writeText(text);
      flashShareButton(button, 'Mensagem copiada');
      alert('O WhatsApp não abriu automaticamente. A mensagem completa da vaga foi copiada para você colar e enviar.');
    } catch (error) {
      window.prompt('Copie a mensagem completa da vaga:', text);
      flashShareButton(button, 'Compartilhar vaga');
    }
  }

  function flashShareButton(button, label) {
    if (!button) return;
    const oldText = button.textContent;
    button.textContent = label;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = oldText;
      button.disabled = false;
    }, 1800);
  }

  function getSharedJobIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return normalize(params.get('vaga'));
  }

  function highlightSharedJobFromUrl() {
    const sharedId = getSharedJobIdFromUrl();
    if (!sharedId) return;

    const job = getJobById(sharedId);
    if (!job) return;

    $$('.job-filter').forEach((btn) => btn.classList.toggle('is-active', (btn.dataset.filter || 'todas') === 'todas'));

    const cards = $$('.job-card[data-job-id]');
    const card = cards.find((el) => el.dataset.jobId === sharedId);
    if (!card) return;

    card.classList.add('is-shared-target');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderJobDetails(job) {
    const items = (job.details || []).map((item) => `<li>${escapeHTML(item)}</li>`).join('');
    if (!items) return '';
    return `<details class="job-more"><summary>Ver mais detalhes</summary><div class="job-more-section"><strong>Detalhes da vaga</strong><ul>${items}</ul></div></details>`;
  }

  function renderJobMedia(job) {
    const media = job.media || {};
    const type = normalizeLower(media.type);
    const alt = escapeHTML(media.alt || job.title || 'Vaga RH IMOB');
    if (type === 'video' && media.videoUrl) {
      return `<figure class="job-media job-media-video"><video controls preload="metadata" src="${escapeHTML(media.videoUrl)}" aria-label="${alt}"></video></figure>`;
    }
    if (type === 'instagram' && media.instagramUrl) {
      return `<a class="job-media job-media-instagram" href="${escapeHTML(media.instagramUrl)}" target="_blank" rel="noopener noreferrer"><span>Ver post da vaga no Instagram</span><strong>Instagram da oportunidade</strong></a>`;
    }
    if ((type === 'imagem' || type === 'image') && media.imageUrl) {
      return `<figure class="job-media job-media-image"><img src="${escapeHTML(media.imageUrl)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></figure>`;
    }
    if (media.imageUrl) {
      return `<figure class="job-media job-media-image"><img src="${escapeHTML(media.imageUrl)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></figure>`;
    }
    return '';
  }

  function createJobCard(job) {
    const highlights = (job.highlights || []).slice(0, 4).map((item) => `<li>${escapeHTML(item)}</li>`).join('');
    const schedule = job.schedule ? `<span>🕒 ${escapeHTML(job.schedule)}</span>` : '';
    const responsible = job.responsible?.name ? `<span>👤 ${escapeHTML(job.responsible.name)}${job.responsible.company ? ' • ' + escapeHTML(job.responsible.company) : ''}</span>` : '';
    return `
      <article class="job-card reveal in-view" data-category="${escapeHTML(job.category)}" data-job-id="${escapeHTML(job.id)}">
        ${renderJobMedia(job)}
        <div class="job-card-head">
          <span class="job-badge">${escapeHTML(job.badge)}</span>
          <h3>${escapeHTML(job.title)}</h3>
          <div class="job-location">📍 ${escapeHTML(job.location)}</div>
        </div>
        <div class="job-card-body">
          <p>${escapeHTML(job.summary)}</p>
          <div class="job-meta"><span>💼 ${escapeHTML(job.contract)}</span><span>💰 ${escapeHTML(job.pay)}</span>${schedule}${responsible}</div>
          <ul class="job-list">${highlights}</ul>
          ${renderJobDetails(job)}
          <div class="job-actions">
            <button class="btn btn-primary btn-full js-open-job" type="button" data-job-id="${escapeHTML(job.id)}">Tenho interesse</button>
            <button class="btn btn-secondary btn-full js-share-job" type="button" data-job-share-id="${escapeHTML(job.id)}">Compartilhar vaga</button>
          </div>
        </div>
      </article>`;
  }

  let _activeFilter = 'todas';
  let _activeSearch = '';

  function renderJobs(filter, search) {
    if (filter !== undefined) _activeFilter = filter;
    if (search !== undefined) _activeSearch = search;
    const grid = $('#jobsGrid');
    if (!grid) return;
    const q = normalizeLower(_activeSearch);
    let list = _activeFilter === 'todas' ? JOBS : JOBS.filter((job) => job.category === _activeFilter);
    if (q) {
      list = list.filter((job) =>
        normalizeLower(job.title).includes(q) ||
        normalizeLower(job.location).includes(q) ||
        normalizeLower(job.summary).includes(q) ||
        normalizeLower(job.category).includes(q)
      );
    }
    if (!list.length) {
      grid.innerHTML = '<div class="jobs-note reveal in-view"><strong>Nenhuma vaga encontrada.</strong><span>Tente outro termo ou selecione uma categoria diferente.</span></div>';
      return;
    }
    grid.innerHTML = list.map(createJobCard).join('');
    $$('.js-open-job', grid).forEach((button) => button.addEventListener('click', () => openJobModal(button.dataset.jobId)));
    $$('.js-share-job', grid).forEach((button) => button.addEventListener('click', () => shareJob(button.dataset.jobShareId, button)));
  }

  function setupJobFilters() {
    $$('.job-filter').forEach((button) => {
      button.addEventListener('click', () => {
        $$('.job-filter').forEach((btn) => btn.classList.remove('is-active'));
        button.classList.add('is-active');
        renderJobs(button.dataset.filter || 'todas');
      });
    });
    const searchInput = $('#jobSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => renderJobs(undefined, searchInput.value));
    }
  }

  function getJobById(id) {
    return JOBS.find((job) => job.id === id);
  }

  function openJobModal(jobId) {
    const modal = $('#jobModal');
    const form = $('#jobForm');
    const title = $('#modalTitle');
    const subtitle = $('#modalSubtitle');
    const job = getJobById(jobId);
    if (!modal || !form || !job) return;
    form.reset();
    form.elements.jobId.value = job.id;
    title.textContent = `Tenho interesse: ${job.title}`;
    subtitle.textContent = `${job.location} • ${job.pay}. Informe apenas seu nome e disponibilidade; os dados da vaga já vão na mensagem.`;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => form.elements.nome?.focus(), 50);
  }

  function closeJobModal() {
    const modal = $('#jobModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function buildJobMessage(job, data) {
    const resp = job.responsible || {};
    const saudacao = resp.name ? `Olá, ${resp.name}.` : 'Olá.';
    const linkVaga = getJobShareUrl(job);
    return [
      `${saudacao} Vim pelo site da RH IMOB e tenho interesse nesta vaga.`,
      '',
      `Vaga: ${job.title}`,
      `Local: ${job.location}`,
      `Modalidade/Condição: ${job.contract}`,
      `Remuneração: ${job.pay}`,
      job.schedule ? `Horário/rotina: ${job.schedule}` : '',
      `Responsável: ${job.responsible?.name || 'Não informado'}${job.responsible?.company ? ' • ' + job.responsible.company : ''}`,
      `Link da vaga: ${linkVaga}`,
      '',
      'Meus dados:',
      `Nome: ${data.nome}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade: ${data.cidade}`,
      `Disponibilidade para início: ${data.inicio}`,
      '',
      'Pode me orientar sobre os próximos passos?'
    ].filter(Boolean).join('\n');
  }

  async function salvarCandidatura(job, data) {
    const cfg = getNtSupabaseConfig();
    if (!cfg) return;
    try {
      const base = cfg.url.replace(/\/$/, '');
      const url = `${base}/rest/v1/site_candidaturas`;
      await fetch(url, {
        method: 'POST',
        headers: supabaseHeaders(cfg, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({
          vaga_id: job.id,
          vaga_titulo: job.title,
          vaga_local: job.location,
          nome: data.nome,
          whatsapp: data.whatsapp,
          cidade: data.cidade,
          disponibilidade: data.inicio,
          responsavel_whatsapp: job.responsible?.whatsapp || null,
          responsavel_nome: job.responsible?.name || null,
        })
      });
    } catch (e) {
      console.warn('[RH IMOB] candidatura não gravada:', e);
    }
  }

  function setupJobModal() {
    const modal = $('#jobModal');
    const form = $('#jobForm');
    if (!modal || !form) return;
    formatPhoneField(form.elements.whatsapp);
    $$('[data-close-modal]').forEach((el) => el.addEventListener('click', closeJobModal));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeJobModal();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const job = getJobById(form.elements.jobId.value);
      if (!job) return;
      const data = {
        nome: normalize(form.elements.nome?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        cidade: normalize(form.elements.cidade?.value),
        inicio: normalize(form.elements.inicio?.value)
      };
      const required = ['nome', 'whatsapp', 'cidade', 'inicio'];
      const missing = required.filter((field) => !data[field]);
      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Preencha os campos obrigatórios para enviar seu interesse.');
        return;
      }
      salvarCandidatura(job, data);
      const targetWhatsApp = job.responsible?.whatsapp || VAGAS_WHATSAPP;
      openWhatsApp(targetWhatsApp, buildJobMessage(job, data));
    });
  }

  function openTalentModal() {
    const modal = $('#talentModal');
    const form = $('#talentForm');
    if (!modal || !form) return;
    form.reset();
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => form.elements.nome?.focus(), 50);
  }

  function closeTalentModal() {
    const modal = $('#talentModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function buildTalentMessage(data) {
    return [
      'Olá, Mariana. Vim pelo site da RH IMOB e quero entrar no Banco Confidencial de Talentos Imobiliários.',
      '',
      'Meu perfil:',
      `Nome: ${data.nome}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade/região onde atuo: ${data.regiao}`,
      `CRECI: ${data.creci || 'Não informado'}`,
      `Função atual: ${data.funcao}`,
      `Tempo de experiência: ${data.experiencia}`,
      `Empresa atual/último vínculo: ${data.empresaAtual || 'Prefiro informar em conversa'}`,
      `O que me faria avaliar proposta: ${data.interesse}`,
      `Observações: ${data.observacoes || 'Não informado'}`,
      '',
      'Tenho interesse em receber propostas de imobiliárias/incorporadoras parceiras, com contato discreto e confidencial.'
    ].join('\n');
  }

  function setupTalentModal() {
    const openButton = $('#openTalentModal');
    const form = $('#talentForm');
    const modal = $('#talentModal');
    if (!modal || !form) return;
    formatPhoneField(form.elements.whatsapp);
    if (openButton) openButton.addEventListener('click', openTalentModal);
    $$('[data-close-talent-modal]').forEach((el) => el.addEventListener('click', closeTalentModal));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeTalentModal();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = {
        nome: normalize(form.elements.nome?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        regiao: normalize(form.elements.regiao?.value),
        creci: normalize(form.elements.creci?.value),
        funcao: normalize(form.elements.funcao?.value),
        experiencia: normalize(form.elements.experiencia?.value),
        empresaAtual: normalize(form.elements.empresaAtual?.value),
        interesse: normalize(form.elements.interesse?.value),
        observacoes: normalize(form.elements.observacoes?.value)
      };
      const required = ['nome', 'whatsapp', 'regiao', 'funcao', 'experiencia', 'interesse'];
      const missing = required.filter((field) => !data[field]);
      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Preencha os campos obrigatórios para enviar seu perfil.');
        return;
      }
      openWhatsApp(VAGAS_WHATSAPP, buildTalentMessage(data));
    });
  }


  function setupPerfilModal() {
    const modal = $('#perfilModal');
    const form = $('#perfilForm');
    if (!modal || !form) return;

    formatPhoneField(form.elements.whatsapp);

    $$('.js-open-perfil').forEach((card) => {
      card.addEventListener('click', () => {
        const perfil = card.dataset.perfil || '';
        const kicker = card.dataset.kicker || 'Cadastro de perfil';
        form.reset();
        form.elements.perfil.value = perfil;
        $('#perfilModalKicker').textContent = kicker;
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        setTimeout(() => form.elements.nome?.focus(), 50);
      });
    });

    $$('[data-close-perfil-modal]').forEach((el) =>
      el.addEventListener('click', () => {
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
      })
    );

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        perfil: form.elements.perfil.value,
        nome: normalize(form.elements.nome?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        regiao: normalize(form.elements.regiao?.value),
        mensagem: normalize(form.elements.mensagem?.value),
      };
      const required = ['nome', 'whatsapp', 'regiao'];
      const missing = required.filter((f) => !data[f]);
      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Preencha os campos obrigatórios para enviar seu perfil.');
        return;
      }

      try {
        await salvarCandidatura(
          { id: 'perfil', titulo: data.perfil, local: data.regiao, responsavel_whatsapp: VAGAS_WHATSAPP, responsavel_nome: 'Mariana' },
          { nome: data.nome, whatsapp: data.whatsapp, cidade: data.regiao, disponibilidade: data.mensagem || '' }
        );
      } catch (_) {}

      const msg = [
        `Olá, Mariana! Vim pelo site da RH IMOB e quero me candidatar.`,
        ``,
        `Perfil: ${data.perfil}`,
        `Nome: ${data.nome}`,
        `WhatsApp: ${data.whatsapp}`,
        `Região: ${data.regiao}`,
        data.mensagem ? `Sobre mim: ${data.mensagem}` : null,
      ].filter(Boolean).join('\n');

      openWhatsApp(VAGAS_WHATSAPP, msg);
    });
  }

  function openAdvertiseModal() {
    const modal = $('#advertiseModal');
    const form = $('#advertiseForm');
    if (!modal || !form) return;
    form.reset();
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => form.elements.nome?.focus(), 50);
  }

  function closeAdvertiseModal() {
    const modal = $('#advertiseModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function buildAdvertiseMessage(data) {
    return [
      'Olá, Mariana. Vim pelo site da RH IMOB e quero anunciar uma vaga.',
      '',
      '— DADOS DO RESPONSÁVEL —',
      `Nome: ${data.nome}`,
      `Empresa: ${data.empresa}`,
      `WhatsApp: ${data.whatsapp}`,
      `E-mail: ${data.email || 'Não informado'}`,
      '',
      '— DADOS DA VAGA —',
      `Cargo/Título: ${data.cargoVaga}`,
      `Cidade/região: ${data.cidade}`,
      `Quantidade: ${data.quantidade}`,
      `Formato de contratação: ${data.formatoContratacao || 'Não informado'}`,
      `Urgência: ${data.urgencia}`,
      '',
      '— PERFIL DESEJADO —',
      data.perfilDesejado || 'Não informado',
      '',
      '— INFORMAÇÕES DA VAGA —',
      data.detalhes || 'Não informado',
      '',
      'Aguardo retorno para alinhar os próximos passos.'
    ].join('\n');
  }

  function setupAdvertiseModal() {
    const openButton = $('#openAdvertiseModal');
    const form = $('#advertiseForm');
    const modal = $('#advertiseModal');
    if (!modal || !form) return;
    formatPhoneField(form.elements.whatsapp);
    if (openButton) openButton.addEventListener('click', openAdvertiseModal);
    $$('[data-close-advertise-modal]').forEach((el) => el.addEventListener('click', closeAdvertiseModal));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeAdvertiseModal();
    });
    // captura progressiva: grava no site_leads (painel) ao sair dos campos-chave,
    // mesmo que a pessoa nunca chegue a apertar "enviar" no WhatsApp depois.
    ['nome', 'whatsapp', 'empresa', 'cargoVaga'].forEach((n) => {
      const el = form.elements[n];
      if (el) el.addEventListener('blur', () => saveLeadEmpresa(form, false));
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = {
        nome: normalize(form.elements.nome?.value),
        empresa: normalize(form.elements.empresa?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        email: normalize(form.elements.email?.value),
        cidade: normalize(form.elements.cidade?.value),
        cargoVaga: normalize(form.elements.cargoVaga?.value),
        quantidade: normalize(form.elements.quantidade?.value),
        formatoContratacao: normalize(form.elements.formatoContratacao?.value),
        urgencia: normalize(form.elements.urgencia?.value),
        perfilDesejado: normalize(form.elements.perfilDesejado?.value),
        detalhes: normalize(form.elements.detalhes?.value)
      };
      const missingEl = Array.from(form.querySelectorAll('[required]'))
        .find((el) => el.offsetParent !== null && !normalize(el.value));
      if (missingEl) {
        missingEl.focus();
        missingEl.reportValidity?.();
        return;
      }
      // grava no painel ANTES de abrir o WhatsApp — o lead fica registrado mesmo
      // se a pessoa fechar a aba sem confirmar o envio da mensagem.
      saveLeadEmpresa(form, true);
      openWhatsApp(EMPRESA_WHATSAPP, buildAdvertiseMessage(data));
    });
  }

  function setupFooterYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  // ── TEIA DE LINKS INTERNOS ────────────────────────────────────
  // Liga a PRIMEIRA ocorrência de termos curados ao artigo/página correspondente,
  // só dentro do texto de conteúdo (nunca menu, título, botão ou link existente).
  // Cria continuidade de navegação e conduz o visitante rumo à conversão.
  // Ordem: frases mais específicas primeiro (evita casar o termo curto antes).
  const INTERNAL_LINKS = [
    { re: /contrato de parceria|contrato de corretor aut[oô]nomo/i, url: '/contrato-corretor-autonomo.html' },
    { re: /aut[oô]nomo ou clt|aut[oô]nomo vs\.? clt/i, url: '/blog/corretor-autonomo-vs-clt.html' },
    { re: /quanto custa (um )?recrutamento|custo de recrutamento/i, url: '/blog/quanto-custa-recrutamento-imobiliario.html' },
    { re: /como contratar (um )?corretor/i, url: '/blog/como-contratar-corretor-imoveis.html' },
    { re: /montar (uma )?equipe( de corretores)?|equipe de corretores/i, url: '/blog/como-montar-equipe-corretores.html' },
    { re: /lan[çc]amento imobili[aá]rio/i, url: '/blog/equipe-lancamento-imobiliario.html' },
    { re: /sal[aá]rio (de|do) corretor|comiss[aã]o (de|do) corretor|quanto ganha um corretor/i, url: '/salario-corretor-imoveis.html' },
    { re: /alto ticket/i, url: '/vendedor-alto-ticket.html' },
    { re: /banco de talentos|novos talentos/i, url: '/novos-talentos' },
    { re: /vagas de corretor/i, url: '/vagas.html' },
    { re: /recrutamento imobili[aá]rio/i, url: '/contratar.html' },
    { re: /incorporadoras (de |em )?s[ãa]o paulo|construtoras (de |em )?s[ãa]o paulo/i, url: '/incorporadoras' },
    { re: /\bCRECI\b/, url: '/blog/creci-o-que-e-como-verificar.html' }
  ];
  const LINK_MAX = 5; // teto por página — discreto e profissional

  function setupInternalLinks() {
    const here = location.pathname.replace(/\/index\.html$/, '/').replace(/(.)\/$/, '$1');
    // Prioriza o container de PROSA (evita hero/assinatura); só cai em section
    // se a página não tiver um container de artigo dedicado.
    const main = $('.article-body') || $('.post-body') || $('article') || $('main') || $('.content');
    const roots = main ? [main] : $$('section');
    if (!roots.length) return;
    const BLOCK = new Set(['A', 'BUTTON', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'NAV', 'HEADER', 'FOOTER', 'FORM', 'SELECT', 'LABEL', 'CODE', 'SCRIPT', 'STYLE']);
    const used = new Set();      // urls já linkadas (1 por destino)
    let count = 0;
    const pending = INTERNAL_LINKS.filter((l) => l.url.replace(/\/$/, '') !== here.replace(/\/$/, ''));

    for (const root of roots) {
      if (count >= LINK_MAX) break;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim() || node.nodeValue.length < 6) return NodeFilter.FILTER_REJECT;
          for (let p = node.parentNode; p && p !== root.parentNode; p = p.parentNode) {
            if (p.nodeType === 1 && (BLOCK.has(p.tagName) || p.classList?.contains('no-link') || p.dataset?.leadWired)) return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      let n; while ((n = walker.nextNode())) nodes.push(n);
      for (const node of nodes) {
        if (count >= LINK_MAX) break;
        for (const link of pending) {
          if (used.has(link.url)) continue;
          const m = link.re.exec(node.nodeValue);
          if (!m) continue;
          const a = document.createElement('a');
          a.href = link.url;
          a.className = 'rh-inline-link';
          a.textContent = m[0];
          const after = node.splitText(m.index);
          after.nodeValue = after.nodeValue.slice(m[0].length);
          node.parentNode.insertBefore(a, after);
          used.add(link.url);
          count++;
          break; // um link por nó de texto
        }
      }
    }
    if (count && !$('#rh-inline-link-style')) {
      const s = document.createElement('style');
      s.id = 'rh-inline-link-style';
      s.textContent = '.rh-inline-link{color:#7c3aed;text-decoration:underline;text-decoration-color:rgba(124,58,237,.35);text-underline-offset:2px;font-weight:600}.rh-inline-link:hover{text-decoration-color:#7c3aed}';
      document.head.appendChild(s);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupMenu();
    setupReveal();
    ensureLeadModal();
    setupWhatsAppLinks();
    setupSupportModal();
    setupCompanyForm();
    setupLeadEngine();
    setupInternalLinks();
    setupJobFilters();
    setupJobModal();
    setupTalentModal();
    setupPerfilModal();
    setupAdvertiseModal();
    setupFooterYear();
    hydratePublicMetrics();
    initJobs();
  });
})();
