RH IMOB • Plataforma Novos Talentos
V6 — Verificado e corrigido

Verificações feitas:
1. A planilha está populada e o upload Supabase terminou como DONE.
2. A aba SB_TALENTOS_PUBLICOS_NT tem 22 colunas públicas.
3. Os campos existem:
   - cidade
   - estado_uf
   - bairro
   - faixa_idade
   - cargo
   - estacao_mais_proxima
   - linha_metro_mais_proxima
   - regiao_macro
   - micro_regiao

Ponto encontrado:
- Muitos registros estão com regiao_macro e micro_regiao vazios.
- Por isso o front v6 infere macro região pelo bairro quando possível:
  Zona Sul, Zona Norte, Zona Leste, Zona Oeste e Centro.
- Micro região usa micro_regiao quando existir e, como apoio, estação de metrô.

Correções v6:
1. A página Novos Talentos usa Supabase próprio:
   supabase-config-novos-talentos.js

2. A prévia pública não depende mais das funções RPC da V5.
   Ela consulta diretamente as tabelas públicas mascaradas:
   - nt_talentos_publicos
   - nt_filtro_cidade

3. A página mostra filtros:
   - Cidade
   - Macro região
   - Micro região
   - Bairro
   - Faixa de idade
   - Perfil / cargo
   - Metrô próximo
   - Busca por termo

4. Nenhum texto técnico aparece para o cliente.

Ordem para aplicar:
1. Suba no GitHub/Vercel:
   - novos-talentos.html
   - novos-talentos.css
   - novos-talentos.js
   - supabase-config-novos-talentos.js

2. Rode no Supabase correto de Novos Talentos:
   08_SQL_ATIVAR_PREVIEW_DIRETO_NT_V6.sql

3. Acesse:
   /novos-talentos.html?nt=9

Regra de segurança:
- Sem login: mostra apenas prévia pública mascarada.
- Com login e consumo: libera contato completo.
- A Plataforma Corretores continua usando o Supabase dela.
