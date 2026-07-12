@echo off
setlocal EnableExtensions DisableDelayedExpansion
title WMCPLAYER - Atualizar funcao indicacoes V114

set "PROJECT_REF=vywtzzrvpdjqpcnixskz"
set "ROOT_DIR=%~dp0"

cd /d "%ROOT_DIR%"
if errorlevel 1 (
    echo.
    echo ERRO: nao consegui abrir a pasta do projeto.
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo  WMCPLAYER - PUBLICAR ADMIN-MANAGE-USER V114
echo ==========================================================
echo.
echo Este BAT nao altera, apaga ou reenvia secrets.
echo Ele reutiliza a sessao e o token fixo ja salvo na CLI.
echo.

where node >nul 2>&1
if errorlevel 1 goto NODE_ERRO
where npm >nul 2>&1
if errorlevel 1 goto NODE_ERRO
where npx >nul 2>&1
if errorlevel 1 goto NODE_ERRO

if not exist "%ROOT_DIR%supabase\functions\admin-manage-user\index.ts" (
    echo.
    echo ERRO: funcao admin-manage-user nao encontrada.
    echo.
    pause
    exit /b 1
)

echo [1/3] Verificando sessao existente do Supabase CLI...
call npx --yes supabase@latest projects list --output json >nul 2>&1
if not errorlevel 1 goto AUTH_OK

echo.
echo Nenhuma sessao valida foi encontrada.
echo O login automatico pelo navegador nao sera iniciado.
echo Use somente o token fixo WMCPLAYER ja existente.
echo.
set "SUPABASE_FIXED_TOKEN="
set /p "SUPABASE_FIXED_TOKEN=Cole o token fixo e pressione ENTER: "
if not defined SUPABASE_FIXED_TOKEN (
    echo.
    echo ERRO: nenhum token foi informado.
    echo Nenhum token novo foi criado.
    echo.
    pause
    exit /b 1
)

call npx --yes supabase@latest login --token "%SUPABASE_FIXED_TOKEN%"
set "SUPABASE_FIXED_TOKEN="
if errorlevel 1 (
    echo.
    echo ERRO: o token fixo nao foi aceito.
    echo.
    pause
    exit /b 1
)

:AUTH_OK
echo Sessao valida encontrada.

echo.
echo [2/3] Publicando somente admin-manage-user...
call npx --yes supabase@latest functions deploy admin-manage-user --project-ref "%PROJECT_REF%" --no-verify-jwt
if errorlevel 1 (
    echo.
    echo ERRO: falha ao publicar admin-manage-user.
    echo Nenhum secret foi modificado.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Conferindo funcoes publicadas...
call npx --yes supabase@latest functions list --project-ref "%PROJECT_REF%"
if errorlevel 1 (
    echo.
    echo AVISO: a funcao foi enviada, mas a lista final nao abriu.
)

echo.
echo ==========================================================
echo  PRONTO! FUNCAO DE INDICACOES V114 PUBLICADA.
echo ==========================================================
echo.
echo Nenhum secret foi alterado.
echo.
pause
exit /b 0

:NODE_ERRO
echo.
echo ERRO: Node.js, NPM ou NPX nao foi encontrado.
echo Instale o Node.js LTS e execute novamente.
echo.
pause
exit /b 1
