@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title RH IMOB CRM - Configurar Supabase
cd /d "%~dp0"
echo.
echo ==============================================
echo   RH IMOB CRM - Configuracao sem editar codigo
echo ==============================================
echo.
echo Pressione ENTER para usar o valor sugerido quando aparecer entre colchetes.
echo.
set "DEFAULT_URL=https://hrsqxyisqinjuieigzvc.supabase.co"
set "DEFAULT_TOKEN=Meldesouza1508$"
set /p CRM_URL=CRM_SUPABASE_URL [%DEFAULT_URL%]: 
if "%CRM_URL%"=="" set "CRM_URL=%DEFAULT_URL%"
set /p CRM_KEY=CRM_SUPABASE_SERVICE_ROLE_KEY cole aqui: 
set /p CRM_TOKEN=CRM_PANEL_TOKEN [%DEFAULT_TOKEN%]: 
if "%CRM_TOKEN%"=="" set "CRM_TOKEN=%DEFAULT_TOKEN%"
set /p CRM_ORIGIN=CRM_ALLOWED_ORIGIN [*]: 
if "%CRM_ORIGIN%"=="" set "CRM_ORIGIN=*"
(
  echo CRM_SUPABASE_URL=%CRM_URL%
  echo CRM_SUPABASE_SERVICE_ROLE_KEY=%CRM_KEY%
  echo CRM_PANEL_TOKEN=%CRM_TOKEN%
  echo CRM_ALLOWED_ORIGIN=%CRM_ORIGIN%
  echo CRM_LOCAL_BYPASS=SIM
) > .env.local

echo.
echo Arquivo .env.local criado com sucesso.
echo As chaves nao foram exibidas no console.
echo.
pause
