RH IMOB • Site público dinâmico enxuto • 2026-05-08

OBJETIVO
Deixar o site público mais autônomo, com:
1) métricas reais aproximadas de Corretores e Novos Talentos;
2) vagas dinâmicas alimentadas por aba de planilha;
3) fallback seguro caso o Supabase não responda.

ARQUIVOS DO SITE PARA SUBIR NO GITHUB/VERCEL
- index.html
- vagas.html
- script.js
- supabase-config.js
- supabase-config-novos-talentos.js

ARQUIVOS OPERACIONAIS
- 01_SUPABASE_SITE_PUBLICO.sql
  Rode no Supabase correto. Cria a tabela public.site_vagas_publicas e libera SELECT público só para vagas ATIVAS.

- 02_APPS_SCRIPT_VAGAS_SITE.gs
  Coloque no Apps Script da planilha operacional onde deseja editar as vagas.

ORDEM DE APLICAÇÃO
1. No Supabase correto, rode o SQL: 01_SUPABASE_SITE_PUBLICO.sql
2. No Apps Script da planilha, adicione o arquivo: 02_APPS_SCRIPT_VAGAS_SITE.gs
3. Execute: VAGAS_SITE_setup
4. Edite a aba VAGAS_SITE.
5. Execute: VAGAS_SITE_syncSupabase
6. Suba no GitHub os arquivos do site listados acima.
7. Aguarde o Vercel publicar.

COMO AS VAGAS FUNCIONAM
- status = ATIVA aparece no site.
- status = INATIVA não aparece.
- As vagas fixas no script.js continuam como fallback se o Supabase falhar.

MÉTRICAS DA HOME
- Novos Talentos lê nt_talentos_publicos, nt_filtro_cidade e nt_filtro_cidade_metro.
- Corretores lê leads_publicos, lead_filtros_cidade e lead_filtros_cidade_ano_cargo.
- O total de novos talentos é arredondado para cima. Ex.: 57.717 vira 58 mil+.

ADMIN E USUÁRIOS
Admin e usuários continuam pelo motor da planilha central Novos Talentos:
- CONTAS_MODELO_NT
- USUARIOS_MODELO_NT
- MENSAGEM_NT
- NTV2_motorWorkerCompleto

Este pacote não inclui um segundo motor de usuários para não duplicar lógica nem quebrar o fluxo que já está funcionando.

SEGURANÇA
- Não há service_role em HTML, JS, GitHub ou Vercel.
- No site ficam apenas chaves públicas/publishable.
- A service_role deve permanecer somente nas Propriedades do Script.
