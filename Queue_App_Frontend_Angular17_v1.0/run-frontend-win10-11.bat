@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  run-frontend-win10-11.bat  - Frontend QueueRite (Windows 10/11)
rem  DEMARGE UNIQUEMENT le frontend sur l'IP locale (0.0.0.0:4200),
rem  SANS installer de dependance, puis ouvre Chrome en Kiosk.
rem  Prerequis : dependances deja installees (deploy-frontend-win10-11.bat).
rem
rem  Impression silencieuse : INCLUT --kiosk-printing -> Chrome imprime sur
rem  l'imprimante par defaut sans boite de dialogue.
rem =====================================================================
set "ROOT=%~dp0"
set "PORT=4200"
set "URL=http://localhost:%PORT%"

set "NG=%ROOT%node_modules\.bin\ng.cmd"

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Users\%USERNAME%\AppData\Local\Google\Chrome\Application\chrome.exe"

echo.
echo ===== Run Frontend QueueRite - Windows 10/11  (démarrage seul) =====
echo.

cd /d "%ROOT%"

echo [1/2] Demarrage du frontend sur 0.0.0.0:%PORT% (IP locale)...
call :is_up %PORT%
if "!UP!"=="1" (
    echo   OK deja actif sur le port %PORT%.
) else (
    if not exist "%NG%" (
        echo   [ERREUR] Angular CLI local introuvable.
        echo   Les dependances ne sont pas installees. Lancez deploy-frontend-win10-11.bat.
        pause
        exit /b 1
    )
    netsh advfirewall firewall add rule name="QueueRite-Frontend" dir=in action=allow protocol=TCP localport=%PORT% >nul 2>&1
    start "QueueRite Frontend" /D "%ROOT%" cmd /k ""%NG%" serve --host 0.0.0.0 --port %PORT%"
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