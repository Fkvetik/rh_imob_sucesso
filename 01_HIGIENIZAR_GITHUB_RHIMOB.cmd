@echo off
chcp 65001 >nul
title RH IMOB - Higienizacao Segura do GitHub

echo ============================================================
echo   RH IMOB - HIGIENIZACAO SEGURA DO REPOSITORIO GITHUB
echo ============================================================
echo.
echo Este arquivo deve ser executado DENTRO da pasta do repositorio:
echo   Fkvetik/rh_imob_sucesso
echo.
echo Ele NAO apaga arquivos. Ele move arquivos antigos para _archive.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0higienizar_github_rhimob.ps1"

echo.
pause
