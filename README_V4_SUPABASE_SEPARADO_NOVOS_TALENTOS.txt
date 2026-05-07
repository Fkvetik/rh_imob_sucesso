RH IMOB • Novos Talentos
V4 — Supabase separado da Plataforma Corretores

Problema identificado:
A Plataforma Corretores e a Plataforma Novos Talentos usam projetos Supabase diferentes.
A página /novos-talentos.html estava carregando o arquivo supabase-config.js geral, que pertence ao projeto da Plataforma Corretores.
Por isso o site procurava nt_filtro_cidade no projeto errado e mostrava erro.

Correção aplicada:
1. Criado arquivo novo:
   supabase-config-novos-talentos.js

2. A página:
   novos-talentos.html

   agora carrega:
   supabase-config-novos-talentos.js

   e não usa mais o config da Plataforma Corretores.

3. O arquivo:
   novos-talentos.js

   agora prioriza:
   window.RHIMOB_NOVOS_TALENTOS_SUPABASE_CONFIG

   e só usa RHIMOB_SUPABASE_CONFIG como fallback.

Arquivos alterados:
- novos-talentos.html
- novos-talentos.js

Arquivo novo:
- supabase-config-novos-talentos.js

Arquivos não alterados:
- corretores.html
- corretores.js
- supabase-config.js da Plataforma Corretores

O que subir no GitHub/Vercel:
- novos-talentos.html
- novos-talentos.js
- novos-talentos.css
- supabase-config-novos-talentos.js

Importante:
Não colocar service_role neste arquivo.
A chave usada é pública/publicável, própria para front-end.

Depois de subir:
1. Aguarde o Vercel publicar.
2. Acesse:
   /novos-talentos.html?nt=6

3. Sem login, a prévia pública deve carregar.
4. Login continua apenas para liberar contato.
