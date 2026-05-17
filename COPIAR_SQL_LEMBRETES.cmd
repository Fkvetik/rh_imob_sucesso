@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "Get-Content -Raw 'sql\08_estrutura_respostas_rapidas_e_lembretes.sql' | Set-Clipboard"
echo SQL de lembretes copiado. Cole no SQL Editor do Supabase.
pause
