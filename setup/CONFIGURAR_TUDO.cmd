@echo off
title RH IMOB CRM — Configuracao Automatica
color 0B
echo.
echo  ================================================
echo   RH IMOB CRM — Configuracao de Producao
echo  ================================================
echo.
echo  Este assistente vai:
echo    [1] Definir variaveis no Vercel
echo    [2] Executar SQL no Supabase
echo    [3] Configurar webhooks na Z-API
echo    [4] Abrir passos manuais no navegador
echo.
echo  Pressione qualquer tecla para comecar...
pause > nul

:: Verifica se PowerShell está disponível
where powershell >nul 2>&1
if errorlevel 1 (
    echo ERRO: PowerShell nao encontrado.
    pause
    exit /b 1
)

:: Verifica se o arquivo de config existe
if not exist "%~dp0MINHAS_CONFIGURACOES.ini" (
    echo ERRO: MINHAS_CONFIGURACOES.ini nao encontrado.
    echo Verifique se o arquivo esta na mesma pasta deste .cmd
    pause
    exit /b 1
)

echo.
echo  Iniciando configuracao...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\CONFIGURAR_TUDO.ps1" -ConfigFile "%~dp0MINHAS_CONFIGURACOES.ini"

echo.
echo  Pressione qualquer tecla para fechar...
pause > nul
