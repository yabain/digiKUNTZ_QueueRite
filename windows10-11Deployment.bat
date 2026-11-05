@echo off
setlocal enabledelayedexpansion
rem =====================================================================
rem  windows10-11Deployment.bat
rem  Mise en route complete du projet Queue Rite sur **Windows 10 / 11**.
rem
rem  Etapes :
rem   1. Verifie les droits administrateur
rem   2. Installe Node.js 20 + CLI NestJS / Angular (si absents)
rem   3. Installe MongoDB 7 (si absent)
rem   4. Configure MongoDB : service "MongoDBQueue", replica set rs0,
rem      utilisateur queue_user / queue_secure_pass_2026 (db queue_app)
rem      -> correspond au MONGODB_URI du backend (.env)
rem   5. Installe les dependances backend, build, demarre le backend (port 3000)
rem   6. Installe les dependances frontend, demarre ng serve (0.0.0.0:4200)
rem
rem  Les ports 3000 et 4200 sont ouverts dans le pare-feu Windows
rem  pour rendre le backend et le frontend accessibles sur le reseau.
rem  >>> Revoir CORS_ORIGINS et l'adresse API si acces depuis d'autres PC.
rem =====================================================================

call :check_admin

rem =====================================================================
rem  CONFIGURATION - adapter si besoin
rem =====================================================================
rem  Chemins derives de l'emplacement de ce script (racine Queue_Rite).
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%Queue_App_Backend_v1.0"
set "FRONTEND_DIR=%SCRIPT_DIR%Queue_App_Frontend_Angular17_v1.0"

rem  Versions
set "NODE_VERSION=20.18.0"
set "NODE_URL=https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"

set "MONGO_VERSION=7.0.14"
set "MONGO_URL=https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14.msi"
set "MONGO_BIN=C:\Program Files\MongoDB\Server\%MONGO_VERSION%\bin"
set "MONGO_DATA=C:\mongodb-data"

rem  Identifiants DB (doivent matcher le .env du backend)
set "MONGO_USER=queue_user"
set "MONGO_PASS=queue_secure_pass_2026"
set "MONGO_DB=queue_app"
set "MONGO_REPL=rs0"

echo.
echo ============================================================
echo  Deploiement Queue Rite - Windows 10/11
echo  Backend : %BACKEND_DIR%
echo  Frontend: %FRONTEND_DIR%
echo  Mongo   : %MONGO_VERSION% (replSet %MONGO_REPL%)
echo ============================================================
echo.

call :install_node
call :install_clis
call :install_mongo
call :configure_mongo
call :deps_backend
call :start_backend
call :deps_frontend
call :start_frontend

echo.
echo ============================================================
echo  DEPLOIEMENT TERMINE.
echo  - Backend  : http://localhost:3000  (reseau : http://IP:3000)
echo  - Frontend : http://localhost:4200  (reseau : http://IP:4200)
echo  - Mongo    : service MongoDBQueue (replSet rs0)
echo ============================================================
echo.
pause
exit /b 0

:: =====================================================================
::  SOUS-PROGRAMMES
:: =====================================================================
:check_admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Ce script doit etre lance en tant qu'Administrateur.
    echo Clique droit sur le fichier -^> "Executer en tant qu'administrateur".
    echo.
    pause
    exit /b 1
)
goto :eof

:download
rem  %1 = url ; %2 = fichier de sortie
set "DL_URL=%~1"
set "DL_OUT=%~2"
echo     Telechargement : %DL_URL%
bitsadmin /transfer "dl_%~n2" /download /priority normal "%DL_URL%" "%DL_OUT%" >nul 2>&1
if exist "%DL_OUT%" goto :eof
curl -L -o "%DL_OUT%" "%DL_URL%" >nul 2>&1
if exist "%DL_OUT%" goto :eof
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%DL_URL%','%DL_OUT%')" >nul 2>&1
if not exist "%DL_OUT%" (
    echo [ERREUR] Echec du telechargement : %DL_URL%
    exit /b 1
)
goto :eof

:install_node
if exist "%NODE_EXE%" (
    echo [OK] Node.js deja installe.
    set "PATH=C:\Program Files\nodejs;%PATH%"
    goto :eof
)
set "NODE_MSI=%TEMP%\node-setup.msi"
call :download "%NODE_URL%" "%NODE_MSI%"
echo [..] Installation de Node.js %NODE_VERSION% (silencieuse)...
msiexec /i "%NODE_MSI%" /qn /norestart
set "PATH=C:\Program Files\nodejs;%PATH%"
if not exist "%NODE_EXE%" ( echo [ERREUR] Echec installation Node.js & exit /b 1 )
echo [OK] Node.js installe : 
call node --version
goto :eof

:install_clis
echo [..] Installation CLI NestJS et Angular (global)...
call npm install -g @nestjs/cli@^10 >nul 2>&1
call npm install -g @angular/cli@^17 >nul 2>&1
set "PATH=%APPDATA%\npm;%PATH%"
echo [OK] CLI installees.
goto :eof

:install_mongo
if exist "%MONGO_BIN%\mongod.exe" (
    echo [OK] MongoDB %MONGO_VERSION% deja installe.
    goto :eof
)
set "MONGO_MSI=%TEMP%\mongodb-setup.msi"
call :download "%MONGO_URL%" "%MONGO_MSI%"
echo [..] Installation de MongoDB %MONGO_VERSION% (silencieuse)...
msiexec /i "%MONGO_MSI%" /qn /norestart
if not exist "%MONGO_BIN%\mongod.exe" ( echo [ERREUR] Echec installation MongoDB & exit /b 1 )
echo [OK] MongoDB installe en %MONGO_BIN%
goto :eof

:configure_mongo
if exist "%MONGO_BIN%\mongosh.exe" (
    set "MONGO_SHELL=%MONGO_BIN%\mongosh.exe"
) else (
    set "MONGO_SHELL=%MONGO_BIN%\mongo.exe"
)
if not exist "%MONGO_DATA%\db" mkdir "%MONGO_DATA%\db"
if not exist "%MONGO_DATA%\log" mkdir "%MONGO_DATA%\log"

rem  Supprime le service par defaut cree par le MSI, puis cree le notre.
sc stop MongoDB >nul 2>&1
sc delete MongoDB >nul 2>&1

echo [..] Creation du service MongoDBQueue (replSet %MONGO_REPL%)...
"%MONGO_BIN%\mongod.exe" --dbpath "%MONGO_DATA%\db" --logpath "%MONGO_DATA%\log\mongod.log" --logappend --bind_ip 127.0.0.1 --port 27017 --replSet %MONGO_REPL% --install --serviceName "MongoDBQueue" --serviceDisplayName "MongoDB Queue" >nul 2>&1
if errorlevel 1 ( echo [ERREUR] Creation du service MongoDB & exit /b 1 )
net start MongoDBQueue >nul 2>&1
call :wait_mongo_primary

echo [..] Initialisation de la replica set %MONGO_REPL%...
call "%MONGO_SHELL%" --quiet --eval "rs.initiate({_id:'%MONGO_REPL%',members:[{_id:0,host:'127.0.0.1:27017'}]})" >nul 2>&1
call :wait_mongo_primary

echo [..] Creation de l'utilisateur %MONGO_USER%...
call "%MONGO_SHELL%" "mongodb://127.0.0.1:27017/%MONGO_DB%" --eval "db.createUser({user:'%MONGO_USER%',pwd:'%MONGO_PASS%',roles:[{role:'dbOwner',db:'%MONGO_DB%'}]})" >nul 2>&1
echo [OK] MongoDB configure (replSet %MONGO_REPL%, utilisateur %MONGO_USER%).
goto :eof

:wait_mongo_primary
setlocal EnableExtensions
for /l %%i in (1,1,30) do (
    call "%MONGO_SHELL%" --quiet --eval "db.runCommand({isMaster:1}).isWritablePrimary || db.runCommand({isMaster:1}).ismaster" 2>nul | findstr /r /c:"true" >nul && ( endlocal & goto :eof )
    timeout /t 2 /nobreak >nul
)
echo     [WARN] La replica set n'est pas PRIMARY apres ~60s, on continue.
endlocal
goto :eof

:deps_backend
cd /d "%BACKEND_DIR%"
if not exist package.json ( echo [ERREUR] BACKEND_DIR invalide : %BACKEND_DIR% & exit /b 1 )
if not exist .env ( call :create_backend_env )
echo [..] Installation des dependances backend...
call npm install
if errorlevel 1 ( echo [ERREUR] npm install backend & exit /b 1 )
echo [..] Build backend...
call npm run build
if errorlevel 1 ( echo [ERREUR] build backend & exit /b 1 )
echo [OK] Backend compile.
goto :eof

:create_backend_env
rem  Genere un .env coherent avec la config MongoDB creee par ce script.
(
echo NODE_ENV=production
echo PORT=3000
echo MONGODB_URI=mongodb://%MONGO_USER%:%MONGO_PASS%@127.0.0.1:27017/%MONGO_DB%?replicaSet=%MONGO_REPL%^&authSource=%MONGO_DB%
echo CORS_ORIGINS=*
echo MEDIA_ROOT=./media
echo SESSION_TTL_HOURS=24
echo LOG_LEVEL=info
echo ADMIN_USERNAME=admin
echo ADMIN_PASSWORD=admin123
) > ".env"
echo     [..] .env cree (backend). Prevoir CORS reseau si besoin.
goto :eof

:start_backend
cd /d "%BACKEND_DIR%"
netsh advfirewall firewall add rule name="QueueRite-Backend" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
echo [..] Demarrage du backend (reseau ok, port 3000)...
start "QueueRite Backend" /D "%BACKEND_DIR%" cmd /k "node dist\main.js"
echo [OK] Backend lance.
goto :eof

:deps_frontend
cd /d "%FRONTEND_DIR%"
if not exist package.json ( echo [ERREUR] FRONTEND_DIR invalide : %FRONTEND_DIR% & exit /b 1 )
echo [..] Installation des dependances frontend...
call npm install
if errorlevel 1 ( echo [ERREUR] npm install frontend & exit /b 1 )
echo [OK] Frontend dependances installees.
goto :eof

:start_frontend
cd /d "%FRONTEND_DIR%"
netsh advfirewall firewall add rule name="QueueRite-Frontend" dir=in action=allow protocol=TCP localport=4200 >nul 2>&1
echo [..] Demarrage du frontend Angular sur 0.0.0.0:4200...
start "QueueRite Frontend" /D "%FRONTEND_DIR%" cmd /k "ng serve --host 0.0.0.0 --port 4200"
echo [OK] Frontend lance.
goto :eof