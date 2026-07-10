@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
title WMCPLAYER - Configurar PIX e Edge Functions Supabase

set "PROJECT_REF=vywtzzrvpdjqpcnixskz"
set "ROOT_DIR=%~dp0"
set "SECRETS_FILE=%ROOT_DIR%SECRETS_SUPABASE_PIX.env"
set "SECRETS_MODEL=%ROOT_DIR%SECRETS_SUPABASE_PIX_MODELO.env"

echo.
echo ==========================================================
echo  WMCPLAYER - CONFIGURAR PIX / EDGE FUNCTIONS NO SUPABASE
echo ==========================================================
echo.
echo Projeto Supabase:
echo %PROJECT_REF%
echo.
echo Esta etapa corrige o erro:
echo Failed to send a request to the Edge Function
echo.

echo [1/7] Verificando Node / NPM / NPX...
where node
if errorlevel 1 (
    echo.
    echo ERRO: NODE nao encontrado.
    echo Instale o Node.js LTS e execute novamente:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm
if errorlevel 1 (
    echo.
    echo ERRO: NPM nao encontrado.
    echo Instale o Node.js LTS e execute novamente:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npx
if errorlevel 1 (
    echo.
    echo ERRO: NPX nao encontrado.
    echo Reinstale o Node.js LTS marcando a opcao npm.
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo.
echo [2/7] Verificando arquivo de secrets...
if not exist "%SECRETS_FILE%" (
    copy "%SECRETS_MODEL%" "%SECRETS_FILE%" >nul
    echo.
    echo Criei o arquivo:
    echo %SECRETS_FILE%
    echo.
    echo AGORA PARE AQUI.
    echo Abra esse arquivo no Bloco de Notas e preencha:
    echo - SUPABASE_SERVICE_ROLE_KEY
    echo - SUPABASE_SECRET_KEY
    echo - EFI_CLIENT_ID
    echo - EFI_CLIENT_SECRET
    echo - EFI_PIX_KEY
    echo - EFI_CERTIFICATE_BASE64
    echo.
    echo Depois salve o arquivo e rode este BAT novamente.
    echo.
    pause
    exit /b 0
)

findstr /C:"COLE_AQUI" "%SECRETS_FILE%" >nul
if not errorlevel 1 (
    echo.
    echo ERRO: O arquivo SECRETS_SUPABASE_PIX.env ainda tem campos COLE_AQUI.
    echo Abra o arquivo, preencha os dados reais, salve e rode novamente.
    echo.
    notepad "%SECRETS_FILE%"
    pause
    exit /b 1
)

echo.
echo [2.1/7] Conferindo certificado PIX Efi...
if exist "%ROOT_DIR%EFI_CERTIFICATE_BASE64.txt" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$root='%ROOT_DIR%'; $envFile='%SECRETS_FILE%'; $certFile=Join-Path $root 'EFI_CERTIFICATE_BASE64.txt'; $cert=(Get-Content -Raw -Encoding UTF8 $certFile) -replace '\\s',''; if($cert.Length -lt 1000){ Write-Host 'ERRO: EFI_CERTIFICATE_BASE64.txt parece incompleto.'; exit 20 }; try{ [Convert]::FromBase64String($cert) | Out-Null } catch { Write-Host 'ERRO: certificado Base64 invalido.'; exit 21 }; $txt=Get-Content -Raw -Encoding UTF8 $envFile; if($txt -match '(?m)^EFI_CERTIFICATE_BASE64='){ $txt=[regex]::Replace($txt,'(?m)^EFI_CERTIFICATE_BASE64=.*','EFI_CERTIFICATE_BASE64='+$cert) } else { $txt=$txt.TrimEnd()+[Environment]::NewLine+'EFI_CERTIFICATE_BASE64='+$cert+[Environment]::NewLine }; if($txt -match '(?m)^EFI_CERTIFICATE_BASE64_BACKUP='){ $txt=[regex]::Replace($txt,'(?m)^EFI_CERTIFICATE_BASE64_BACKUP=.*','EFI_CERTIFICATE_BASE64_BACKUP='+$cert) } else { $txt=$txt.TrimEnd()+[Environment]::NewLine+'EFI_CERTIFICATE_BASE64_BACKUP='+$cert+[Environment]::NewLine }; Set-Content -Encoding UTF8 -NoNewline -Path $envFile -Value $txt; Write-Host 'Certificado PIX conferido e sincronizado com o arquivo de secrets.'"
    if errorlevel 1 (
        echo.
        echo ERRO: Certificado PIX invalido ou incompleto.
        echo Nao vou enviar secrets para nao quebrar o PIX.
        echo.
        pause
        exit /b 1
    )
) else (
    echo AVISO: EFI_CERTIFICATE_BASE64.txt nao encontrado. Vou usar o certificado do SECRETS_SUPABASE_PIX.env.
)

cd /d "%ROOT_DIR%"
if errorlevel 1 (
    echo.
    echo ERRO: nao consegui entrar na pasta do projeto.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/7] Login no Supabase CLI...
echo Se pedir token, abra:
echo https://supabase.com/dashboard/account/tokens
echo crie/copiei o token e cole aqui.
echo.
call npx --yes supabase@latest login
if errorlevel 1 (
    echo.
    echo ERRO: Falha no login do Supabase CLI.
    echo.
    pause
    exit /b 1
)

echo.
echo [4/7] Enviando secrets para o Supabase...
call npx --yes supabase@latest secrets set --env-file "%SECRETS_FILE%" --project-ref "%PROJECT_REF%"
if errorlevel 1 (
    echo.
    echo ERRO: Falha ao enviar secrets.
    echo Confira se o token do Supabase tem acesso ao projeto.
    echo.
    pause
    exit /b 1
)

echo.
echo [5/7] Publicando Edge Functions no Supabase...
echo.

for %%F in (
    admin-create-user
    admin-manage-user
    credit-system
    expiry-reminder
    memory-game
    pix-efi
    push-notification
    send-notification
    sync-tv-guide
) do (
    echo ----------------------------------------------------------
    echo Publicando funcao: %%F
    echo ----------------------------------------------------------
    call npx --yes supabase@latest functions deploy %%F --project-ref "%PROJECT_REF%" --no-verify-jwt
    if errorlevel 1 (
        echo.
        echo ERRO: Falha ao publicar a funcao %%F
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [6/7] Conferindo lista de functions...
call npx --yes supabase@latest functions list --project-ref "%PROJECT_REF%"

echo.
echo [7/7] Finalizado.
echo.
echo ==========================================================
echo  PRONTO! FUNCOES DO PIX PUBLICADAS NO SUPABASE NOVO.
echo ==========================================================
echo.
echo Agora teste novamente no site:
echo https://wmcplayer-clientes-apk.pages.dev/dashboard
echo.
echo.
echo PASSO FINAL OBRIGATORIO PARA RECUPERAR PIX JA PAGO:
echo 1. Abra o painel Admin ^> TV
echo 2. Clique uma unica vez em Configurar/recuperar PIX
echo.
echo Se ainda der erro no PIX, veja o log:
echo Edge Functions ^> pix-efi ^> Logs
echo.
pause
exit /b 0
