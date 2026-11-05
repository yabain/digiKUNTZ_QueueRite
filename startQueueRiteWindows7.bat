@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  startQueueRiteWindows7.bat
rem  Script de DEMARRAGE QUOTIDIEN de la borne Queue Rite (Windows 7).
rem
rem  Il demarre, dans l'ordre, uniquement ce qui ne tourne pas encore :
rem   1. MongoDB (service MongoDBQueue)  [base de donnees]
rem   2. Backend  (node dist\main.js)    [port 3000, accessible reseau]
rem   3. Frontend (serveurs statique SPA du build dist) [port 4200, reseau]
rem   4. Attend que les ports 3000 et 4200 repondent
rem   5. Ouvre Chrome en Kiosk (`--kiosk --kiosk-printing`) sur
rem      http://localhost:4200  => impression SILENCIEUSE sur la POS58
rem      (il faut que la POS58 soit l'imprimante par defaut de Windows).
rem
rem  L'URL d'entree est la page d'accueil : on y choisit le POS a ouvrir.
rem =====================================================================

rem  ---- Chemins derives de l'emplacement de ce script (racine Queue_Rite) ----
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%Queue_App_Backend_v1.0"
set "FRONTEND_DIR=%SCRIPT_DIR%Queue_App_Frontend_Angular17_v1.0"
set "MONGO_SERVICE=MongoDBQueue"

rem  ---- Ports ----
set "BACKEND_PORT=3000"
set "FRONTEND_PORT=4200"
set "URL=http://localhost:%FRONTEND_PORT%"

rem  ---- Chrome Windows 7 ----
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Users\%USERNAME%\AppData\Local\Google\Chrome\Application\chrome.exe"

echo.
echo ============================================================
echo  Queue Rite - Demarrage Windows 7
echo ============================================================
echo.

rem ------------------- 1. MongoDB -------------------
echo [1/5] Demarrage de MongoDB...
sc query %MONGO_SERVICE% | find /i "RUNNING" >nul 2>&1
if errorlevel 1 (
    net start %MONGO_SERVICE% >nul 2>&1
    if errorlevel 1 (
        echo   [ERREUR] Service %MONGO_SERVICE% impossible a demarrer.
        echo   Verifiez que windows7Deployment.bat a ete execute (service MongoDBQueue).
    ) else (
        echo   [OK] MongoDB demarre.
    )
) else (
    echo   [OK] MongoDB deja actif.
)

rem ------------------- 2. Backend -------------------
echo [2/5] Demarrage du backend (port %BACKEND_PORT%, reseau)...
call :is_port_up %BACKEND_PORT%
if "%PORTUP%"=="1" (
    echo   [OK] Backend deja actif sur le port %BACKEND_PORT%.
) else (
    if not exist "%BACKEND_DIR%\dist\main.js" (
        echo   [ERREUR] dist\main.js absent. Build requis (windows7Deployment.bat).
    ) else (
        start "QueueRite Backend" /D "%BACKEND_DIR%" cmd /k "node dist\main.js"
        netsh advfirewall firewall add rule name="QueueRite-Backend" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1
        echo   [OK] Backend lance.
    )
)

rem ------------------- 3. Frontend -------------------
echo [3/5] Demarrage du frontend (port %FRONTEND_PORT%, reseau)...
call :is_port_up %FRONTEND_PORT%
if "%PORTUP%"=="1" (
    echo   [OK] Frontend deja actif sur le port %FRONTEND_PORT%.
) else (
    if not exist "%FRONTEND_DIR%\dist\queue-web\browser" (
        echo   [ERREUR] Dossier dist absent dans le frontend.
        echo   Le build est necessaire (voir windows7Deployment.bat pas a pas).
    ) else (
        start "QueueRite Frontend" /D "%FRONTEND_DIR%" cmd /k "npx --yes serve@14 -s -l tcp://0.0.0.0:%FRONTEND_PORT% dist\queue-web\browser"
        netsh advfirewall firewall add rule name="QueueRite-Frontend" dir=in action=allow protocol=TCP localport=%FRONTEND_PORT% >nul 2>&1
        echo   [OK] Frontend lance.
    )
)

rem ------------------- 4. Attente des ports -------------------
echo [4/5] Attente que les services repondent...
call :wait_port %BACKEND_PORT%
call :wait_port %FRONTEND_PORT%

rem ------------------- 5. Chrome Kiosk -------------------
echo [5/5] Ouverture de Chrome en Kiosk (impression silencieuse)...
if not exist "%CHROME%" (
    echo   [ERREUR] Chrome introuvable. Verifiez CHROME dans ce script.
    pause
    exit /b 1
)
start "" "%CHROME%" --kiosk --kiosk-printing "%URL%"

echo.
echo ============================================================
echo  Termine. Bronze ouverte sur %URL%
echo  - Reseau : backend http://IP:%BACKEND_PORT% , frontend http://IP:%FRONTEND_PORT%
echo ============================================================
echo.
endlocal
exit /b 0

:: =====================================================================
::  SOUS-PROGRAMMES
:: =====================================================================
:is_port_up
rem  %1 = port ; retourne PORTUP=1 si ouvert sur 127.0.0.1
set "PORTUP=0"
set "PORT=%~1"
powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',%PORT%);$c.Close();'UP'}catch{'DOWN'}" 2>nul | find "UP" >nul
if not errorlevel 1 set "PORTUP=1"
goto :eof

:wait_port
rem  %1 = port ; attend jusqu'a ~30s qu'il reponde
set "PORT=%~1"
for /l %%i in (1,1,30) do (
    powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',%PORT%);$c.Close();'UP'}catch{'DOWN'}" 2>nul | find "UP" >nul && goto :port_up
    timeout /t 1 /nobreak >nul
)
echo   [WARN] Port %PORT% non pret apres 30s.
goto :eof
:port_up
echo   [OK] Port %PORT% pret.
goto :eof