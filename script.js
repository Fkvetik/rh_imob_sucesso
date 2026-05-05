(() => {
  const EMPRESA_WHATSAPP = '5511978725515';
  const VAGAS_WHATSAPP = '5511953973268';
  const DEFAULT_EMPRESA_MESSAGE = 'Olá, vim pelo site da RH IMOB e gostaria de entender melhor como vocês podem apoiar minha empresa no recrutamento imobiliário.';
  const DEFAULT_VAGA_MESSAGE = 'Olá, Mariana. Vim pelo site da RH IMOB e quero saber mais sobre as vagas.';

  const JOBS = [
  {
    "id": "analista-credito-osasco",
    "title": "Analista de Crédito Imobiliário",
    "category": "Crédito imobiliário",
    "location": "Osasco/SP",
    "contract": "PJ",
    "pay": "R$ 4.000 fixo + premiação por contrato assinado",
    "summary": "Atuação com análise e acompanhamento de contratos de financiamento habitacional.",
    "highlights": [
      "Experiência em crédito imobiliário",
      "Prática com sistemas da Caixa Econômica Federal",
      "Atuação presencial em Osasco"
    ],
    "details": [
      "Perfil organizado, analítico e focado em resultados",
      "Necessário fácil acesso à região de Osasco",
      "Foco em análise e acompanhamento de contratos de financiamento habitacional"
    ],
    "badge": "Vaga especializada"
  },
  {
    "id": "gerente-treinamentos-osasco",
    "title": "Gerente de Treinamentos",
    "category": "Treinamento e liderança",
    "location": "Osasco/SP",
    "contract": "Presencial",
    "pay": "Salário fixo + comissão",
    "summary": "Capacitação técnica de equipes comerciais no setor imobiliário.",
    "highlights": [
      "Mínimo de 5 anos no mercado imobiliário",
      "Expertise em crédito associativo",
      "Treinamentos para lançamentos e performance comercial"
    ],
    "details": [
      "Vivência com treinamentos técnicos voltados para lançamentos",
      "Disponibilidade e acesso facilitado à região de Osasco",
      "Perfil de liderança, didática e desenvolvimento de corretores/equipes"
    ],
    "badge": "Liderança"
  },
  {
    "id": "novos-talentos-direcoes",
    "title": "Novos Talentos – Mercado Imobiliário",
    "category": "Novos talentos",
    "location": "Oeste/SP + Guarulhos",
    "contract": "Formação comercial",
    "pay": "Curso de TTI + ajuda de custo + comissão",
    "summary": "Oportunidade para entrar no mercado imobiliário com processo formativo e acompanhamento.",
    "highlights": [
      "A empresa investe no curso técnico (TTI)",
      "Ajuda de custo mensal",
      "Comissões a partir de R$ 6.000 por venda"
    ],
    "details": [
      "Indicado para quem quer começar sem experiência prévia no mercado imobiliário",
      "Treinamentos e acompanhamento diário",
      "Estrutura comercial e metodologia de trabalho",
      "Regiões de referência: Barueri, Carapicuíba, Osasco, Guarulhos e entorno"
    ],
    "badge": "Entrada no mercado"
  },
  {
    "id": "gerente-vendas-osasco",
    "title": "Gerente de Vendas",
    "category": "Gerência comercial",
    "location": "Osasco/SP",
    "contract": "Início imediato",
    "pay": "Ajuda de custo + comissão",
    "summary": "Operação com estrutura comercial ativa para liderar equipe e acelerar vendas.",
    "highlights": [
      "Estrutura pronta e operação ativa",
      "Rotina de performance com foco em resultado",
      "Autonomia para gestão, metas e indicadores"
    ],
    "details": [
      "Desejável experiência como gerente comercial no mercado imobiliário",
      "Possibilidade de trazer colaboradores/equipe própria",
      "Treinamento e acompanhamento do time comercial"
    ],
    "badge": "Início imediato"
  },
  {
    "id": "gerente-vendas-centro-sp",
    "title": "Gerente de Vendas – Centro",
    "category": "Gerência comercial",
    "location": "Centro de São Paulo/SP",
    "contract": "Com experiência",
    "pay": "Ajuda de custo: R$ 5.000 + comissão",
    "summary": "Busca de líder para estruturar e acelerar time comercial na região central de São Paulo.",
    "highlights": [
      "Atuação na região central de São Paulo",
      "Ajuda de custo de R$ 5.000",
      "Foco em gestão de funil, metas, treinamento e performance"
    ],
    "details": [
      "Ter no mínimo 5 corretores",
      "Experiência comercial no mercado imobiliário",
      "Perfil para formar, acompanhar e acelerar operação"
    ],
    "badge": "Centro SP"
  },
  {
    "id": "sdr-consolacao",
    "title": "Telemarketing Ativo / SDR",
    "category": "SDR e atendimento",
    "location": "Consolação/SP",
    "contract": "PJ",
    "pay": "R$ 2.500 fixo + comissão",
    "summary": "Atuação com prospecção, qualificação de leads e geração de oportunidades comerciais.",
    "highlights": [
      "Contato ativo com leads e potenciais clientes",
      "Prospecção e qualificação de oportunidades",
      "Horário flexível com opções de turno"
    ],
    "details": [
      "Boa comunicação e clareza ao falar",
      "Perfil proativo e organizado",
      "Resiliência para metas e objeções",
      "Interesse em crescimento na área comercial"
    ],
    "badge": "PJ"
  },
  {
    "id": "gerente-vendas-sao-paulo-10k",
    "title": "Gerente de Vendas – Imobiliário",
    "category": "Gerência comercial",
    "location": "São Paulo/SP",
    "contract": "Autônomo",
    "pay": "Ajuda de custo mensal de R$ 10.000 + comissão",
    "summary": "Oportunidade estratégica para líder com equipe própria e histórico de resultado.",
    "highlights": [
      "Ajuda de custo mensal de R$ 10.000",
      "Autonomia para gestão e desenvolvimento de equipe",
      "Atuação direta em operações e lançamentos imobiliários"
    ],
    "details": [
      "Vivência comprovada em liderança comercial",
      "Equipe própria com no mínimo 10 profissionais ativos",
      "Capacidade de cobrar, acompanhar e desenvolver performance",
      "Organização, leitura de indicadores e tomada de decisão"
    ],
    "badge": "Estratégica"
  },
  {
    "id": "jovem-aprendiz-imobiliario",
    "title": "Jovem Aprendiz – Formação no Mercado Imobiliário",
    "category": "Novos talentos",
    "location": "São Paulo/SP",
    "contract": "Formação",
    "pay": "Bolsa integral do curso técnico + possível ajuda de custo",
    "summary": "Para jovens até 23 anos que desejam se formar e iniciar carreira no mercado imobiliário.",
    "highlights": [
      "Bolsa integral do curso técnico",
      "Treinamento prático e teórico desde o início",
      "Acompanhamento, capacitação e suporte diário"
    ],
    "details": [
      "Não exige experiência prévia no mercado imobiliário",
      "Indicado para quem tem vontade de aprender, crescer e se desenvolver",
      "Plantões em diversas regiões de São Paulo, com imóveis populares, médio padrão, alto padrão e boutique",
      "Em alguns casos, ajuda de custo avaliada individualmente"
    ],
    "badge": "Formação"
  },
  {
    "id": "telemarketing-pirituba",
    "title": "Telemarketing Ativo",
    "category": "SDR e atendimento",
    "location": "Pirituba/SP",
    "contract": "Com experiência",
    "pay": "Salário R$ 2.500 + VT + VR",
    "summary": "Contato ativo com clientes e leads, apresentação de ofertas, follow-up e agendamentos.",
    "highlights": [
      "Salário R$ 2.500",
      "Vale transporte e vale refeição",
      "Função orientada a metas e resultados"
    ],
    "details": [
      "Boa comunicação e poder de persuasão",
      "Inteligência emocional e resiliência",
      "Organização e foco em resultado",
      "Empatia e cordialidade no atendimento",
      "Ensino médio completo"
    ],
    "badge": "Pirituba"
  }
];

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

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

  function createJobCard(job) {
    const highlights = job.highlights.slice(0, 3).map((item) => `<li>${item}</li>`).join('');
    return `
      <article class="job-card reveal in-view" data-category="${job.category}">
        <div class="job-card-head">
          <span class="job-badge">${job.badge}</span>
          <h3>${job.title}</h3>
          <div class="job-location">📍 ${job.location}</div>
        </div>
        <div class="job-card-body">
          <p>${job.summary}</p>
          <div class="job-meta">
            <span>💼 ${job.contract}</span>
            <span>💰 ${job.pay}</span>
          </div>
          <ul class="job-list">${highlights}</ul>
          <button class="btn btn-primary btn-full js-open-job" type="button" data-job-id="${job.id}">Tenho interesse</button>
        </div>
      </article>
    `;
  }

  function renderJobs(filter = 'todas') {
    const grid = $('#jobsGrid');
    if (!grid) return;

    const list = filter === 'todas' ? JOBS : JOBS.filter((job) => job.category === filter);
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
    renderJobs();
  });
})();
