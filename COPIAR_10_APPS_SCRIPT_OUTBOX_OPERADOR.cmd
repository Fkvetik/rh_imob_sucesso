@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Raw 'apps_script\10_Supabase_Outbox_Operador_V15.gs' | Set-Clipboard"
echo Apps Script 10 copiado para a area de transferencia.
echo Cole no Apps Script em um arquivo chamado 10_Supabase_Outbox_Operador_V15.gs.
pause
