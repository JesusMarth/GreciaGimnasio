@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GymGrecia

echo.
echo   ===========================================
echo      GymGrecia - Gestion de socios y cuotas
echo   ===========================================
echo.

REM Primera vez: instala las dependencias.
if not exist "node_modules\" (
  echo   Instalando por primera vez, espera un momento...
  call npm install
  if errorlevel 1 ( echo   ERROR al instalar. & pause & exit /b 1 )
)

REM Primera vez o tras una actualizacion: compila la web.
if not exist "dist\index.html" (
  echo   Preparando la aplicacion...
  call npm run build
  if errorlevel 1 ( echo   ERROR al preparar. & pause & exit /b 1 )
)

echo   Abriendo GymGrecia en el navegador...
echo   (Deja esta ventana abierta mientras uses la aplicacion.)
echo.

call npm start

echo.
echo   GymGrecia se ha cerrado.
pause
