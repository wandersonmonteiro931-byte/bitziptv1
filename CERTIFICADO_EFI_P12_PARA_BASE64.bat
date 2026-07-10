@echo off
chcp 65001 >nul
title Converter certificado Efi .p12 para Base64

echo.
echo ==========================================================
echo  CONVERTER CERTIFICADO EFI .P12 PARA BASE64
echo ==========================================================
echo.
echo Arraste o arquivo .p12 da Efi para esta janela e pressione ENTER.
echo Exemplo: C:\Users\wande\Downloads\certificado.p12
echo.
set /p CERT_PATH=Arquivo .p12: 

set "CERT_PATH=%CERT_PATH:"=%"

if not exist "%CERT_PATH%" (
    echo.
    echo ERRO: arquivo nao encontrado.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%CERT_PATH%'; $b=[Convert]::ToBase64String([IO.File]::ReadAllBytes($p)); Set-Content -Path 'EFI_CERTIFICATE_BASE64.txt' -Value $b -Encoding ascii; Set-Clipboard -Value $b"

if errorlevel 1 (
    echo.
    echo ERRO ao converter o certificado.
    echo.
    pause
    exit /b 1
)

echo.
echo PRONTO.
echo O Base64 foi salvo no arquivo:
echo EFI_CERTIFICATE_BASE64.txt
echo.
echo Tambem foi copiado para a area de transferencia.
echo Agora cole esse valor no arquivo:
echo SECRETS_SUPABASE_PIX.env
echo no campo:
echo EFI_CERTIFICATE_BASE64=
echo.
pause
exit /b 0
