@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GymGrecia - Actualizar

REM ============================================================
REM  Actualiza GymGrecia a la ultima version publicada en GitHub.
REM  Los datos del gimnasio (carpeta data\) NO se tocan.
REM
REM  Necesita, una sola vez, un fichero  update-token.txt  en esta
REM  misma carpeta con un token de GitHub de SOLO LECTURA. Lo coloca
REM  quien mantiene la app (ver CLAUDE.md, seccion "Versionado").
REM ============================================================

set "REPO=JesusMarth/GreciaGimnasio"
set "BRANCH=main"
set "TOKENFILE=%~dp0update-token.txt"
set "APIURL=https://api.github.com/repos/%REPO%/zipball/%BRANCH%"
set "TMPROOT=%TEMP%\gymgrecia_update"
set "TMPZIP=%TEMP%\gymgrecia_update.zip"

echo.
echo   ===========================================
echo      GymGrecia - Actualizar
echo   ===========================================
echo.

if not exist "%TOKENFILE%" (
  echo   FALTA el archivo  update-token.txt  en esta carpeta.
  echo.
  echo   Pide a quien mantiene la app el token de actualizacion y
  echo   guardalo en un archivo de texto llamado  update-token.txt
  echo   junto a este  Actualizar.bat.
  echo.
  pause & exit /b 1
)

echo   Esto descarga la ultima version y la instala.
echo   Tus datos (socios, pagos) NO se tocan.
echo.
echo   IMPORTANTE: si tienes la app abierta (la ventana negra de
echo   GymGrecia), cierrala antes de continuar.
echo.
pause

REM --- Limpiar restos de un intento anterior ---
if exist "%TMPROOT%" rmdir /s /q "%TMPROOT%"
if exist "%TMPZIP%" del /q "%TMPZIP%"

echo.
echo   [1/5] Descargando la ultima version...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $t=(Get-Content -Raw '%TOKENFILE%').Trim(); Invoke-WebRequest -UseBasicParsing -Uri '%APIURL%' -Headers @{ Authorization = 'Bearer ' + $t; 'User-Agent' = 'GymGrecia' } -OutFile '%TMPZIP%' } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo.
  echo   ERROR al descargar. Comprueba que hay INTERNET y que el token
  echo   sigue siendo valido. No se ha cambiado nada.
  pause & exit /b 1
)

echo   [2/5] Extrayendo...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { Expand-Archive -Path '%TMPZIP%' -DestinationPath '%TMPROOT%' -Force } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 ( echo   ERROR al extraer. No se ha cambiado nada. & pause & exit /b 1 )

REM --- Localizar la carpeta extraida (su nombre lo pone GitHub y varia) ---
set "INNER="
for /d %%d in ("%TMPROOT%\*") do set "INNER=%%d"
if not defined INNER ( echo   ERROR: la descarga vino vacia. No se ha cambiado nada. & pause & exit /b 1 )
if not exist "%INNER%\package.json" ( echo   ERROR: la descarga no es valida. No se ha cambiado nada. & pause & exit /b 1 )

echo   [3/5] Actualizando archivos (sin tocar tus datos)...
robocopy "%INNER%" "%~dp0." /E /XD data node_modules .git /XF Actualizar.bat update-token.txt >nul
if %ERRORLEVEL% GEQ 8 ( echo   ERROR al copiar los archivos. & pause & exit /b 1 )

REM --- Forzar que la web se recompile con el codigo nuevo ---
if exist "dist" rmdir /s /q "dist"

echo   [4/5] Instalando dependencias (puede tardar la primera vez)...
call npm install
if errorlevel 1 ( echo   ERROR al instalar dependencias. & pause & exit /b 1 )

echo   [5/5] Preparando la aplicacion...
call npm run build
if errorlevel 1 ( echo   ERROR al preparar la aplicacion. & pause & exit /b 1 )

REM --- Limpieza ---
if exist "%TMPROOT%" rmdir /s /q "%TMPROOT%"
if exist "%TMPZIP%" del /q "%TMPZIP%"

set "NEWVER="
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "NEWVER=%%v"

echo.
echo   ===========================================
echo      Actualizacion COMPLETA   -   version %NEWVER%
echo   ===========================================
echo.
echo   Abre  GymGrecia.bat  para usar la aplicacion actualizada.
echo.
pause
