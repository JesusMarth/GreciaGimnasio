@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GymGrecia - Actualizar

REM ============================================================
REM  Actualiza GymGrecia a la ultima version publicada en GitHub
REM  usando GIT. Los datos del gimnasio (carpeta data\) NO se tocan.
REM
REM  Ademas, ANTES de actualizar, guarda una COPIA DE SEGURIDAD de
REM  toda la carpeta (incluida data\) en el Escritorio, marcada con
REM  la version antigua y la fecha. Asi siempre se puede volver atras.
REM
REM  Requisitos (los deja listos quien mantiene la app, UNA sola vez):
REM   1) Tener Git instalado:  https://git-scm.com/download/win
REM      (instalar con todas las opciones por defecto)
REM   2) Un fichero  update-token.txt  en esta misma carpeta, con un
REM      token de GitHub con permiso de LECTURA sobre el repositorio.
REM
REM  Antes se usaba la API "zipball" de GitHub; se cambio a git porque
REM  esa API devolvia 404 con tokens de "fine-grained" aunque el token
REM  fuese valido. Con git, el mismo token funciona.
REM ============================================================

set "REPO=JesusMarth/GreciaGimnasio"
set "BRANCH=main"
set "TOKENFILE=%~dp0update-token.txt"
set "TMPCLONE=%TEMP%\gymgrecia_clone"

echo.
echo   ===========================================
echo      GymGrecia - Actualizar
echo   ===========================================
echo.

REM --- 0a) Comprobar que Git esta instalado ---
where git >nul 2>nul
if errorlevel 1 (
  echo   FALTA Git en este equipo.
  echo.
  echo   Instalalo UNA sola vez desde:
  echo       https://git-scm.com/download/win
  echo   Acepta todas las opciones por defecto, cierra esta ventana
  echo   y vuelve a ejecutar  Actualizar.bat.
  echo.
  pause & exit /b 1
)

REM --- 0b) Comprobar el token ---
if not exist "%TOKENFILE%" (
  echo   FALTA el archivo  update-token.txt  en esta carpeta.
  echo.
  echo   Pide a quien mantiene la app el token de actualizacion y
  echo   guardalo en un archivo de texto llamado  update-token.txt
  echo   junto a este  Actualizar.bat.
  echo.
  pause & exit /b 1
)

echo   Esto hace 3 cosas, en este orden:
echo     1) Guarda una copia de seguridad de TODO (incluidos tus datos)
echo        en el Escritorio, con la version actual.
echo     2) Descarga la ultima version de la app.
echo     3) La instala SIN tocar tus datos (socios, pagos).
echo.
echo   IMPORTANTE: si tienes la app abierta (la ventana negra de
echo   GymGrecia), cierrala antes de continuar.
echo.
pause

REM --- Leer el token quitando espacios/saltos y BOM si los hubiera ---
set "TOKEN="
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "(Get-Content -Raw '%TOKENFILE%').Trim()"`) do set "TOKEN=%%t"
if not defined TOKEN (
  echo   ERROR: el archivo  update-token.txt  esta vacio.
  pause & exit /b 1
)

REM --- Limpiar restos de un intento anterior ---
if exist "%TMPCLONE%" rmdir /s /q "%TMPCLONE%"

echo.
echo   [1/6] Descargando la ultima version con Git...
set "GIT_TERMINAL_PROMPT=0"
git -c credential.helper= clone --depth 1 --single-branch --branch %BRANCH% "https://x-access-token:%TOKEN%@github.com/%REPO%.git" "%TMPCLONE%"
if errorlevel 1 (
  echo.
  echo   ERROR al descargar. Comprueba:
  echo     - que hay conexion a INTERNET,
  echo     - y que el token de  update-token.txt  sigue siendo valido
  echo       y con acceso de LECTURA al repositorio.
  echo   No se ha cambiado nada.
  if exist "%TMPCLONE%" rmdir /s /q "%TMPCLONE%"
  pause & exit /b 1
)

if not exist "%TMPCLONE%\package.json" (
  echo   ERROR: la descarga no es valida. No se ha cambiado nada.
  if exist "%TMPCLONE%" rmdir /s /q "%TMPCLONE%"
  pause & exit /b 1
)

REM ============================================================
REM  [2/6] COPIA DE SEGURIDAD de la carpeta actual en el Escritorio
REM  (incluye data\). Se omiten node_modules y dist porque son
REM  pesados y se regeneran solos al instalar. Si la copia falla,
REM  NO se actualiza nada.
REM ============================================================
echo   [2/6] Copia de seguridad de tu version actual en el Escritorio...

REM Version actual (la "antigua"), para nombrar la copia
set "OLDVER="
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "OLDVER=%%v"
if not defined OLDVER set "OLDVER=desconocida"

REM Ruta real del Escritorio (respeta OneDrive) y fecha-hora
set "DESKTOP="
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%d"
if not defined DESKTOP set "DESKTOP=%USERPROFILE%\Desktop"
set "STAMP="
for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HHmm'"`) do set "STAMP=%%s"

set "BACKUPDIR=%DESKTOP%\GymGrecia-backup-v%OLDVER%_%STAMP%"
echo         -^> %BACKUPDIR%
robocopy "%~dp0." "%BACKUPDIR%" /E /XD node_modules dist .git >nul
if %ERRORLEVEL% GEQ 8 (
  echo.
  echo   ERROR al crear la copia de seguridad en el Escritorio.
  echo   Por seguridad NO se ha actualizado nada. Comprueba que hay
  echo   espacio libre en el disco y vuelve a intentarlo.
  if exist "%TMPCLONE%" rmdir /s /q "%TMPCLONE%"
  pause & exit /b 1
)

echo   [3/6] Actualizando archivos (sin tocar tus datos)...
robocopy "%TMPCLONE%" "%~dp0." /E /XD data node_modules .git /XF Actualizar.bat update-token.txt >nul
if %ERRORLEVEL% GEQ 8 (
  echo   ERROR al copiar los archivos.
  echo   Tienes una copia intacta en:  %BACKUPDIR%
  if exist "%TMPCLONE%" rmdir /s /q "%TMPCLONE%"
  pause & exit /b 1
)

REM --- Forzar que la web se recompile con el codigo nuevo ---
if exist "dist" rmdir /s /q "dist"

echo   [4/6] Instalando dependencias (puede tardar la primera vez)...
call npm install
if errorlevel 1 (
  echo   ERROR al instalar dependencias.
  echo   Tienes una copia intacta en:  %BACKUPDIR%
  pause & exit /b 1
)

echo   [5/6] Preparando la aplicacion...
call npm run build
if errorlevel 1 (
  echo   ERROR al preparar la aplicacion.
  echo   Tienes una copia intacta en:  %BACKUPDIR%
  pause & exit /b 1
)

echo   [6/6] Limpiando temporales...
if exist "%TMPCLONE%" rmdir /s /q "%TMPCLONE%"

set "NEWVER="
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "NEWVER=%%v"

echo.
echo   ===========================================
echo      Actualizacion COMPLETA   -   version %NEWVER%
echo   ===========================================
echo.
echo   Copia de seguridad de la version anterior (v%OLDVER%) guardada en:
echo      %BACKUPDIR%
echo.
echo   Abre  GymGrecia.bat  para usar la aplicacion actualizada.
echo.
pause
