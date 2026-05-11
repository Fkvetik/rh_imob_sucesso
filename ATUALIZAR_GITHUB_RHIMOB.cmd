@echo off
setlocal EnableExtensions
chcp 65001 >nul

echo ============================================================
echo RH IMOB - Atualizar repositorio GitHub com site limpo
echo ============================================================
echo.

echo Este script vai LIMPAR a pasta do repositorio informado e copiar
echo somente os arquivos atuais do site que estao em ARQUIVOS_SITE.
echo.
echo IMPORTANTE: use em uma pasta que seja um clone Git local do seu repositorio.
echo O script preserva a pasta .git, mas remove arquivos antigos/duplicados.
echo.

set "SRC=%~dp0ARQUIVOS_SITE"
if not exist "%SRC%\index.html" (
  echo ERRO: nao encontrei a pasta ARQUIVOS_SITE com index.html.
  echo Mantenha este arquivo .cmd ao lado da pasta ARQUIVOS_SITE.
  pause
  exit /b 1
)

if "%~1"=="" (
  set /p "TARGET=Digite o caminho da pasta do repositorio GitHub local: "
) else (
  set "TARGET=%~1"
)

if not exist "%TARGET%" (
  echo ERRO: pasta de destino nao encontrada: %TARGET%
  pause
  exit /b 1
)

if not exist "%TARGET%\.git" (
  echo ERRO: a pasta informada nao parece ser um repositorio Git local.
  echo Pasta esperada com .git: %TARGET%
  echo.
  echo Baixe/cloque o repositorio primeiro, ou informe a pasta correta.
  pause
  exit /b 1
)

echo.
echo Origem:  %SRC%
echo Destino: %TARGET%
echo.
echo ATENCAO: arquivos antigos no destino que nao fazem parte do site limpo serao removidos.
choice /C SN /M "Deseja continuar"
if errorlevel 2 (
  echo Operacao cancelada.
  pause
  exit /b 0
)

echo.
echo Limpando e copiando arquivos atuais...
robocopy "%SRC%" "%TARGET%" /MIR /XD .git node_modules .vercel /XF .env .env.local /R:2 /W:2
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo.
  echo ERRO: Robocopy falhou com codigo %RC%.
  pause
  exit /b %RC%
)

echo.
echo Arquivos copiados com sucesso.
echo.
pushd "%TARGET%"

echo Status do Git:
git status --short

echo.
choice /C SN /M "Deseja fazer commit e push agora"
if errorlevel 2 (
  echo.
  echo OK. Revise os arquivos e depois rode manualmente:
  echo git add -A
  echo git commit -m "Atualiza site RH IMOB"
  echo git push
  popd
  pause
  exit /b 0
)

echo.
echo Fazendo commit e push...
git add -A
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "DATA=%%c-%%b-%%a"
for /f "tokens=1-2 delims=: " %%a in ("%time%") do set "HORA=%%a%%b"
git commit -m "Atualiza site RH IMOB limpo"
if errorlevel 1 (
  echo.
  echo Aviso: git commit nao criou commit. Pode ser que nao existam alteracoes.
)
git push
if errorlevel 1 (
  echo.
  echo ERRO: git push falhou. Verifique login/acesso ao GitHub.
  popd
  pause
  exit /b 1
)

popd

echo.
echo Concluido. Aguarde o deploy da Vercel e teste:
echo https://www.rhimob.com.br/vagas.html
echo https://www.rhimob.com.br/vaga/gerente-vendas-osasco
echo.
pause
