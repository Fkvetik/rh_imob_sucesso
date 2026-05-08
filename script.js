(() => {
  const EMPRESA_WHATSAPP = '5511997213584';
  const VAGAS_WHATSAPP = '5511953973268';
  const DEFAULT_EMPRESA_MESSAGE = 'Olá, vim pelo site da RH IMOB e gostaria de entender melhor como vocês podem apoiar minha empresa no recrutamento imobiliário.';
  const DEFAULT_VAGA_MESSAGE = 'Olá, Mariana. Vim pelo site da RH IMOB e quero saber mais sobre as vagas.';

  const FALLBACK_JOBS = [];


  let JOBS = FALLBACK_JOBS.slice();
  const SITE_VAGAS_TABLE = 'site_vagas_publicas';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const escapeHTML = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  function openWhatsApp(number, message) {
    const text = encodeURIComponent(message || '');
    window.open(`https://wa.me/${number}?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function formatPhoneField(input) {
    if (!input) return;
    input.addEventListener('input', () => {
      let value = input.value.replace(/\D/g, '').slice(0, 11);
      if (value.length > 10) {
        value = value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
      } else if (value.length > 6) {
        value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
      } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
      }
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
    const url = `${cfg.url.replace(/\/$/, '')}/rest/v1/${table}?select=*&limit=1${query ? `&${query}` : ''}`;
    const response = await fetch(url, {
      headers: supabaseHeaders(cfg, { Prefer: 'count=exact' })
    });
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
        countSupabaseRows(ntCfg, 'nt_talentos_publicos'),
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

  function normalizeJobFromSupabase(row) {
    const title = normalize(row.titulo || row.title || row.nome_vaga || 'Vaga RH IMOB');
    const cidadeUf = [row.cidade, row.estado_uf].filter(Boolean).join('/');
    const location = normalize(row.localidade || row.location || cidadeUf || 'Consultar região');
    const id = normalize(row.vaga_id || row.slug || row.id || title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));

    return {
      id,
      title,
      category: normalize(row.categoria || row.category || 'Vagas'),
      location,
      contract: normalize(row.modalidade || row.contract || row.tipo_contrato || 'Consultar condição'),
      pay: normalize(row.remuneracao || row.pay || 'Condição informada pela Mariana'),
      schedule: normalize(row.horario || row.schedule || ''),
      summary: normalize(row.resumo || row.summary || 'Oportunidade cadastrada pela RH IMOB.'),
      highlights: splitJobText(row.destaques || row.highlights).slice(0, 5),
      details: splitJobText(row.detalhes || row.details || row.requisitos || row.atividades).slice(0, 8),
      badge: normalize(row.selo || row.badge || row.categoria || 'Vaga ativa'),
      media: {
        type: mediaType,
        imageUrl,
        videoUrl,
        instagramUrl,
        alt: normalize(row.midia_alt || row.media_alt || title)
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

  async function loadDynamicJobs() {
    const cfg = getNtSupabaseConfig();
    if (!cfg || !$('#jobsGrid')) return false;

    const select = [
      'vaga_id','titulo','categoria','localidade','cidade','estado_uf','modalidade','remuneracao','horario',
      'resumo','destaques','detalhes','requisitos','atividades','selo','prioridade','status','updated_at',
      'imagem_url','video_url','instagram_url','midia_tipo','midia_alt'
    ].join(',');
    const url = `${cfg.url.replace(/\/$/, '')}/rest/v1/${SITE_VAGAS_TABLE}?select=${encodeURIComponent(select)}&status=eq.ATIVA&order=prioridade.asc&order=updated_at.desc`;
    const response = await fetch(url, { headers: supabaseHeaders(cfg) });
    if (!response.ok) throw new Error(`Falha ao carregar vagas: HTTP ${response.status}`);
    const rows = await response.json();
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
        const type = link.dataset.type || 'empresa';
        const number = type === 'vaga' ? VAGAS_WHATSAPP : EMPRESA_WHATSAPP;
        const message = link.dataset.message || (type === 'vaga' ? DEFAULT_VAGA_MESSAGE : DEFAULT_EMPRESA_MESSAGE);
        openWhatsApp(number, message);
      });
    });
  }

  function buildCompanyLeadMessage(data) {
    return [
      'Olá, vim pelo site da RH IMOB e gostaria de receber uma apresentação.',
      '',
      'Meus dados:',
      `Nome: ${data.nome}`,
      `Empresa: ${data.empresa}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade/Estado: ${data.cidade}`,
      `Tipo de demanda: ${data.demanda}`,
      `Mensagem: ${data.mensagem || 'Não informado'}`,
      '',
      'Gostaria de entender como a RH IMOB pode apoiar nossa empresa no recrutamento imobiliário.'
    ].join('\n');
  }

  function setupCompanyForm() {
    const form = $('#leadForm');
    if (!form) return;

    formatPhoneField(form.elements.whatsapp);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = {
        nome: normalize(form.elements.nome?.value),
        empresa: normalize(form.elements.empresa?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        cidade: normalize(form.elements.cidade?.value),
        demanda: normalize(form.elements.demanda?.value),
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
  }

  function renderJobDetails(job) {
    const sections = Array.isArray(job.sections) && job.sections.length
      ? job.sections
      : [{ title: 'Detalhes da vaga', items: job.details || [] }];

    return sections.map((section) => {
      const items = (section.items || []).map((item) => `<li>${escapeHTML(item)}</li>`).join('');
      if (!items) return '';
      return `<div class="job-more-section"><strong>${escapeHTML(section.title)}</strong><ul>${items}</ul></div>`;
    }).join('');
  }

  function renderJobMedia(job) {
    const media = job.media || {};
    const type = String(media.type || '').toLowerCase();
    const alt = escapeHTML(media.alt || job.title || 'Vaga RH IMOB');

    if (type === 'video' && media.videoUrl) {
      return `<figure class="job-media job-media-video"><video controls preload="metadata" src="${escapeHTML(media.videoUrl)}" aria-label="${alt}"></video></figure>`;
    }

    if (type === 'instagram' && media.instagramUrl) {
      return `<a class="job-media job-media-instagram" href="${escapeHTML(media.instagramUrl)}" target="_blank" rel="noopener noreferrer"><span>Ver post da vaga no Instagram</span><strong>@rh_imob</strong></a>`;
    }

    if (media.imageUrl) {
      return `<figure class="job-media job-media-image"><img src="${escapeHTML(media.imageUrl)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></figure>`;
    }

    return '';
  }

  function createJobCard(job) {
    const highlights = (job.highlights || []).slice(0, 4).map((item) => `<li>${escapeHTML(item)}</li>`).join('');
    const details = renderJobDetails(job);
    const schedule = job.schedule ? `<span>🕒 ${escapeHTML(job.schedule)}</span>` : '';
    const media = renderJobMedia(job);
    const featured = job.featured ? ' job-featured' : '';
    const aria = `Detalhes da vaga ${job.title}`;

    return `
      <article class="job-card${featured} reveal in-view" data-category="${escapeHTML(job.category)}">
        ${media}
        <div class="job-card-head">
          <span class="job-badge">${escapeHTML(job.badge)}</span>
          <h3>${escapeHTML(job.title)}</h3>
          <div class="job-location">📍 ${escapeHTML(job.location)}</div>
        </div>
        <div class="job-card-body">
          <p>${escapeHTML(job.summary)}</p>
          <div class="job-meta">
            <span>💼 ${escapeHTML(job.contract)}</span>
            <span>💰 ${escapeHTML(job.pay)}</span>
            ${schedule}
          </div>
          <ul class="job-list">${highlights}</ul>
          ${details ? `<details class="job-more"><summary aria-label="${escapeHTML(aria)}">Ver mais detalhes</summary>${details}</details>` : ''}
          <button class="btn btn-primary btn-full js-open-job" type="button" data-job-id="${escapeHTML(job.id)}">Tenho interesse</button>
        </div>
      </article>
    `;
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

    $$('.js-open-job', grid).forEach((button) => {
      button.addEventListener('click', () => openJobModal(button.dataset.jobId));
    });
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
    subtitle.textContent = `${job.location} • ${job.pay}`;
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
    return [
      `Olá, Mariana. Vim pelo site da RH IMOB e tenho interesse na vaga: ${job.title}.`,
      '',
      `Vaga: ${job.title}`,
      `Local: ${job.location}`,
      `Modalidade/Condição: ${job.contract}`,
      `Remuneração: ${job.pay}`,
      '',
      'Meus dados:',
      `Nome: ${data.nome}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade/Bairro: ${data.cidade}`,
      `Experiência: ${data.experiencia}`,
      `Disponibilidade: ${data.disponibilidade}`,
      `Mensagem: ${data.mensagem || 'Não informado'}`,
      '',
      'Pode me orientar sobre os próximos passos?'
    ].join('\n');
  }

  function setupJobModal() {
    const modal = $('#jobModal');
    const form = $('#jobForm');
    if (!modal || !form) return;

    formatPhoneField(form.elements.whatsapp);

    $$('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeJobModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        closeJobModal();
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const job = getJobById(form.elements.jobId.value);
      if (!job) return;

      const data = {
        nome: normalize(form.elements.nome?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        cidade: normalize(form.elements.cidade?.value),
        experiencia: normalize(form.elements.experiencia?.value),
        disponibilidade: normalize(form.elements.disponibilidade?.value),
        mensagem: normalize(form.elements.mensagem?.value)
      };

      const required = ['nome', 'whatsapp', 'cidade', 'experiencia', 'disponibilidade'];
      const missing = required.filter((field) => !data[field]);
      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Preencha os campos obrigatórios para enviar seu interesse.');
        return;
      }

      openWhatsApp(VAGAS_WHATSAPP, buildJobMessage(job, data));
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

    if (openButton) {
      openButton.addEventListener('click', openTalentModal);
    }

    $$('[data-close-talent-modal]').forEach((el) => {
      el.addEventListener('click', closeTalentModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        closeTalentModal();
      }
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

  function setupFooterYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupMenu();
    setupReveal();
    setupWhatsAppLinks();
    setupCompanyForm();
    setupJobFilters();
    setupJobModal();
    setupTalentModal();
    setupFooterYear();
    hydratePublicMetrics();
    initJobs();
  });
})();
