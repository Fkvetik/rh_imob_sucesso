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
    window.open(`https://wa.me/${number}?text=${text}`, '_blank', 'noopener,noreferrer');
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

  function openCompanyLeadModal(trigger) {
    const modal = $('#companyLeadModal');
    const form = $('#companyLeadForm');
    const origin = getTriggerOrigin(trigger);
    if (!modal || !form) {
      const pageForm = $('#leadForm');
      if (pageForm) {
        if (pageForm.elements.origem) pageForm.elements.origem.value = origin;
        pageForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => pageForm.elements.nome?.focus(), 200);
      }
      return;
    }
    form.reset();
    if (form.elements.origem) form.elements.origem.value = origin;
    closeSupportModal();
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => form.elements.nome?.focus(), 50);
  }

  function closeCompanyLeadModal() {
    const modal = $('#companyLeadModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
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
    return [
      'Olá, Mariana. Vim pelo site da RH IMOB e quero enviar uma demanda de contratação para análise.',
      '',
      '— DADOS DO RESPONSÁVEL —',
      `Nome: ${data.nome}`,
      `Empresa: ${data.empresa}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade/Estado: ${data.cidade}`,
      '',
      '— DADOS DA VAGA —',
      `Cargo/função: ${data.cargoVaga || 'Não informado'}`,
      `Tipo de demanda: ${data.demanda}`,
      `Quantidade: ${data.quantidade || 'Não informado'}`,
      `Formato de contratação: ${data.formatoContratacao || 'Não informado'}`,
      `Urgência/prazo: ${data.urgencia || 'Não informado'}`,
      '',
      '— REMUNERAÇÃO E BENEFÍCIOS —',
      `Remuneração: ${data.remuneracao || 'Não informado'}`,
      `Benefícios: ${data.beneficios || 'Não informado'}`,
      '',
      '— EXIGÊNCIAS —',
      `Exigências da vaga: ${data.exigencias || 'Não informado'}`,
      `Observações: ${data.mensagem || 'Não informado'}`,
      '',
      'Aguardo retorno com orientação sobre o formato de apoio, prazo estimado e investimento.'
    ].join('\n');
  }

  function setupCompanyForm() {
    const forms = $$('.js-company-lead-form, #leadForm, #companyLeadForm');
    forms.forEach((form) => {
      if (!form || form.dataset.companyFormReady === 'true') return;
      form.dataset.companyFormReady = 'true';
      formatPhoneField(form.elements.whatsapp);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = {
          nome: normalize(form.elements.nome?.value),
          empresa: normalize(form.elements.empresa?.value),
          whatsapp: normalize(form.elements.whatsapp?.value),
          cidade: normalize(form.elements.cidade?.value),
          cargoVaga: normalize(form.elements.cargoVaga?.value),
          demanda: normalize(form.elements.demanda?.value),
          quantidade: normalize(form.elements.quantidade?.value),
          formatoContratacao: normalize(form.elements.formatoContratacao?.value),
          urgencia: normalize(form.elements.urgencia?.value),
          remuneracao: normalize(form.elements.remuneracao?.value),
          beneficios: normalize(form.elements.beneficios?.value),
          exigencias: normalize(form.elements.exigencias?.value),
          origem: normalize(form.elements.origem?.value),
          mensagem: normalize(form.elements.mensagem?.value)
        };
        const required = ['nome', 'empresa', 'whatsapp', 'cidade', 'demanda', 'quantidade', 'urgencia'];
        const missing = required.filter((field) => !data[field]);
        if (missing.length) {
          form.elements[missing[0]]?.focus();
          alert('Por favor, preencha os campos obrigatórios antes de abrir o WhatsApp.');
          return;
        }
        openWhatsApp(EMPRESA_WHATSAPP, buildCompanyLeadMessage(data));
      });
    });

    $$('[data-close-company-lead-modal]').forEach((el) => el.addEventListener('click', closeCompanyLeadModal));
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
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

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
      `Modelo de trabalho: ${data.modeloTrabalho || 'Não informado'}`,
      `Horário: ${data.horario || 'Não informado'}`,
      `Urgência: ${data.urgencia}`,
      '',
      '— REMUNERAÇÃO E BENEFÍCIOS —',
      `Remuneração: ${data.remuneracao || 'Não informado'}`,
      `Benefícios: ${data.beneficios || 'Não informado'}`,
      '',
      '— PERFIL E EXIGÊNCIAS —',
      `Exigências: ${data.exigencias || 'Não informado'}`,
      `Perfil desejado: ${data.perfilDesejado || 'Não informado'}`,
      `Descrição da função: ${data.descricaoFuncao || 'Não informado'}`,
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
        modeloTrabalho: normalize(form.elements.modeloTrabalho?.value),
        horario: normalize(form.elements.horario?.value),
        urgencia: normalize(form.elements.urgencia?.value),
        remuneracao: normalize(form.elements.remuneracao?.value),
        beneficios: normalize(form.elements.beneficios?.value),
        exigencias: normalize(form.elements.exigencias?.value),
        perfilDesejado: normalize(form.elements.perfilDesejado?.value),
        descricaoFuncao: normalize(form.elements.descricaoFuncao?.value)
      };
      const required = ['nome', 'empresa', 'whatsapp', 'cidade', 'cargoVaga', 'quantidade', 'urgencia'];
      const missing = required.filter((field) => !data[field]);
      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Preencha os campos obrigatórios para enviar a solicitação de anúncio.');
        return;
      }
      openWhatsApp(EMPRESA_WHATSAPP, buildAdvertiseMessage(data));
    });
  }

  function setupFooterYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupMenu();
    setupReveal();
    setupWhatsAppLinks();
    setupSupportModal();
    setupCompanyForm();
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
