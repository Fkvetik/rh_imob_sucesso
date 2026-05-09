/*
  RH IMOB • Google Ads + GA4 Config
  Atualizado em 2026-05-09

  IDs públicos de rastreamento:
  - Google Ads: AW-3123495121
  - Google Analytics 4: G-NSJD4F675L

  Não colocar service_role, token privado ou chave secreta neste arquivo.
*/
window.RHIMOB_GOOGLE_ADS_CONFIG = {
  enabled: true,
  googleAdsId: 'AW-3123495121',
  ga4MeasurementId: 'G-NSJD4F675L',
  debug: true,

  // Envia também o evento recomendado generate_lead para facilitar a leitura pelo Google Ads/GA4.
  sendRecommendedLeadEvent: true,

  // Depois que o Google Ads gerar labels AW-.../..., preencher aqui.
  // Por enquanto fica vazio para apenas coletar eventos no GA4 e no Google Ads.
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
