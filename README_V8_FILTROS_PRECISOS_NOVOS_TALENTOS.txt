RH IMOB • Novos Talentos
V8 — Correção dos filtros perdidos

Problema encontrado:
- Os filtros de macro região, micro região, bairro, idade, cargo e metrô estavam sendo calculados no navegador a partir de uma amostra.
- Isso gerava contagens erradas, por exemplo "Zona Sul (1)" mesmo existindo milhares de registros.
- A base também tem muitos registros com regiao_macro e micro_regiao vazios.

Correção:
- A contagem dos filtros agora é feita no Supabase, em cima da base completa.
- O front não calcula mais filtros por amostra.
- Macro região é derivada no banco quando regiao_macro estiver vazia.
- Micro região usa micro_regiao, estação de metrô ou bairro.
- A listagem também usa a mesma regra dos filtros.

Arquivos alterados:
- novos-talentos.html
- novos-talentos.css
- novos-talentos.js
- supabase-config-novos-talentos.js

Arquivo SQL novo:
- 09_SQL_FILTROS_PRECISOS_NT_V8.sql

Ordem para aplicar:
1. Rode no Supabase correto dos Novos Talentos:
   09_SQL_FILTROS_PRECISOS_NT_V8.sql

2. Suba no GitHub/Vercel:
   novos-talentos.html
   novos-talentos.css
   novos-talentos.js
   supabase-config-novos-talentos.js

3. Teste:
   /novos-talentos.html?nt=11

Resultado esperado:
- Cidade com contagem correta.
- Macro região com contagem real.
- Micro região e bairro coerentes com a cidade/macro escolhida.
- Cards e filtros falando a mesma língua.
