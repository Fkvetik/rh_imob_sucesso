(() => {
  const EMPRESA_WHATSAPP = '5511997213584';
  const VAGAS_WHATSAPP = '5511953973268'; // fallback técnico: usado só quando a vaga não tiver responsavel_whatsapp
  const DEFAULT_EMPRESA_MESSAGE = 'Olá, vim pelo site da RH IMOB e gostaria de entender melhor como vocês podem apoiar minha empresa no recrutamento imobiliário.';
  const DEFAULT_VAGA_MESSAGE = 'Olá. Vim pelo site da RH IMOB e quero saber mais sobre as vagas.';
  const SITE_VAGAS_TABLE = 'site_vagas_publicas';
  const SITE_BASE_URL = 'https://www.rhimob.com.br';


  let JOBS = [];
  let SHARE_JOB_STATE = null;

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
      badge: normalize(row.selo || row.categoria || 'Vaga ativa'),
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
      'Olá, vim pelo site da RH IMOB e quero enviar uma demanda de contratação para análise.',
      '',
      'Meus dados:',
      `Nome: ${data.nome}`,
      `Empresa: ${data.empresa}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade/Estado: ${data.cidade}`,
      `Tipo de demanda: ${data.demanda}`,
      `Quantidade aproximada: ${data.quantidade || 'Não informado'}`,
      `Urgência/prazo: ${data.urgencia || 'Não informado'}`,
      `Origem do clique: ${data.origem || 'Site RH IMOB'}`,
      `Mensagem: ${data.mensagem || 'Não informado'}`,
      '',
      'Gostaria de entender como a RH IMOB pode apoiar nossa empresa no recrutamento imobiliário e receber uma orientação sobre formato de operação, prazo estimado e investimento.'
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
          demanda: normalize(form.elements.demanda?.value),
          quantidade: normalize(form.elements.quantidade?.value),
          urgencia: normalize(form.elements.urgencia?.value),
          origem: normalize(form.elements.origem?.value),
          mensagem: normalize(form.elements.mensagem?.value)
        };
        const required = ['nome', 'empresa', 'whatsapp', 'cidade', 'demanda'];
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
    const url = new URL(`/vaga/${encodeURIComponent(key)}`, window.location.origin || SITE_BASE_URL);
    return url.toString();
  }

  function buildJobShareText(job) {
    return [
      `Vaga RH IMOB: ${job.title}`,
      job.location ? `Local: ${job.location}` : '',
      job.pay ? `Condição: ${job.pay}` : '',
      job.summary ? `Resumo: ${job.summary}` : '',
      '',
      'Link específico da vaga:'
    ].filter(Boolean).join('\n');
  }

  function wrapSvgText(value, maxChars = 28, maxLines = 3) {
    const words = normalize(value).split(' ').filter(Boolean);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxChars || !current) current = next;
      else {
        lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    if (lines.length > maxLines) {
      const sliced = lines.slice(0, maxLines);
      sliced[maxLines - 1] = `${sliced[maxLines - 1].replace(/[.,;:!?\s-]+$/g, '')}…`;
      return sliced;
    }
    return lines;
  }

  function renderSvgTextLines(lines, x, y, lineHeight, className, fill = '#ffffff') {
    if (!lines.length) return '';
    const tspans = lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeHTML(line)}</tspan>`).join('');
    return `<text x="${x}" y="${y}" class="${className}" fill="${fill}">${tspans}</text>`;
  }

  function createJobArtSvg(job) {
    const titleLines = wrapSvgText(job.title, 24, 3);
    const summaryLines = wrapSvgText(job.summary, 42, 4);
    const detailLines = [job.location, job.contract, job.pay, job.schedule || `Responsável: ${job.responsible?.name || 'RH IMOB'}`]
      .filter(Boolean)
      .map((value) => wrapSvgText(value, 34, 1)[0])
      .slice(0, 4);
    const highlights = (job.highlights || []).slice(0, 4).map((item) => wrapSvgText(item, 38, 1)[0]);
    const directUrl = `rhimob.com.br/vaga/${job.id}`;
    const detailBlocks = detailLines.map((line, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const boxX = 88 + (col * 452);
      const boxY = 468 + (row * 82);
      return `\n        <rect x="${boxX}" y="${boxY}" rx="24" ry="24" width="392" height="60" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)" />\n        <text x="${boxX + 24}" y="${boxY + 37}" class="metaLabel" fill="#fff">${escapeHTML(line)}</text>`;
    }).join('');
    const highlightItems = highlights.map((line, index) => `\n      <circle cx="110" cy="${782 + (index * 56)}" r="7" fill="#ffb66a" />\n      <text x="132" y="${790 + (index * 56)}" class="bulletText" fill="#221339">${escapeHTML(line)}</text>`).join('');

    return `\n<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="Arte da vaga ${escapeHTML(job.title)}">\n  <defs>\n    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">\n      <stop offset="0%" stop-color="#2b124d"/>\n      <stop offset="58%" stop-color="#5f26c9"/>\n      <stop offset="100%" stop-color="#ff8f3d"/>\n    </linearGradient>\n    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">\n      <stop offset="0%" stop-color="#ffffff"/>\n      <stop offset="100%" stop-color="#f7f1ff"/>\n    </linearGradient>\n    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">\n      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#2b124d" flood-opacity="0.18" />\n    </filter>\n    <style>\n      .logoSmall { font: 700 26px Arial, sans-serif; letter-spacing: .18em; }\n      .titleText { font: 800 72px Arial, sans-serif; letter-spacing: -0.04em; }\n      .metaLabel { font: 700 24px Arial, sans-serif; }\n      .sectionKicker { font: 700 28px Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; }\n      .bodyText { font: 500 28px Arial, sans-serif; }\n      .bulletText { font: 600 30px Arial, sans-serif; }\n      .footerText { font: 700 26px Arial, sans-serif; }\n      .footerTiny { font: 500 22px Arial, sans-serif; }\n    </style>\n  </defs>\n  <rect width="1080" height="1350" fill="#f4eefc"/>\n  <rect x="40" y="40" width="1000" height="1270" rx="42" fill="url(#bg)"/>\n  <circle cx="900" cy="180" r="150" fill="rgba(255,255,255,0.08)"/>\n  <circle cx="180" cy="1180" r="210" fill="rgba(255,255,255,0.06)"/>\n  <text x="88" y="110" class="logoSmall" fill="#fff">RH IMOB</text>\n  <text x="88" y="148" class="footerTiny" fill="rgba(255,255,255,0.88)">Recrutamento imobiliário</text>\n  <rect x="88" y="190" rx="20" ry="20" width="280" height="54" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)" />\n  <text x="112" y="225" class="sectionKicker" fill="#fff">Vaga em destaque</text>\n  ${renderSvgTextLines(titleLines, 88, 318, 78, 'titleText')}\n  ${detailBlocks}\n  <g filter="url(#shadow)">\n    <rect x="72" y="690" width="936" height="500" rx="34" fill="url(#panel)"/>\n  </g>\n  <text x="110" y="746" class="sectionKicker" fill="#5f26c9">Resumo da oportunidade</text>\n  ${renderSvgTextLines(summaryLines, 110, 812, 42, 'bodyText', '#31213d')}\n  ${highlightItems}\n  <rect x="110" y="1080" rx="22" ry="22" width="860" height="86" fill="#efe4ff" />\n  <text x="138" y="1127" class="footerText" fill="#2b124d">Saiba mais no site: ${escapeHTML(directUrl)}</text>\n  <text x="110" y="1232" class="footerText" fill="#fff">Compartilhe esta vaga com quem faz sentido.</text>\n  <text x="110" y="1268" class="footerTiny" fill="rgba(255,255,255,0.88)">Clique em compartilhar ou baixe a arte para enviar no WhatsApp.</text>\n</svg>`;
  }

  function svgToDataUri(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  async function svgToPngBlob(svg, width = 1080, height = 1350) {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#f4eefc';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((pngBlob) => {
          if (pngBlob) resolve(pngBlob);
          else reject(new Error('Não foi possível gerar a arte da vaga.'));
        }, 'image/png', 0.96);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function setShareModalLoading(isLoading, helperText = '') {
    const nativeButton = $('#shareJobNativeButton');
    const downloadButton = $('#downloadJobArtButton');
    const copyButton = $('#copyJobLinkButton');
    const metaText = $('#shareJobMetaText');
    if (nativeButton) nativeButton.disabled = isLoading;
    if (downloadButton) downloadButton.disabled = isLoading;
    if (copyButton) copyButton.disabled = isLoading;
    if (metaText && helperText) metaText.textContent = helperText;
  }

  async function buildShareJobState(job) {
    const svg = createJobArtSvg(job);
    const previewSrc = svgToDataUri(svg);
    const pngBlob = await svgToPngBlob(svg);
    const fileName = `vaga-rhimob-${getJobShareKey(job)}.png`;
    const file = new File([pngBlob], fileName, { type: 'image/png' });
    return {
      job,
      svg,
      previewSrc,
      pngBlob,
      file,
      fileName,
      url: getJobShareUrl(job)
    };
  }

  async function openShareJobModal(jobId) {
    const modal = $('#shareJobModal');
    const preview = $('#shareJobPreview');
    const metaTitle = $('#shareJobMetaTitle');
    const metaText = $('#shareJobMetaText');
    const job = getJobById(jobId);
    if (!modal || !preview || !metaTitle || !metaText || !job) return;
    metaTitle.textContent = `Arte da vaga: ${job.title}`;
    metaText.textContent = 'Gerando a arte gráfica da vaga...';
    preview.removeAttribute('src');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setShareModalLoading(true, 'Gerando a arte gráfica da vaga...');
    try {
      SHARE_JOB_STATE = await buildShareJobState(job);
      preview.src = SHARE_JOB_STATE.previewSrc;
      metaText.textContent = `Arte pronta: ${job.location} • ${job.pay}`;
      setShareModalLoading(false);
    } catch (error) {
      console.error('RH IMOB: falha ao gerar arte da vaga.', error);
      metaText.textContent = 'Não foi possível gerar a arte agora. Você ainda pode copiar o link da vaga.';
      SHARE_JOB_STATE = { job, url: getJobShareUrl(job) };
      setShareModalLoading(false);
    }
  }

  function closeShareJobModal() {
    const modal = $('#shareJobModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function triggerFileDownload(blob, fileName) {
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
  }

  async function copyCurrentJobLink() {
    const url = SHARE_JOB_STATE?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      const metaText = $('#shareJobMetaText');
      if (metaText) metaText.textContent = 'Link da vaga copiado. Você pode colar em qualquer conversa.';
    } catch (error) {
      window.prompt('Copie o link específico da vaga:', url);
    }
  }

  async function shareCurrentJobArt() {
    const state = SHARE_JOB_STATE;
    if (!state || !state.job) return;
    const title = `Vaga RH IMOB: ${state.job.title}`;
    const text = `${buildJobShareText(state.job)}\n${state.url}`;
    try {
      if (state.file && navigator.canShare && navigator.canShare({ files: [state.file] }) && navigator.share) {
        await navigator.share({ title, text, files: [state.file] });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title, text, url: state.url });
        return;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
    if (state.pngBlob) triggerFileDownload(state.pngBlob, state.fileName || `vaga-rhimob-${getJobShareKey(state.job)}.png`);
    await copyCurrentJobLink();
  }

  function downloadCurrentJobArt() {
    const state = SHARE_JOB_STATE;
    if (!state || !state.pngBlob) return;
    triggerFileDownload(state.pngBlob, state.fileName || `vaga-rhimob-${getJobShareKey(state.job)}.png`);
  }

  function setupShareJobModal() {
    const modal = $('#shareJobModal');
    if (!modal) return;
    $$('[data-close-share-modal]').forEach((el) => el.addEventListener('click', closeShareJobModal));
    $('#shareJobNativeButton')?.addEventListener('click', shareCurrentJobArt);
    $('#downloadJobArtButton')?.addEventListener('click', downloadCurrentJobArt);
    $('#copyJobLinkButton')?.addEventListener('click', copyCurrentJobLink);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeShareJobModal();
    });
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
            <button class="btn btn-secondary btn-full js-share-job" type="button" data-job-share-id="${escapeHTML(job.id)}">Compartilhar arte da vaga</button>
          </div>
          <div class="job-actions-hint">Interesse abre o WhatsApp do responsável. Compartilhar gera uma arte visual e mantém o link individual da vaga.</div>
        </div>
      </article>`;
  }

  function renderJobs(filter = 'todas') {
    const grid = $('#jobsGrid');
    if (!grid) return;
    const list = filter === 'todas' ? JOBS : JOBS.filter((job) => job.category === filter);
    if (!list.length) {
      grid.innerHTML = '<div class="jobs-note reveal in-view"><strong>Nenhuma vaga ativa no momento.</strong><span>As vagas exibidas aqui são alimentadas pela planilha VAGAS_SITE da RH IMOB.</span></div>';
      return;
    }
    grid.innerHTML = list.map(createJobCard).join('');
    $$('.js-open-job', grid).forEach((button) => button.addEventListener('click', () => openJobModal(button.dataset.jobId)));
    $$('.js-share-job', grid).forEach((button) => button.addEventListener('click', () => openShareJobModal(button.dataset.jobShareId)));
  }

  function setupJobFilters() {
    $$('.job-filter').forEach((button) => {
      button.addEventListener('click', () => {
        $$('.job-filter').forEach((btn) => btn.classList.remove('is-active'));
        button.classList.add('is-active');
        renderJobs(button.dataset.filter || 'todas');
      });
    });
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
      `Disponibilidade para início: ${data.inicio}`,
      '',
      'Pode me orientar sobre os próximos passos?'
    ].filter(Boolean).join('\n');
  }

  function setupJobModal() {
    const modal = $('#jobModal');
    const form = $('#jobForm');
    if (!modal || !form) return;
    $$('[data-close-modal]').forEach((el) => el.addEventListener('click', closeJobModal));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeJobModal();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const job = getJobById(form.elements.jobId.value);
      if (!job) return;
      const data = {
        nome: normalize(form.elements.nome?.value),
        inicio: normalize(form.elements.inicio?.value)
      };
      const required = ['nome', 'inicio'];
      const missing = required.filter((field) => !data[field]);
      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Preencha os campos obrigatórios para enviar seu interesse.');
        return;
      }
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
      'Olá, Fernando. Vim pelo site da RH IMOB e quero anunciar uma vaga.',
      '',
      'Dados para divulgação:',
      `Responsável: ${data.nome}`,
      `Empresa: ${data.empresa}`,
      `WhatsApp: ${data.whatsapp}`,
      `E-mail: ${data.email || 'Não informado'}`,
      `Cidade/região da vaga: ${data.cidade}`,
      `Título da vaga: ${data.cargoVaga}`,
      `Quantidade: ${data.quantidade}`,
      `Formato de contratação: ${data.formatoContratacao || 'Não informado'}`,
      `Urgência: ${data.urgencia}`,
      '',
      `Perfil desejado: ${data.perfilDesejado || 'Não informado'}`,
      `Informações da vaga: ${data.detalhes || 'Não informado'}`,
      '',
      'Gostaria de entender como anunciar essa vaga na RH IMOB e receber candidatos pelo WhatsApp.'
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
        urgencia: normalize(form.elements.urgencia?.value),
        perfilDesejado: normalize(form.elements.perfilDesejado?.value),
        detalhes: normalize(form.elements.detalhes?.value)
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
    setupShareJobModal();
    setupTalentModal();
    setupAdvertiseModal();
    setupFooterYear();
    hydratePublicMetrics();
    initJobs();
  });
})();
