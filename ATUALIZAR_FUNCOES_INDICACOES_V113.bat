@echo off
setlocal EnableExtensions DisableDelayedExpansion
title WMCPLAYER - Atualizar funcoes de indicacoes

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
echo  WMCPLAYER - ATUALIZAR EDGE FUNCTIONS DAS INDICACOES
echo ==========================================================
echo.
echo Projeto Supabase: %PROJECT_REF%
echo.
echo Este BAT NAO altera, apaga ou reenvia secrets.
echo Ele reutiliza os secrets que ja estao salvos no Supabase.
echo Ele tambem reutiliza a sessao/token fixo ja salvo na CLI.
echo.

echo [1/5] Verificando Node, NPM e NPX...
where node
if errorlevel 1 goto NODE_ERRO
where npm
if errorlevel 1 goto NODE_ERRO
where npx
if errorlevel 1 goto NODE_ERRO

echo.
echo [2/5] Verificando a sessao existente do Supabase CLI...
call npx --yes supabase@latest projects list --output json >nul 2>&1
if not errorlevel 1 goto AUTH_OK

echo.
echo Nenhuma sessao valida foi encontrada neste computador.
echo O login automatico pelo navegador nao sera iniciado.
echo Use somente o token fixo WMCPLAYER que voce ja mantem salvo.
echo.
set "SUPABASE_FIXED_TOKEN="
set /p "SUPABASE_FIXED_TOKEN=Cole o token fixo do Supabase e pressione ENTER: "
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
    echo Confira se ele pertence a conta correta e tente novamente.
    echo.
    pause
    exit /b 1
)

call npx --yes supabase@latest projects list --output json >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: a sessao foi salva, mas nao conseguiu acessar o projeto.
    echo.
    pause
    exit /b 1
)

:AUTH_OK
echo Sessao valida encontrada. Reutilizando o mesmo token salvo.

echo.
echo [3/5] Conferindo as funcoes desta atualizacao...
for %%F in (admin-create-user admin-manage-user pix-efi) do (
    if not exist "%ROOT_DIR%supabase\functions\%%F\index.ts" (
        echo.
        echo ERRO: arquivo ausente: supabase\functions\%%F\index.ts
        echo.
        pause
        exit /b 1
    )
)
echo Arquivos encontrados.

echo.
echo [4/5] Publicando somente as funcoes alteradas...
for %%F in (admin-create-user admin-manage-user pix-efi) do (
    echo.
    echo ----------------------------------------------------------
    echo Publicando funcao: %%F
    echo ----------------------------------------------------------
    call npx --yes supabase@latest functions deploy %%F --project-ref "%PROJECT_REF%" --no-verify-jwt
    if errorlevel 1 (
        echo.
        echo ERRO: falha ao publicar a funcao %%F.
        echo Os secrets existentes no Supabase nao foram modificados.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [5/5] Conferindo as funcoes publicadas...
call npx --yes supabase@latest functions list --project-ref "%PROJECT_REF%"
if errorlevel 1 (
    echo.
    echo AVISO: as funcoes foram enviadas, mas a lista final nao abriu.
)

echo.
echo ==========================================================
echo  PRONTO! FUNCOES DAS INDICACOES ATUALIZADAS.
echo ==========================================================
echo.
echo Nenhum secret foi alterado.
echo Nenhum arquivo SECRETS_SUPABASE_PIX.env e necessario nesta atualizacao.
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
