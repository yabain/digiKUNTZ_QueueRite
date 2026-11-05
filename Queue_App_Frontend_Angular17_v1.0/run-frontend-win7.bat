@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  run-frontend-win7.bat  - Frontend QueueRite (Windows 7)
rem  DEMARGE UNIQUEMENT le frontend sur l'IP locale (0.0.0.0:4200),
rem  SANS installer de dependance, puis ouvre Chrome en Kiosk.
rem  Sert le build "dist" (statique, SPA). Prerequis : dist present.
rem
rem  Impression silencieuse : INCLUT --kiosk-printing.
rem =====================================================================
set "ROOT=%~dp0"
set "PORT=4200"
set "URL=http://localhost:%PORT%"

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Users\%USERNAME%\AppData\Local\Google\Chrome\Application\chrome.exe"

echo.
echo ===== Run Frontend QueueRite - Windows 7  (demarrage seul) =====
echo.

cd /d "%ROOT%"

if not exist "dist\queue-web\browser" (
    echo.
    echo   [ERREUR] Dossier "dist" absent dans %ROOT%.
    echo   Sous Windows 7 on ne compile pas Angular (Node 18+ requis).
    echo   - Option: deploy-frontend-win7.bat (guide) ou fournir un dist pre-build.
    echo.
    pause
    exit /b 1
)

echo [1/2] Demarrage du frontend (dist, 0.0.0.0:%PORT%)...
call :is_up %PORT%
if "!UP!"=="1" (
    echo   OK deja actif sur le port %PORT%.
) else (
    netsh advfirewall firewall add rule name="QueueRite-Frontend" dir=in action=allow protocol=TCP localport=%PORT% >nul 2>&1
    start "QueueRite Frontend" /D "%ROOT%" cmd /k "npx --yes serve@14 -s -l tcp://0.0.0.0:%PORT% dist\queue-web\browser"
    echo   OK frontend lance.
)

echo [2/2] Attente + ouverture Chrome Kiosk...
call :wait_port %PORT%
if not exist "%CHROME%" (
    echo   [ERREUR] Chrome introuvable.
    pause
    exit /b 1
)
start "" "%CHROME%" --kiosk --kiosk-printing "%URL%"

echo.
echo Frontend pret : %URL%  ^(reseau : http://IP:%PORT%^)
echo.
endlocal
exit /b 0

:is_up
set "UP=0"
powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',%PORT%);$c.Close();'UP'}catch{'DOWN'}" 2>nul | find "UP" >nul
if not errorlevel 1 set "UP=1"
goto :eof

:wait_port
for /l %%i in (1,1,30) do (
    powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',%PORT%);$c.Close();'UP'}catch{'DOWN'}" 2>nul | find "UP" >nul && goto :port_up
    timeout /t 1 /nobreak >nul
)
echo   [WARN] port %PORT% non pret apres 30s.
goto :eof
:port_up
echo   OK port %PORT% pret.
goto :eof