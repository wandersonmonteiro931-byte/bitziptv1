@echo off
setlocal EnableExtensions DisableDelayedExpansion
title WMCPLAYER V116 - Atualizar funcoes de indicacoes

set "PROJECT_REF=vywtzzrvpdjqpcnixskz"
set "ROOT_DIR=%~dp0"

cd /d "%ROOT_DIR%"
if errorlevel 1 goto PASTA_ERRO

echo.
echo ==========================================================
echo  WMCPLAYER V116 - PUBLICAR EDGE FUNCTIONS
echo ==========================================================
echo.
echo Este BAT nao altera, apaga ou reenvia secrets.
echo Ele reutiliza a sessao e o token fixo ja salvos na CLI.
echo Ele nunca abre login automatico pelo navegador.
echo.

where node >nul 2>nul
if errorlevel 1 goto NODE_ERRO
where npx >nul 2>nul
if errorlevel 1 goto NODE_ERRO

echo [1/4] Verificando a sessao existente do Supabase CLI...
call npx --yes supabase@latest projects list --output json >nul 2>&1
if errorlevel 1 goto AUTH_ERRO
echo Sessao valida encontrada.

echo.
echo [2/4] Conferindo os arquivos...
if not exist "%ROOT_DIR%supabase\functions\pix-efi\index.ts" goto ARQUIVO_ERRO
if not exist "%ROOT_DIR%supabase\functions\admin-manage-user\index.ts" goto ARQUIVO_ERRO
echo Arquivos encontrados.

echo.
echo [3/4] Publicando pix-efi...
call npx --yes supabase@latest functions deploy pix-efi --project-ref "%PROJECT_REF%" --no-verify-jwt
if errorlevel 1 goto DEPLOY_ERRO

echo.
echo Publicando admin-manage-user...
call npx --yes supabase@latest functions deploy admin-manage-user --project-ref "%PROJECT_REF%" --no-verify-jwt
if errorlevel 1 goto DEPLOY_ERRO

echo.
echo [4/4] Conferindo as funcoes publicadas...
call npx --yes supabase@latest functions list --project-ref "%PROJECT_REF%"

echo.
echo ==========================================================
echo  PRONTO! FUNCOES V116 PUBLICADAS.
echo ==========================================================
echo.
echo Nenhum secret foi alterado.
echo.
pause
exit /b 0

:AUTH_ERRO
echo.
echo ERRO: nao existe uma sessao valida salva na Supabase CLI.
echo O BAT nao abriu login automatico e nao criou token novo.
echo Reutilize o token fixo WMCPLAYER ja salvo neste computador.
echo.
pause
exit /b 1

:NODE_ERRO
echo.
echo ERRO: Node.js ou NPX nao foi encontrado.
echo.
pause
exit /b 1

:ARQUIVO_ERRO
echo.
echo ERRO: uma das Edge Functions da V116 nao foi encontrada.
echo.
pause
exit /b 1

:DEPLOY_ERRO
echo.
echo ERRO: falha ao publicar uma Edge Function.
echo Os secrets existentes nao foram modificados.
echo.
pause
exit /b 1

:PASTA_ERRO
echo.
echo ERRO: nao foi possivel abrir a pasta do projeto.
echo.
pause
exit /b 1
