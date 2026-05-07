RH IMOB • Novos Talentos V9
Padrão Corretores

O que foi corrigido:
1. O filtro não vem mais numa única resposta misturando cidade, bairro, cargo e região.
2. Cada filtro agora carrega separado, igual ao padrão operacional da Plataforma Corretores.
3. Isso evita o problema de aparecer só bairro e sumirem cidade/macro/micro/idade/cargo.
4. O consumo agora tenta autoajustar o auth_user_id pelo e-mail logado, quando o login existe mas o vínculo ficou diferente.
5. Foi incluído relatório no padrão da Corretores:
   - resumo por conta
   - produção por operador/dia

Arquivos do site para subir:
- novos-talentos.html
- novos-talentos.css
- novos-talentos.js
- supabase-config-novos-talentos.js

SQL obrigatório:
- 10_SQL_NT_PADRAO_CORRETORES_FILTROS_CONSUMO_RELATORIO_V9.sql

Apps Script para a planilha:
- 10_Admin_NT_Padrao_Corretores.gs

Abas criadas pelo Apps Script:
- CONFIG_SUPABASE_NT
- CONTAS_MODELO_NT
- USUARIOS_MODELO_NT
- MENSAGEM_NT
- CONSUMOS_ESPELHO_NT
- RELATORIO_OPERADORES_NT
- LOG_SUPABASE_NT

Ajuste de plano:
Em CONTAS_MODELO_NT:
- usuarios_contratados
- limite_leads
- status
- data_inicio
- data_fim

Ajuste de usuários:
Em USUARIOS_MODELO_NT:
- conta_id
- nome
- email
- senha_temporaria
- perfil
- status
- telefone
- criar_auth
- auth_user_id

Ordem:
1. Rodar o SQL V9 no Supabase Novos Talentos.
2. Subir os 4 arquivos do site.
3. Colar o Apps Script na planilha.
4. Rodar setupPadraoCorretoresNovosTalentos.
5. Usar CONTAS_MODELO_NT e USUARIOS_MODELO_NT como na Plataforma Corretores.
