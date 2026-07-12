@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
start "" "https://supabase.com/dashboard/project/vywtzzrvpdjqpcnixskz/sql/new"
start "" notepad.exe "%~dp0APLICAR_CORRECAO_INDICACOES_PREMIO_FATURA_V116.sql"
echo.
echo ==========================================================
echo  WMCPLAYER V116 - SQL DAS INDICACOES
echo ==========================================================
echo.
echo 1. Copie TODO o SQL aberto no Bloco de Notas.
echo 2. Cole em uma NOVA CONSULTA no SQL Editor do Supabase.
echo 3. Clique em RUN e aguarde concluir sem erro.
echo.
echo Este SQL tambem repara indicacoes que ficaram convertidas sem premio.
echo.
pause
