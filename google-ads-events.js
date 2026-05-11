(() => {
  'use strict';

  const config = window.RHIMOB_GOOGLE_ADS_CONFIG || {};
  const enabled = config.enabled === true;
  const adsId = String(config.googleAdsId || '').trim();
  const ga4Id = String(config.ga4MeasurementId || '').trim();
  const conversions = config.conversions || {};
  const debug = config.debug === true;
  const cooldown = new Map();

  function log(...args) {
    if (debug) console.info('[RHIMOB ADS]', ...args);
  }

  function validAdsId(value) {
    return /^AW-[0-9]+$/.test(String(value || '').trim());
  }

  function validGa4Id(value) {
    return /^G-[A-Z0-9]+$/.test(String(value || '').trim());
  }

  function validSendTo(value) {
    return /^AW-[0-9]+\/[A-Za-z0-9_-]+$/.test(String(value || '').trim());
  }

  function ensureGtag() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  }

  function injectGtagScript(id, attrName) {
    if (!id) return;
    if (document.querySelector(`script[${attrName}="${id}"]`)) return;

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    s.setAttribute(attrName, id);
    document.head.appendChild(s);
  }

  function loadGoogleTags() {
    ensureGtag();

    if (!enabled) {
      log('Rastreamento desativado em google-ads-config.js. Eventos ficam em modo debug.');
      return;
    }

    window.gtag('js', new Date());

    if (validAdsId(adsId)) {
      injectGtagScript(adsId, 'data-rhimob-google-ads');
      window.gtag('config', adsId);
      log('Google Ads tag carregada:', adsId);
    } else {
      console.warn('[RHIMOB ADS] googleAdsId inválido. Use formato AW-XXXXXXXXXX em google-ads-config.js');
    }

    if (validGa4Id(ga4Id)) {
      injectGtagScript(ga4Id, 'data-rhimob-ga4');
      window.gtag('config', ga4Id, {
        send_page_view: true
      });
      log('GA4 tag carregada:', ga4Id);
    } else {
      console.warn('[RHIMOB ADS] ga4MeasurementId ausente ou inválido. Use formato G-XXXXXXXXXX em google-ads-config.js');
    }
  }

  function once(key, ms = 1200) {
    const now = Date.now();
    const last = cooldown.get(key) || 0;
    if (now - last < ms) return false;
    cooldown.set(key, now);
    return true;
  }

  function normalizeEventParams(name, params = {}) {
    return {
      event_category: 'RH IMOB Site',
      event_label: params.label || name,
      lead_type: name,
      page_location: window.location.href,
      page_title: document.title,
      ...params
    };
  }

  function sendRecommendedLead(name, payload) {
    if (!enabled || typeof window.gtag !== 'function') return;
    if (config.sendRecommendedLeadEvent !== true) return;

    const leadEvents = new Set([
      'whatsapp_empresa',
      'whatsapp_vagas',
      'anunciar_vaga',
      'candidatura_vaga',
      'banco_talentos'
    ]);

    if (!leadEvents.has(name)) return;

    window.gtag('event', 'generate_lead', {
      event_category: 'RH IMOB Lead',
      event_label: payload.event_label,
      lead_type: name,
      value: Number(payload.value || 1),
      currency: payload.currency || 'BRL',
      page_location: payload.page_location,
      page_title: payload.page_title
    });
    log('evento recomendado enviado: generate_lead', name);
  }

  function track(name, params = {}) {
    const eventKey = `${name}:${params.vaga_id || params.href || params.form_id || ''}`;
    if (!once(eventKey)) return;

    ensureGtag();
    const payload = normalizeEventParams(name, params);

    log('evento:', name, payload);

    if (enabled && typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
      sendRecommendedLead(name, payload);
    }

    const sendTo = String(conversions[name] || '').trim();
    if (enabled && validSendTo(sendTo) && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: sendTo,
        event_category: 'RH IMOB Conversão',
        event_label: payload.event_label,
        value: Number(params.value || 1),
        currency: params.currency || 'BRL'
      });
      log('conversão enviada:', name, sendTo);
    }
  }

  function closest(el, selector) {
    return el && el.closest ? el.closest(selector) : null;
  }

  function getHref(el) {
    return el && el.getAttribute ? String(el.getAttribute('href') || '') : '';
  }

  function wireClickTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target;

      const shareBtn = closest(target, '.js-share-job');
      if (shareBtn) {
        track('compartilhar_vaga', {
          vaga_id: shareBtn.dataset.jobShareId || '',
          label: 'Compartilhar vaga'
        });
        return;
      }

      const openJobBtn = closest(target, '.js-open-job');
      if (openJobBtn) {
        track('abrir_formulario_vaga', {
          vaga_id: openJobBtn.dataset.jobId || '',
          label: 'Tenho interesse'
        });
        return;
      }

      const advertiseBtn = closest(target, '#openAdvertiseModal, a[href="#anunciar-vaga"], a[href*="anunciar-vaga"]');
      if (advertiseBtn) {
        track('abrir_formulario_anunciar_vaga', {
          label: 'Quero anunciar minha vaga'
        });
        return;
      }

      const supportCompany = closest(target, '.js-support-company, .js-open-company-lead, a[href="#contratar"], a[href="/#contratar"]');
      if (supportCompany) {
        track('abrir_formulario_empresa', {
          href: getHref(supportCompany),
          label: 'Abrir pré-qualificação empresa'
        });
        return;
      }

      const supportJobs = closest(target, '.js-support-jobs');
      if (supportJobs) {
        track('abrir_caminho_vagas', {
          label: 'Abrir caminho vagas'
        });
        return;
      }

      const waLink = closest(target, '.js-whatsapp, a[href*="wa.me"], a[href*="whatsapp"]');
      if (waLink) {
        const type = waLink.dataset ? (waLink.dataset.type || '') : '';
        track(type === 'empresa' ? 'abrir_formulario_empresa' : 'abrir_suporte', {
          href: getHref(waLink),
          label: type === 'empresa' ? 'Abrir pré-qualificação empresa' : 'Abrir suporte RH IMOB'
        });
        return;
      }

      const platformCorretores = closest(target, 'a[href*="corretores.html"]');
      if (platformCorretores) {
        track('plataforma_corretores', {
          href: getHref(platformCorretores),
          label: 'Acesso Plataforma Corretores'
        });
        return;
      }

      const platformNt = closest(target, 'a[href*="novos-talentos.html"]');
      if (platformNt) {
        track('plataforma_novos_talentos', {
          href: getHref(platformNt),
          label: 'Acesso Plataforma Novos Talentos'
        });
      }
    }, true);
  }

  function wireSubmitTracking() {
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (!form || !form.id) return;

      if (form.id === 'jobForm') {
        const jobId = form.elements && form.elements.jobId ? form.elements.jobId.value : '';
        track('candidatura_vaga', {
          form_id: 'jobForm',
          vaga_id: jobId,
          label: 'Candidatura vaga via WhatsApp'
        });
        return;
      }

      if (form.id === 'advertiseForm') {
        track('anunciar_vaga', {
          form_id: 'advertiseForm',
          label: 'Lead empresa para anunciar vaga',
          value: 5
        });
        return;
      }

      if (form.id === 'talentForm') {
        track('banco_talentos', {
          form_id: 'talentForm',
          label: 'Cadastro banco de talentos'
        });
        return;
      }

      if (form.id === 'leadForm' || form.id === 'companyLeadForm') {
        track('whatsapp_empresa', {
          form_id: form.id,
          label: form.id === 'companyLeadForm' ? 'Lead empresa modal pré-qualificado' : 'Lead empresa formulário principal',
          value: 5
        });
      }
    }, true);
  }

  window.RHIMOBTrackAdsEvent = track;

  loadGoogleTags();
  wireClickTracking();
  wireSubmitTracking();
})();
