RH IMOB • Novos Talentos
V10 — Operação, filtros e consumo corrigidos

O que foi corrigido:
- O SQL V9 parou antes de terminar por falta de created_at.
- O sync da planilha ficou OK, mas as funções do site ficaram incompletas.
- O botão Ver detalhes não conseguia liberar contato.
- Os filtros ficavam instáveis.

Ordem correta:
1. Rode no Supabase Novos Talentos:
   12_SQL_DESTRAVA_OPERACAO_FILTROS_CONSUMO_NT_V10.sql

2. Suba no GitHub/Vercel:
   novos-talentos.html
   novos-talentos.css
   novos-talentos.js
   supabase-config-novos-talentos.js

3. Teste com cache:
   /novos-talentos.html?nt=13

Observação:
Se CONTAS_MODELO_NT e USUARIOS_MODELO_NT estão OK, não precisa sincronizar de novo antes do teste.
