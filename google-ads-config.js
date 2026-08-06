window.RHIMOB_GOOGLE_ADS_CONFIG = {
  enabled: true,
  // ID correto confirmado direto na conta em 2026-08-06 (Metas > Ações de
  // conversão > Editar fontes de dados > Configurar tag do Google > Instalar
  // manualmente). O valor antigo (AW-3123495121) nunca bateu com a conta
  // real — por isso "Inscrição" ficava zerada desde maio mesmo com leads
  // reais acontecendo no site.
  googleAdsId: 'AW-18151768143',
  ga4MeasurementId: 'G-NSJD4F675L',
  debug: true,

  sendRecommendedLeadEvent: true,

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
