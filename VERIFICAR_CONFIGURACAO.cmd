@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Verificando .env.local...
if not exist .env.local (
  echo ERRO: .env.local nao encontrado. Rode CONFIGURAR_SUPABASE.cmd primeiro.
  pause
  exit /b 1
)
findstr /b "CRM_SUPABASE_URL=" .env.local >nul && echo CRM_SUPABASE_URL: OK || echo CRM_SUPABASE_URL: AUSENTE
findstr /b "CRM_SUPABASE_SERVICE_ROLE_KEY=" .env.local >nul && echo CRM_SUPABASE_SERVICE_ROLE_KEY: OK || echo CRM_SUPABASE_SERVICE_ROLE_KEY: AUSENTE
findstr /b "CRM_PANEL_TOKEN=" .env.local >nul && echo CRM_PANEL_TOKEN: OK || echo CRM_PANEL_TOKEN: AUSENTE
findstr /b "CRM_LOCAL_BYPASS=SIM" .env.local >nul && echo CRM_LOCAL_BYPASS: OK || echo CRM_LOCAL_BYPASS: AUSENTE
pause
