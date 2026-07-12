@echo off
setlocal
chcp 65001 >nul
set "ROOT=%~dp0"
set "SQL_FILE=%ROOT%APLICAR_CORRECAO_ELEGIBILIDADE_INDICACAO_V117.sql"

if not exist "%SQL_FILE%" (
  echo ERRO: arquivo SQL nao encontrado.
  pause
  exit /b 1
)

echo Abrindo o SQL V117 e o Supabase SQL Editor...
start "" notepad "%SQL_FILE%"
start "" "https://supabase.com/dashboard/project/vywtzzrvpdjqpcnixskz/sql/new"

echo.
echo Copie TODO o conteudo do arquivo aberto, cole no SQL Editor e clique em RUN.
echo.
pause
endlocal
