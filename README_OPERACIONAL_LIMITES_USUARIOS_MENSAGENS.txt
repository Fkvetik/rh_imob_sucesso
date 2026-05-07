RH IMOB | Plataforma Corretores - Versão operacional completa
Data: 2026-05-06

O QUE ESTA VERSAO ENTREGA

1. Corrige erro do Supabase:
   column reference "lead_key" is ambiguous

2. Ajusta abertura de contato completo:
   - usa abrir_lead(p_lead_key)
   - retorna JSON com lead, usuario e plano
   - consome o lead apenas para a conta/plano logado
   - bloqueia quando o limite de acessos do plano acaba

3. Ajusta busca logada:
   - usa search_leads_plano
   - oculta leads ja consumidos pelo plano
   - filtra por cidade, ano e coluna cargo normalizada

4. Painel ADMIN/MASTER:
   - mostra empresa/plano
   - mostra usuarios contratados/ativos/disponiveis
   - mostra limite, consumidos e restantes
   - mostra consumo por operador
   - mostra ultimos contatos liberados

5. Operadores:
   - lista operadores do plano
   - permite inativar operador
   - permite reativar operador
   - nao cria e nao exclui operador pelo HTML
   - cadastro/exclusao continua pela planilha-mae

6. Mensagens:
   - lista frases de abordagem
   - permite personalizar frases para o plano
   - permite editar frase
   - permite ativar/inativar frase
   - usa placeholders {nome}, {cidade}, {Usuário}

ORDEM DE IMPLANTACAO

1. No Supabase SQL Editor, cole e rode:
   SQL_SUPABASE_OPERACIONAL_COMPLETO_2026_05_06.sql

2. Suba todos os arquivos deste ZIP no GitHub.

3. Aguarde o Vercel redeploy.

4. Acesse:
   https://rh-imob-sucesso.vercel.app/corretores
   ou
   https://rh-imob-sucesso.vercel.app/corretores.html

5. Faça login com usuario ADMIN.

6. Teste:
   - Abrir contato completo
   - Painel do plano
   - Inativar/Reativar operador
   - Mensagens de abordagem

SEGURANCA

Este pacote nao contem service_role.
O front usa apenas publishable key em supabase-config.js.
A service_role continua somente na planilha-mae/Apps Script ou backend seguro.

