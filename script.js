(() => {
  const WHATSAPP_NUMBER = '5511978725515';
  const DEFAULT_MESSAGE = 'Olá, vim pelo site da RH IMOB e gostaria de entender melhor como vocês podem apoiar nossa empresa no recrutamento imobiliário.';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  function openWhatsApp(message) {
    const text = encodeURIComponent(message || DEFAULT_MESSAGE);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function buildLeadMessage(data) {
    return [
      'Olá, vim pelo site da RH IMOB e gostaria de receber mais informações.',
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

  function setupWhatsAppLinks() {
    $$('.js-whatsapp').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openWhatsApp(link.dataset.message || DEFAULT_MESSAGE);
      });
    });
  }

  function setupForm() {
    const form = $('#leadForm');
    if (!form) return;

    const phone = form.elements.whatsapp;
    if (phone) {
      phone.addEventListener('input', () => {
        let value = phone.value.replace(/\D/g, '').slice(0, 11);
        if (value.length > 10) {
          value = value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
        } else if (value.length > 6) {
          value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
        } else if (value.length > 2) {
          value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
        }
        phone.value = value;
      });
    }

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
        const firstMissing = form.elements[missing[0]];
        firstMissing?.focus();
        alert('Por favor, preencha os campos obrigatórios antes de abrir o WhatsApp.');
        return;
      }

      openWhatsApp(buildLeadMessage(data));
    });
  }

  function setupMobileMenu() {
    const button = $('.nav-toggle');
    const nav = $('#menu-principal');
    if (!button || !nav) return;

    button.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });

    $$('a', nav).forEach((item) => {
      item.addEventListener('click', () => {
        nav.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function setupReveal() {
    const items = $$('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    items.forEach((item) => observer.observe(item));
  }

  function setupYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  setupWhatsAppLinks();
  setupForm();
  setupMobileMenu();
  setupReveal();
  setupYear();
})();
