@echo off
setlocal
cd /d "%~dp0"
start "" "https://supabase.com/dashboard/project/vywtzzrvpdjqpcnixskz/sql/new"
start "" notepad.exe "%~dp0APLICAR_CORRECAO_INDICACOES_PRAZO_REVERSAO_V115.sql"
echo.
echo Copie todo o SQL aberto no Bloco de Notas, cole no SQL Editor e clique em RUN.
pause
