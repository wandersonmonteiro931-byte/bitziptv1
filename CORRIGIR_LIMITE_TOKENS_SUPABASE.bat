@echo off
chcp 65001 >nul
setlocal EnableExtensions
title WMCPLAYER - Corrigir limite de tokens Supabase

echo.
echo ==========================================================
echo  WMCPLAYER - CORRIGIR LIMITE DE TOKENS DO SUPABASE
echo ==========================================================
echo.
echo O Supabase informou que sua conta atingiu o limite de 20 tokens.
echo.
echo Faca apenas uma vez:
echo 1. A pagina de tokens sera aberta agora.
echo 2. Exclua os tokens antigos de login da CLI que nao usa mais.
echo 3. Deixe ou crie somente um token chamado WMCPLAYER-CLI-FIXO.
echo 4. Copie esse token.
echo 5. Feche este arquivo e execute CONFIGURAR_PIX_E_FUNCOES_SUPABASE.bat.
echo 6. Cole o token fixo quando o arquivo pedir.
echo.
echo Depois disso, as proximas versoes reutilizarao o mesmo token.
echo Nao sera criado um token novo a cada atualizacao.
echo.
start "" "https://supabase.com/dashboard/account/tokens"
echo Pagina aberta no navegador.
echo.
pause
exit /b 0
