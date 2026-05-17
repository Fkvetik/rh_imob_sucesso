@echo off
chcp 65001 >nul
setlocal

echo ==============================================
echo RH IMOB CRM V16 - Aplicar visual em pasta atual
echo ==============================================
echo.
echo Este comando deve ser executado dentro da pasta V16 extraida.
echo Ele pede o caminho da sua pasta atual do CRM e copia apenas os arquivos visuais.
echo.
set /p DESTINO=Digite ou cole o caminho da pasta atual do CRM: 
if "%DESTINO%"=="" (
  echo Caminho vazio.
  pause
  exit /b 1
)
if not exist "%DESTINO%\app\crm" (
  echo Pasta de destino invalida. Nao encontrei app\crm.
  pause
  exit /b 1
)

copy /Y "app\crm\page.js" "%DESTINO%\app\crm\page.js" >nul
copy /Y "app\globals.css" "%DESTINO%\app\globals.css" >nul
if not exist "%DESTINO%\app\api\crm\agenda" mkdir "%DESTINO%\app\api\crm\agenda"
copy /Y "app\api\crm\agenda\route.js" "%DESTINO%\app\api\crm\agenda\route.js" >nul

echo.
echo Visual V16 aplicado com sucesso.
echo Agora feche o CMD antigo do Next.js e rode REINICIAR_LIMPO.cmd na pasta do CRM.
pause
