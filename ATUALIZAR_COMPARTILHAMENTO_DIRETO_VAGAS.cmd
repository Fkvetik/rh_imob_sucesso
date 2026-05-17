@echo off
setlocal EnableExtensions
chcp 65001 >nul
title RH IMOB - Atualizar compartilhamento direto de vagas

echo.
echo ============================================================
echo RH IMOB - ATUALIZAR COMPARTILHAMENTO DIRETO DE VAGAS
echo ============================================================
echo.
echo Este script deve ser executado dentro da pasta raiz do repositorio:
echo C:\Users\Fernando\Desktop\rh_imob_sucesso
echo.

if not exist "index.html" (
  echo [ERRO] Nao encontrei index.html nesta pasta.
  echo Abra o CMD na raiz correta do repositorio e rode novamente.
  pause
  exit /b 1
)

if not exist "vagas.html" (
  echo [ERRO] Nao encontrei vagas.html nesta pasta.
  echo Abra o CMD na raiz correta do repositorio e rode novamente.
  pause
  exit /b 1
)

set "SRC=%~dp0ARQUIVOS_ATUALIZAR"

if not exist "%SRC%\script.js" (
  echo [ERRO] Nao encontrei a pasta ARQUIVOS_ATUALIZAR ao lado deste CMD.
  echo Extraia o ZIP inteiro antes de executar.
  pause
  exit /b 1
)

echo Copiando arquivos atualizados...
copy /Y "%SRC%\script.js" "script.js" >nul
copy /Y "%SRC%\vercel.json" "vercel.json" >nul
copy /Y "%SRC%\ANOTACOES_ATUALIZACAO_GITHUB.txt" "ANOTACOES_ATUALIZACAO_GITHUB.txt" >nul

echo Removendo funcao antiga que nao sera mais usada...
if exist "api\vaga-preview.js" del /F /Q "api\vaga-preview.js"
if exist "api" (
  dir /b "api" | findstr . >nul
  if errorlevel 1 rmdir "api"
)

echo.
echo Status antes do commit:
git status

echo.
echo Criando commit...
git add .
git commit -m "Simplifica compartilhamento direto das vagas"

echo.
echo Enviando para o GitHub...
git pull --rebase origin main
if errorlevel 1 (
  echo.
  echo [ATENCAO] O pull/rebase encontrou conflito.
  echo Pare aqui e envie o print para o ChatGPT.
  pause
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo.
  echo [ATENCAO] O push falhou. Envie o print para o ChatGPT.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo CONCLUIDO
echo ============================================================
echo Agora confira na Vercel se o Root Directory esta vazio/default.
echo Depois teste: https://www.rhimob.com.br/vagas.html
echo.
git status
pause
exit /b 0
