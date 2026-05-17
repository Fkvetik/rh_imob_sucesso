@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Raw 'sql\09_respostas_rapidas_direcionamento_v15.sql' | Set-Clipboard"
echo SQL V15 copiado para a area de transferencia.
echo Cole no Supabase SQL Editor e execute.
pause
