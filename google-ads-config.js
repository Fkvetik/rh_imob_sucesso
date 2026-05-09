/*
  RH IMOB • Google Ads Config
  Hotfix de coleta de eventos - 2026-05-09

  Objetivo desta versão:
  - Ativar a Google Tag do Google Ads.
  - Disparar eventos reais para o Google reconhecer ações do site.
  - Ainda NÃO usa labels finais de conversão AW-.../... porque eles serão criados depois.

  Depois que os eventos aparecerem no Google Ads/Analytics, criaremos as conversões finais
  e preencheremos o bloco conversions com os códigos completos.
*/
window.RHIMOB_GOOGLE_ADS_CONFIG = {
  enabled: true,
  googleAdsId: 'AW-3123495121',
  debug: true,

  // Envia também o evento recomendado generate_lead para facilitar a leitura pelo Google Ads.
  sendRecommendedLeadEvent: true,

  // Por enquanto deixar vazio para não disparar conversões com labels falsos.
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
