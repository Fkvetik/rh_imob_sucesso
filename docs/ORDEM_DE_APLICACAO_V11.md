# RH IMOB CRM V11 — ordem de aplicação

## Localhost recusado
Quando aparece “A conexão com localhost foi recusada”, o Next.js não está rodando. Abra `INICIAR_AQUI.cmd` e mantenha a janela aberta.

## Ordem recomendada
1. `CONFIGURAR_SUPABASE.cmd`
2. `COPIAR_SQL_DEDUP.cmd` e executar no Supabase.
3. `COPIAR_SQL_LEMBRETES.cmd` e executar no Supabase.
4. `COPIAR_08_APPS_SCRIPT.cmd` e colar no Apps Script.
5. `COPIAR_09_APPS_SCRIPT.cmd` e colar no Apps Script.
6. No Apps Script, rodar:
   - `painel_47_supabase_limpar_duplicidades_conversas`
   - `painel_46_supabase_reconstruir_conversas_completas`
   - `painel_45_supabase_auditar_conversas`
   - `painel_50_agenda_debug_lembretes`
7. `INICIAR_AQUI.cmd` para abrir o CRM local.

## Gatilhos depois de validar
- Conversas completas: `painel_49_supabase_instalar_gatilho_conversas_completas_1min`
- Lembretes: `painel_52_agenda_instalar_gatilho_lembretes_15min`
