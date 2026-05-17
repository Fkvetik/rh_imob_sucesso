@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Fechando processos node.exe existentes...
taskkill /F /IM node.exe >nul 2>nul
echo Limpando .next...
if exist .next rmdir /s /q .next
call INICIAR_AQUI.cmd
