@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title RH IMOB CRM - Iniciar Localhost
cd /d "%~dp0"
echo.
echo ==============================================
echo   RH IMOB CRM V11 - Iniciar ferramenta
set "PORT=3000"
echo ==============================================
echo.
if not exist package.json (
  echo ERRO: package.json nao encontrado. Abra este comando dentro da pasta completa do CRM.
  pause
  exit /b 1
)
if not exist .env.local (
  echo .env.local nao encontrado. Abrindo configuracao...
  call CONFIGURAR_SUPABASE.cmd
)
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado.
  echo Instale o Node.js LTS e rode novamente.
  pause
  exit /b 1
)
echo Limpando cache .next para evitar erro page.js...
if exist .next rmdir /s /q .next
if not exist node_modules (
  echo Instalando dependencias. Aguarde...
  call npm install
  if errorlevel 1 (
    echo ERRO ao instalar dependencias.
    pause
    exit /b 1
  )
)
echo.
echo Servidor iniciando. Nao feche esta janela enquanto estiver usando o CRM.
echo Endereco: http://localhost:3000/crm
echo.
start "" "http://localhost:3000/crm"
call npm run dev
pause
