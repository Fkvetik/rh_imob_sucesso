RH IMOB — GitHub completo do site com eventos Google Ads

Conteúdo deste pacote:
- Site público completo: index.html, vagas.html, politica.html, 404.html
- Plataformas: corretores.html/css/js e novos-talentos.html/css/js
- Configs públicas: supabase-config.js e supabase-config-novos-talentos.js
- Assets: favicon, marca, ícones e imagem OG
- Eventos Google Ads: google-ads-config.js e google-ads-events.js

Recursos já preservados:
- Vagas dinâmicas pelo Supabase
- WhatsApp por responsável da vaga
- Mídia por vaga: imagem, vídeo ou Instagram
- Botão Compartilhar vaga
- Bloco Quero anunciar minha vaga
- Eventos de rastreamento preparados para Google Ads

Atenção:
O arquivo google-ads-config.js vem com enabled=false e IDs fictícios.
Depois que você tiver o ID AW e os labels de conversão, edite esse arquivo:
  enabled: true
  googleAdsId: 'AW-SEU_ID'
  conversions: { ... }

Não existe service_role neste pacote. As chaves públicas do Supabase são publishable/anon.
