# RH IMOB CRM V11 — versão completa atual

Esta versão reúne:

- Next.js na mesma pasta, sem pasta escondida.
- Tela `/crm`.
- APIs `/api/crm/*`.
- Correção de localhost recusado: use `INICIAR_AQUI.cmd` e mantenha o CMD aberto.
- Envio com botão “Enviar mensagem”.
- Mensagens rápidas editáveis na lateral direita.
- Conversa completa sem duplicidade via Apps Script 08.
- Lembretes de agenda via Apps Script 09.

## Primeiro uso

1. Clique em `CONFIGURAR_SUPABASE.cmd`.
2. Clique em `INICIAR_AQUI.cmd`.
3. Abra `http://localhost:3000/crm`.

## Se der localhost recusado

O servidor não está rodando. Clique em `REINICIAR_LIMPO.cmd`.

## Arquivos Apps Script

- `apps_script/08_Supabase_Conversa_Completa_Dedup.gs`
- `apps_script/09_Supabase_Agenda_Lembretes.gs`

## SQL

- `sql/07_limpeza_dedup_conversas.sql`
- `sql/08_estrutura_respostas_rapidas_e_lembretes.sql`
