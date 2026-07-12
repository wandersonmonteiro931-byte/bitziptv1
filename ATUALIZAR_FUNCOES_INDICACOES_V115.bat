@echo off
setlocal
cd /d "%~dp0"
where npx >nul 2>nul || (echo ERRO: Node/NPM nao encontrado.& pause & exit /b 1)
echo Publicando somente as funcoes alteradas da V115...
call npx supabase functions deploy pix-efi --project-ref vywtzzrvpdjqpcnixskz --no-verify-jwt
if errorlevel 1 goto :erro
call npx supabase functions deploy admin-manage-user --project-ref vywtzzrvpdjqpcnixskz --no-verify-jwt
if errorlevel 1 goto :erro
echo.
echo PRONTO! Funcoes V115 publicadas sem alterar secrets.
pause
exit /b 0
:erro
echo.
echo ERRO ao publicar. A sessao fixa da CLI precisa estar valida.
pause
exit /b 1
