RH IMOB • Plataforma Novos Talentos
ETAPA 4 — Página do site

PACOTE:
- novos-talentos.html
- novos-talentos.css
- novos-talentos.js
- 03_SQL_RPC_NOVOS_TALENTOS_SITE.sql
- BLOCO_OPCIONAL_HOME_NOVOS_TALENTOS.txt
- README_ETAPA_4_SITE_NOVOS_TALENTOS.txt

O QUE FOI CRIADO:
1. Uma rota nova e isolada:
   /novos-talentos.html

2. Arquivos próprios:
   novos-talentos.css
   novos-talentos.js

3. SQL complementar:
   03_SQL_RPC_NOVOS_TALENTOS_SITE.sql

4. Nenhum arquivo existente da Plataforma Corretores foi alterado.

ORDEM DE INSTALAÇÃO:

1) No Supabase, execute:
   03_SQL_RPC_NOVOS_TALENTOS_SITE.sql

Esse SQL cria funções seguras:
- nt_app_context
- nt_listar_talentos
- nt_consumir_talento
- nt_listar_frases_plano

2) No GitHub/site, envie estes arquivos novos para a raiz:
- novos-talentos.html
- novos-talentos.css
- novos-talentos.js

3) Mantenha o arquivo existente:
- supabase-config.js

A nova página usa:
window.RHIMOB_SUPABASE_CONFIG.url
window.RHIMOB_SUPABASE_CONFIG.publishableKey

Ela NÃO usa service_role.

4) Acesse:
https://rhimob0305.vercel.app/novos-talentos.html

5) Entre com:
rhimobvip@gmail.com

REGRAS IMPLEMENTADAS:
- Sem login, não mostra base.
- Com login, carrega contexto da conta e saldo.
- Mostra somente talentos públicos.
- Telefone/e-mail só aparecem após clicar em Ver detalhes.
- Ver detalhes chama nt_consumir_talento.
- O consumo é registrado por conta_id + talento_key.
- O lead consumido some para a mesma conta nas próximas buscas.
- Para outras contas, continua disponível.
- Mensagens de abordagem vêm de nt_frases_abordagem.

IMPORTANTE:
O SQL complementar precisa estar instalado antes da página funcionar, porque o front usa RPCs para proteger consulta e consumo.
