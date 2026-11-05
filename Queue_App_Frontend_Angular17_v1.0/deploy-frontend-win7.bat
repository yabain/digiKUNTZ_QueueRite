@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  deploy-frontend-win7.bat  - Frontend QueueRite (Windows 7)
rem  DEPLOIE le frontend puis le lance (0.0.0.0:4200 + Chrome Kiosk).
rem
rem  IMPORTANT Windows 7 :
rem   * Angular 17 exige Node >= 18, or Windows 7 plafonne a Node 16.
rem   * On ne peut donc NI installer Angular CLI, NI compiler le projet ici.
rem   * Il faut fournir un build "dist" pre-compile (fait sur une machine
rem     moderne : npm install + ng build --configuration production), puis
rem     copier le dossier "dist" a la racine de ce frontend.
rem
rem  Ce script verifie la presence de Angular CLI (non installe sous Win7 ->
rem  message explicite), verifie le "dist", puis demarre.
rem  Usage : deploy-frontend-win7.bat
rem =====================================================================
set "ROOT=%~dp0"

echo.
echo ===== Deploy Frontend QueueRite - Windows 7 =====
echo.

cd /d "%ROOT%"

rem -------- 1. Verifier Angular CLI (non disponible sous Win7) --------
echo [1/3] Verification d'Angular CLI...
if exist "node_modules\.bin\ng.cmd" (
    echo   OK Angular CLI present (local).
) else (
    call ng --version >nul 2>&1 && (
        echo   OK Angular CLI present (global).
    ) || (
        echo   Angular CLI non installe.
        echo   [NOTE] Impossible de l'installer sous Windows 7 (Node 16, Angular 17
        echo          exige Node 18+). Compilez sur une machine moderne et copiez dist.
    )
)

rem -------- 2. Presence du build dist --------
echo [2/3] Verification du build "dist"...
if not exist "dist\queue-web\browser" (
    echo.
    echo   [ERREUR] Dossier "dist" absent.
    echo   Depuis une machine moderne (Node 18+) :
    echo     npm install
    echo     ng build --configuration production
    echo   puis copiez le dossier "dist" ici.
    echo.
    pause
    exit /b 1
)
echo   OK dist present (build statique fourni).

rem -------- 3. Demarrage --------------------------------
echo [3/3] Demarrage du frontend...
call "%~dp0run-frontend-win7.bat"

echo.
echo ============================================================
echo  Deploy termine. Frontend demarre.
echo ============================================================
echo.
endlocal
exit /b 0