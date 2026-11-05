@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  run-backend-win10-11.bat  - Backend QueueRite (Windows 10/11)
rem  DEMARGE UNIQUEMENT les services : MongoDB + backend (port 3000,
rem  reseau), SANS installer de dependance.
rem  Prerequis : dependances deja installees (deploy-backend-win10-11.bat).
rem
rem  Usage : run-backend-win10-11.bat
rem =====================================================================
set "ROOT=%~dp0"
set "MONGO_SERVICE=MongoDBQueue"
set "PORT=3000"

echo.
echo ===== Run Backend QueueRite - Windows 10/11  (demarrage seul) =====
echo.

rem --------------- 1. MongoDB ----------------
echo [1/3] MongoDB (service %MONGO_SERVICE%)...
sc query %MONGO_SERVICE% | find /i "RUNNING" >nul 2>&1
if errorlevel 1 (
    net start %MONGO_SERVICE% >nul 2>&1 && echo   OK demarre. || echo   [ERREUR] service non demarrable (deploy/install requis).
) else (
    echo   OK deja actif.
)

rem --------------- 2. Backend ----------------
echo [2/3] Backend sur le port %PORT% (reseau)...
call :is_up %PORT%
if "!UP!"=="1" (
    echo   OK deja actif.
) else (
    if not exist "%ROOT%dist\main.js" (
        echo   [ERREUR] dist\main.js absent. Lancez deploy-backend-win10-11.bat.
        pause
        exit /b 1
    )
    netsh advfirewall firewall add rule name="QueueRite-Backend" dir=in action=allow protocol=TCP localport=%PORT% >nul 2>&1
    start "QueueRite Backend" /D "%ROOT%" cmd /k "node dist\main.js"
    echo   OK backend lance.
)

rem --------------- 3. Attente ----------------
echo [3/3] Attente du port %PORT%...
call :wait_port %PORT%

echo.
echo Backend pret : http://localhost:%PORT%  ^(reseau : http://IP:%PORT%^)
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