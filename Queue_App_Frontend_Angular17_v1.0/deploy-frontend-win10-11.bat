@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  deploy-frontend-win10-11.bat  - Frontend QueueRite (Windows 10/11)
rem  DEPLOIE le frontend, puis le lance (host 0.0.0.0 = IP locale).
rem  1. Verifie si Angular CLI est installe :
rem       - sinon  -> npm install -g @angular/cli (installation)
rem  2. Installe les dependances du projet (npm install).
rem  3. Lance le projet sur 0.0.0.0:4200 + ouvre Chrome en Kiosk.
rem
rem  Usage : deploy-frontend-win10-11.bat
rem =====================================================================
set "ROOT=%~dp0"
set "PORT=4200"
set "URL=http://localhost:%PORT%"

echo.
echo ===== Deploy Frontend QueueRite - Windows 10/11 =====
echo.

cd /d "%ROOT%"

rem -------- 1. Verifier / installer Angular CLI --------
echo [1/4] Verification d'Angular CLI...
if exist "node_modules\.bin\ng.cmd" (
    echo   OK Angular CLI present (local).
) else (
    call ng --version >nul 2>&1 && (
        echo   OK Angular CLI present (global).
    ) || (
        echo   Angular CLI introuvable -> installation globale...
        call npm install -g @angular/cli@^17
        if errorlevel 1 exit /b 1
        echo   OK Angular CLI installe.
    )
)

rem -------- 2. Dependances du projet --------
echo [2/4] Installation des dependances du projet...
call npm install
if errorlevel 1 exit /b 1

rem -------- 3/4 (delegue au script de demarrage) --------
rem        Le script run-frontend demarre le frontend puis ouvre Chrome.
echo [3/4] Demarrage du frontend...
call "%~dp0run-frontend-win10-11.bat"

echo.
echo ============================================================
echo  Deploy termine. Frontend demarre.
echo ============================================================
echo.
endlocal
exit /b 0