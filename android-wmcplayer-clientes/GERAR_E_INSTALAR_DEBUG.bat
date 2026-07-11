@echo off
setlocal
cd /d "%~dp0"
call gradlew.bat clean :app:installDebug
if errorlevel 1 (
  echo.
  echo FALHA AO GERAR OU INSTALAR O APK.
  pause
  exit /b 1
)
echo.
echo APK GERADO E INSTALADO COM SUCESSO.
echo Arquivo: app\build\outputs\apk\debug\app-debug.apk
pause
endlocal
