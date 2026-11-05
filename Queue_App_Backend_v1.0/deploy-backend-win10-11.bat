@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  deploy-backend-win10-11.bat  - Backend QueueRite (Windows 10/11)
rem  DEPLOIE le backend puis le lance (port 3000, reseau).
rem   1. Genere le .env (si absent) cohérent avec MongoDB.
rem   2. Installe les dependances (npm install).
rem   3. Compile (npm run build).
rem   4. Demarre (run-backend-win10-11.bat).
rem
rem  Usage : deploy-backend-win10-11.bat
rem =====================================================================
set "ROOT=%~dp0"
set "PORT=3000"

echo.
echo ===== Deploy Backend QueueRite - Windows 10/11 =====
echo.

cd /d "%ROOT%"

rem --------------- 1. .env ----------------
echo [1/4] Verification du .env...
if not exist ".env" (
    echo   Generation du .env (CORS_ORIGINS=*)...
    echo CORS_ORIGINS=* > ".env"
    call :append_env_defaults
) else (
    echo   OK .env present.
)

rem --------------- 2. Dependances ----------------
echo [2/4] Installation des dependances...
call npm install
if errorlevel 1 exit /b 1

rem --------------- 3. Build ----------------
echo [3/4] Compilation backend...
call npm run build
if errorlevel 1 exit /b 1

rem --------------- 4. Demarrage ----------------
echo [4/4] Demarrage du backend...
call "%~dp0run-backend-win10-11.bat"

echo.
echo ============================================================
echo  Deploy termine. Backend demarre.
echo ============================================================
echo.
endlocal
exit /b 0

:append_env_defaults
>> ".env" echo NODE_ENV=production
>> ".env" echo PORT=%PORT%
>> ".env" echo MONGODB_URI=mongodb://queue_user:queue_secure_pass_2026@127.0.0.1:27017/queue_app?replicaSet=rs0^&authSource=queue_app
>> ".env" echo MEDIA_ROOT=./media
>> ".env" echo SESSION_TTL_HOURS=24
>> ".env" echo LOG_LEVEL=info
>> ".env" echo ADMIN_USERNAME=admin
>> ".env" echo ADMIN_PASSWORD=admin123
goto :eof