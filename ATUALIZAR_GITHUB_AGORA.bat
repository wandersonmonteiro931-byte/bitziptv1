@echo off
setlocal EnableExtensions EnableDelayedExpansion
title WMCPLAYER - ATUALIZAR GITHUB E REDIRECIONAMENTO

set "REPO_URL=https://github.com/wandersonmonteiro931-byte/bitziptv1.git"
set "BRANCH=main"
set "COMMIT_MSG=WMCPLAYER V105 redirecionamento automatico do dominio antigo"

for %%I in ("%~dp0.") do set "SOURCE_DIR=%%~fI"
for %%I in ("%USERPROFILE%\Desktop\bitziptv1-github") do set "WORK_DIR=%%~fI"

echo.
echo ==========================================================
echo  WMCPLAYER - ATUALIZANDO GITHUB
echo ==========================================================
echo.
echo Origem: %SOURCE_DIR%
echo Repositorio local: %WORK_DIR%
echo Destino: %REPO_URL%
echo Branch: %BRANCH%
echo.

echo [1/8] Verificando Git...
where git >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERRO: Git nao encontrado.
    echo Instale o Git para Windows e execute este BAT novamente.
    echo https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo [2/8] Preparando repositorio local...
if not exist "%WORK_DIR%\.git" (
    if exist "%WORK_DIR%" (
        echo A pasta existente nao e um repositorio Git valido.
        echo Renomeando a pasta antiga...
        ren "%WORK_DIR%" "bitziptv1-github-antigo-!RANDOM!"
    )
    git clone --progress "%REPO_URL%" "%WORK_DIR%"
    if errorlevel 1 (
        echo.
        echo ERRO: Nao foi possivel clonar o repositorio.
        echo Verifique a internet e o login do GitHub.
        echo.
        pause
        exit /b 1
    )
)

cd /d "%WORK_DIR%"
if errorlevel 1 (
    echo ERRO: Nao foi possivel abrir %WORK_DIR%.
    pause
    exit /b 1
)

echo [3/8] Atualizando a branch main...
git remote set-url origin "%REPO_URL%"
git fetch origin --progress
if errorlevel 1 (
    echo ERRO: Falha ao buscar atualizacoes no GitHub.
    pause
    exit /b 1
)

git checkout "%BRANCH%" >nul 2>nul
if errorlevel 1 (
    git checkout -B "%BRANCH%" "origin/%BRANCH%"
    if errorlevel 1 (
        echo ERRO: Nao foi possivel abrir a branch %BRANCH%.
        pause
        exit /b 1
    )
)

git reset --hard "origin/%BRANCH%"
if errorlevel 1 (
    echo ERRO: Nao foi possivel sincronizar com origin/%BRANCH%.
    pause
    exit /b 1
)

echo [4/8] Copiando o projeto completo V105...
robocopy "%SOURCE_DIR%" "%WORK_DIR%" /E /R:2 /W:1 /XD ".git" "node_modules" "dist" ".wrangler" ".vercel" ".netlify" /XF ".env" ".env.local" "SECRETS_SUPABASE_PIX.env" "EFI_CERTIFICATE_BASE64.txt" "SUPABASE_CLI_TOKEN.txt" "SUPABASE_CLI_TOKEN.env"
set "ROBO=!ERRORLEVEL!"
if !ROBO! GEQ 8 (
    echo.
    echo ERRO: Falha ao copiar os arquivos. Codigo ROBOCOPY: !ROBO!
    echo.
    pause
    exit /b 1
)

echo [5/8] Removendo segredos, builds antigos e icones antigos...
if exist ".env" del /f /q ".env"
if exist ".env.local" del /f /q ".env.local"
if exist "SECRETS_SUPABASE_PIX.env" del /f /q "SECRETS_SUPABASE_PIX.env"
if exist "SECRETS_SUPABASE_PIX_MODELO.env" del /f /q "SECRETS_SUPABASE_PIX_MODELO.env"
if exist "EFI_CERTIFICATE_BASE64.txt" del /f /q "EFI_CERTIFICATE_BASE64.txt"
if exist "SUPABASE_CLI_TOKEN.txt" del /f /q "SUPABASE_CLI_TOKEN.txt"
if exist "SUPABASE_CLI_TOKEN.env" del /f /q "SUPABASE_CLI_TOKEN.env"
if exist "dist" rmdir /s /q "dist"
if exist "public\wmcplayer-icon-192-v3.png" del /f /q "public\wmcplayer-icon-192-v3.png"
if exist "public\wmcplayer-icon-512-v3.png" del /f /q "public\wmcplayer-icon-512-v3.png"
if exist "public\wmcplayer-maskable-512-v3.png" del /f /q "public\wmcplayer-maskable-512-v3.png"
if exist "public\wmcplayer-apple-touch-v3.png" del /f /q "public\wmcplayer-apple-touch-v3.png"
if exist "public\wmcplayer-favicon-v3.ico" del /f /q "public\wmcplayer-favicon-v3.ico"
if exist "public\wmcplayer-share-20260710.png" del /f /q "public\wmcplayer-share-20260710.png"
if exist "public\pwa-192.png" del /f /q "public\pwa-192.png"
if exist "public\pwa-512.png" del /f /q "public\pwa-512.png"
if exist "public\pwa-maskable-512.png" del /f /q "public\pwa-maskable-512.png"
if exist "public\apple-touch-icon.png" del /f /q "public\apple-touch-icon.png"
if exist "public\favicon.ico" del /f /q "public\favicon.ico"

echo [6/8] Verificando alteracoes...
git status --short
set "HAS_CHANGES="
for /f "delims=" %%A in ('git status --porcelain') do set "HAS_CHANGES=1"
if not defined HAS_CHANGES (
    echo.
    echo Nenhuma alteracao encontrada. O GitHub ja esta atualizado.
    echo.
    pause
    exit /b 0
)

git config user.name >nul 2>nul
if errorlevel 1 git config user.name "Wanderson"
git config user.email >nul 2>nul
if errorlevel 1 git config user.email "wanderson@wmcplayer.local"

echo [7/8] Criando commit...
git add -A
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo ERRO: Nao foi possivel criar o commit.
    pause
    exit /b 1
)

echo [8/8] Enviando para o GitHub...
git push --progress origin "%BRANCH%"
if errorlevel 1 (
    echo.
    echo ERRO: Nao foi possivel enviar ao GitHub.
    echo Faca login no GitHub Desktop e execute este BAT novamente.
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo  PRONTO! GITHUB ATUALIZADO COM SUCESSO.
echo ==========================================================
echo.
echo O Cloudflare Pages iniciara o deployment automaticamente.
echo Dominio antigo: https://wmcplayer-clientes-apk.pages.dev/
echo Destino oficial: https://wmcplayer.pages.dev/aplicativo/
echo.
pause
exit /b 0
