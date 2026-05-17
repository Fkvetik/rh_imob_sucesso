@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist .next rmdir /s /q .next
if not exist node_modules call npm install
call npm run build
pause
