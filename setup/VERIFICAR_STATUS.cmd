@echo off
title RH IMOB CRM — Verificacao de Status
color 0A
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\VERIFICAR_STATUS.ps1" -ConfigFile "%~dp0MINHAS_CONFIGURACOES.ini"
pause
