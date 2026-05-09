/*
  RH IMOB • Google Ads Config
  1) Crie as conversões no Google Ads.
  2) Troque AW-XXXXXXXXXX e os labels abaixo.
  3) Altere enabled para true.
  Não coloque service_role aqui. Este arquivo só usa IDs públicos do Google Ads.
*/
window.RHIMOB_GOOGLE_ADS_CONFIG = {
  enabled: false,
  googleAdsId: 'AW-XXXXXXXXXX',
  debug: true,
  conversions: {
    whatsapp_empresa: 'AW-XXXXXXXXXX/EMPRESA_LABEL',
    whatsapp_vagas: 'AW-XXXXXXXXXX/VAGAS_LABEL',
    anunciar_vaga: 'AW-XXXXXXXXXX/ANUNCIAR_VAGA_LABEL',
    candidatura_vaga: 'AW-XXXXXXXXXX/CANDIDATURA_VAGA_LABEL',
    banco_talentos: 'AW-XXXXXXXXXX/BANCO_TALENTOS_LABEL',
    compartilhar_vaga: 'AW-XXXXXXXXXX/COMPARTILHAR_LABEL',
    plataforma_corretores: 'AW-XXXXXXXXXX/PLATAFORMA_CORRETORES_LABEL',
    plataforma_novos_talentos: 'AW-XXXXXXXXXX/PLATAFORMA_NOVOS_TALENTOS_LABEL'
  }
};
