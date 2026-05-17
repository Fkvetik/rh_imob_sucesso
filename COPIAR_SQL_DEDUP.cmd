@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "Get-Content -Raw 'sql\07_limpeza_dedup_conversas.sql' | Set-Clipboard"
echo SQL de limpeza dedup copiado. Cole no SQL Editor do Supabase.
pause
