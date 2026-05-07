RH IMOB • Novos Talentos
HOTFIX v3 — sem texto técnico na tela + correção preview público

Problema visto:
A página mostrou:
Could not find the table 'public.nt_filtro_cidade' in the schema cache

Diagnóstico:
Isso não é bloqueio normal de acesso público.
Se fosse bloqueio de permissão, a mensagem seria de acesso negado ou a consulta viria vazia.
Esse erro indica:
1. O site está conectado em um projeto onde as tabelas nt_* não existem; ou
2. As tabelas existem, mas o cache da API do Supabase ainda não foi recarregado; ou
3. O arquivo supabase-config.js publicado está apontando para outro projeto.

Correção neste pacote:
1. O texto técnico não aparece mais para o cliente.
2. A tela mostra mensagem comercial.
3. Incluído SQL 06 para:
   - conferir se as tabelas existem no projeto conectado;
   - liberar prévia pública protegida;
   - recarregar cache da API.

Ordem:
1. Execute no Supabase:
   06_SQL_CORRIGIR_PREVIEW_PUBLICO_E_SCHEMA_CACHE_NT.sql

2. Suba no site:
   novos-talentos.html
   novos-talentos.js
   novos-talentos.css

3. Confira supabase-config.js no site:
   deve apontar para o mesmo projeto onde estão as tabelas nt_*.

Importante:
Telefone, e-mail e dados completos continuam protegidos.
A liberação pública é só para:
- nt_talentos_publicos
- nt_filtro_cidade
- nt_filtro_cidade_idade
- nt_filtro_cidade_cargo
- nt_filtro_cidade_metro
