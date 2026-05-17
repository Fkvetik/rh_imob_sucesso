@echo off
title RH IMOB CRM — Abrir Passos Manuais
color 0E

echo.
echo  Abrindo no navegador:
echo    1. Google Apps Script (para substituir os .gs e implantar)
echo    2. Supabase SQL Editor (para rodar o SQL se necessario)
echo    3. Vercel Dashboard (para conferir o deploy)
echo    4. Z-API Painel (para conferir webhooks)
echo.
echo  Pressione qualquer tecla para abrir...
pause > nul

start "" "https://script.google.com"
timeout /t 2 >nul
start "" "https://supabase.com/dashboard/project/hrsqxyisqinjuieigzvc/sql/new"
timeout /t 2 >nul
start "" "https://vercel.com/dashboard"
timeout /t 2 >nul
start "" "https://developer.z-api.io"

echo.
echo  Passos no Apps Script:
echo    1. Abra cada arquivo .gs da pasta apps_script/
echo    2. Copie o conteudo para o editor (substituindo o existente)
echo    3. Salve (Ctrl+S)
echo    4. Clique Implantar -^> Nova implantacao
echo    5. Tipo: App da Web / Executar como: Eu / Acesso: Qualquer pessoa
echo    6. Copie a URL gerada
echo    7. Cole em MINHAS_CONFIGURACOES.ini no campo APPS_SCRIPT_WEBAPP_URL
echo    8. Rode CONFIGURAR_TUDO.cmd novamente
echo.
pause
