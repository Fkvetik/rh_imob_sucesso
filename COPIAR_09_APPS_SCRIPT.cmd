@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "Get-Content -Raw 'apps_script\09_Supabase_Agenda_Lembretes.gs' | Set-Clipboard"
echo Arquivo 09 copiado para a area de transferencia.
echo Cole no Apps Script em arquivo chamado 09_Supabase_Agenda_Lembretes.gs
pause
