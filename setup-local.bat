@echo off
REM SITEMAP BUILDER - LOCAL SETUP SCRIPT (Windows)
REM Rulează asta ca să instalezi și să faci build

setlocal enabledelayedexpansion

cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║         SITEMAP BUILDER - LOCAL SETUP ^& BUILD (Windows)       ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM STEP 1: Check Node.js
echo 📋 STEP 1: Verificare Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js nu e instalat!
    echo    Descarcă de la: https://nodejs.org/ (LTS version)
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✅ Node.js: %NODE_VERSION%
echo ✅ npm: %NPM_VERSION%
echo.

REM STEP 2: Check package.json
echo 📦 STEP 2: Verificare package.json...
if not exist "package.json" (
    echo ❌ package.json nu găsit!
    echo    Asigură-te că rulezi din directorul corect
    pause
    exit /b 1
)
echo ✅ package.json găsit
echo.

REM STEP 3: Clean install
echo 🧹 STEP 3: Clean install...
if exist "node_modules" (
    echo    Ștergem node_modules...
    rmdir /s /q node_modules
)
if exist "package-lock.json" del package-lock.json
echo ✅ Curățire completă
echo.

REM STEP 4: Install dependencies
echo ⏳ STEP 4: Instalez dependențele (aceasta ia 2-5 minute)...
echo    React, Tailwind, lucide-react...
call npm install --legacy-peer-deps

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Eroare la instalare
    pause
    exit /b 1
)
echo ✅ Dependențele instalate cu succes
echo.

REM STEP 5: Build
echo 🏗️  STEP 5: Building pentru producție...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Eroare la build
    pause
    exit /b 1
)
echo ✅ Build completat cu succes
echo.

REM STEP 6: Final info
cls
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    ✅ SETUP COMPLET!                           ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo 📁 Folderul 'build/' conține fișierele gata pentru deploy
echo.
echo 🚀 OPȚIUNI DE DEPLOYMENT:
echo.
echo 1️⃣  VERCEL (Recomandată):
echo    npm install -g vercel
echo    vercel deploy
echo.
echo 2️⃣  NETLIFY:
echo    npm install -g netlify-cli
echo    netlify deploy --prod --dir=build
echo.
echo 3️⃣  GITHUB PAGES:
echo    npm run deploy
echo.
echo 4️⃣  SELF-HOSTED:
echo    Copiază folderul 'build/' pe server-ul tău
echo.
echo 5️⃣  TEST LOCAL:
echo    npm start
echo    (mergi pe http://localhost:3000)
echo.
echo ✨ Gata! Deploy-ul e ușor acum!
echo.
pause
