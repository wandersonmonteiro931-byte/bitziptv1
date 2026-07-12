@echo off
setlocal EnableExtensions DisableDelayedExpansion
title WMCPLAYER - Abrir SQL indicacoes reais V114

set "SQL_FILE=%~dp0APLICAR_CORRECAO_COMPLETA_INDICACOES_V114.sql"
set "SQL_URL=https://supabase.com/dashboard/project/vywtzzrvpdjqpcnixskz/sql/new"

if not exist "%SQL_FILE%" (
  echo.
  echo ERRO: arquivo SQL nao encontrado:
  echo %SQL_FILE%
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================================
echo  WMCPLAYER - CORRECAO DE INDICACOES REAIS V114
echo ==========================================================
echo.
echo 1. O SQL Editor do Supabase sera aberto.
echo 2. O arquivo SQL sera aberto no Bloco de Notas.
echo 3. Copie TODO o conteudo do arquivo.
echo 4. Cole em uma NOVA consulta e clique em RUN.
echo.

start "" "%SQL_URL%"
start "" notepad.exe "%SQL_FILE%"

echo.
echo Depois que o SQL terminar sem erro, execute:
echo ATUALIZAR_FUNCAO_INDICACOES_V114.bat
echo.
pause
exit /b 0
