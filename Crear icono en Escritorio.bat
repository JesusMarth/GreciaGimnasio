@echo off
rem ============================================================
rem  Crea (o actualiza) el acceso directo "GymGrecia" en el
rem  Escritorio, con el icono GymGrecia.ico. Doble clic y listo.
rem  (Los .bat no admiten icono propio: se le pone al acceso directo.)
rem ============================================================
set "AQUI=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $lnk=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\GymGrecia.lnk'); $lnk.TargetPath='%AQUI%GymGrecia.bat'; $lnk.WorkingDirectory='%AQUI%'; $lnk.IconLocation='%AQUI%GymGrecia.ico,0'; $lnk.Description='GymGrecia - Gestion de socios'; $lnk.Save()"
if errorlevel 1 (
  echo Algo fallo creando el acceso directo. Hazlo a mano: clic derecho en GymGrecia.bat
  echo   -^> Enviar a -^> Escritorio, y en Propiedades -^> Cambiar icono elige GymGrecia.ico
) else (
  echo Listo: ya tienes "GymGrecia" en el Escritorio con su icono.
)
pause
