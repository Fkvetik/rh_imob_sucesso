@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "Get-Content -Raw 'apps_script\08_Supabase_Conversa_Completa_Dedup.gs' | Set-Clipboard"
echo Arquivo 08 copiado para a area de transferencia.
echo Cole no Apps Script em arquivo chamado 08_Supabase_Conversa_Completa_Dedup.gs
pause
