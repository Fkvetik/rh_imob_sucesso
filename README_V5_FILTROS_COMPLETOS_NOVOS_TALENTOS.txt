RH IMOB • Novos Talentos v5
Filtros completos + Supabase separado + prévia pública por RPC

Problemas tratados:
1. O HTML não carregava porque estava consultando ambiente/configuração errada ou função/tabela não disponível no cache da API.
2. Os filtros ainda estavam simples: cidade, idade, cargo e metrô.
3. Faltavam macro região, micro região e bairro.
4. A base pública tinha campos regiao_macro e micro_regiao, mas muitos registros estavam vazios. A V5 deriva macro região pelo texto do bairro quando possível e usa bairro/estação como apoio para micro região.

Arquivos alterados:
- novos-talentos.html
- novos-talentos.css
- novos-talentos.js
- supabase-config-novos-talentos.js

Arquivo novo:
- 07_SQL_FUNCOES_PUBLICAS_FILTROS_COMPLETOS_NT.sql

Ordem para aplicar:
1. Rode no Supabase correto da Plataforma Novos Talentos:
   07_SQL_FUNCOES_PUBLICAS_FILTROS_COMPLETOS_NT.sql

2. Suba no GitHub/Vercel:
   novos-talentos.html
   novos-talentos.css
   novos-talentos.js
   supabase-config-novos-talentos.js

3. Acesse com cache novo:
   /novos-talentos.html?nt=7

Filtros disponíveis:
- Cidade
- Macro região
- Micro região
- Bairro
- Faixa de idade
- Perfil / cargo
- Metrô próximo
- Busca por termo

Segurança:
- Sem login: prévia pública protegida, sem telefone/e-mail.
- Com login: libera detalhes via nt_consumir_talento e registra consumo.
- A Plataforma Corretores continua usando outro Supabase e outro config.
