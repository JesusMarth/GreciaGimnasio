@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GymGrecia (PRUEBAS / MOCK)

REM Entorno de PRUEBAS: datos de mentira en la carpeta "data-mock", puerto 4712.
REM NO toca tus datos reales (esos viven en "data" y los abre GymGrecia.bat).
set GYM_DATA_DIR=data-mock
set GYM_API_PORT=4712

echo.
echo   ===========================================
echo      GymGrecia - ENTORNO DE PRUEBAS (MOCK)
echo   ===========================================
echo   Datos de mentira (carpeta "data-mock"). No toca tus datos reales.
echo.

if not exist "node_modules\" (
  echo   Instalando por primera vez, espera un momento...
  call npm install
  if errorlevel 1 ( echo   ERROR al instalar. & pause & exit /b 1 )
)

if not exist "dist\index.html" (
  echo   Preparando la aplicacion...
  call npm run build
  if errorlevel 1 ( echo   ERROR al preparar. & pause & exit /b 1 )
)

echo   Generando datos de prueba (si hace falta)...
call npm run seed:mock
if errorlevel 1 ( echo   ERROR al generar los datos. & pause & exit /b 1 )

echo.
echo   Abriendo el entorno de PRUEBAS en el navegador...
echo   (Para empezar de cero con datos nuevos: cierra esto y borra la carpeta "data-mock".)
echo.

call npm start

echo.
echo   Entorno de PRUEBAS cerrado.
pause
