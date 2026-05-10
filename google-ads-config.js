window.RHIMOB_GOOGLE_ADS_CONFIG = {
  enabled: true,
  googleAdsId: 'AW-3123495121',
  ga4MeasurementId: 'G-NSJD4F675L',
  debug: true,

  sendRecommendedLeadEvent: true,

  // Compatibilidade com a conversao criada no Google Ads por URL.
  // Quando um lead real acontece, o site tambem envia uma visualizacao virtual de /generate_lead.
  sendVirtualLeadPageView: true,
  virtualConversionPath: '/generate_lead',

  conversions: {
    whatsapp_empresa: '',
    whatsapp_vagas: '',
    anunciar_vaga: '',
    candidatura_vaga: '',
    banco_talentos: '',
    compartilhar_vaga: '',
    plataforma_corretores: '',
    plataforma_novos_talentos: ''
  }
};
