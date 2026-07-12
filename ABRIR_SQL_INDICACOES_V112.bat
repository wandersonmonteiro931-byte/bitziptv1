@echo off
chcp 65001 >nul
setlocal EnableExtensions
title WMCPLAYER V112 - Abrir SQL de Indicacoes Corrigido

set "ROOT_DIR=%~dp0"
set "SQL_FILE=%ROOT_DIR%APLICAR_CORRECAO_COMPLETA_INDICACOES_V112.sql"

if not exist "%SQL_FILE%" (
  echo ERRO: arquivo SQL corrigido nao encontrado.
  pause
  exit /b 1
)

echo Abrindo o SQL Editor do Supabase e o arquivo corrigido...
start "" "https://supabase.com/dashboard/project/vywtzzrvpdjqpcnixskz/sql/new"
start "" notepad "%SQL_FILE%"

echo.
echo 1. Copie TODO o conteudo do arquivo aberto no Bloco de Notas.
echo 2. Cole no SQL Editor do Supabase.
echo 3. Clique em RUN e aguarde concluir sem erro.
echo 4. Depois execute CONFIGURAR_PIX_E_FUNCOES_SUPABASE.bat.
echo.
pause
exit /b 0
