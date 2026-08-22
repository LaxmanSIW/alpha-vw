@echo off
setlocal enabledelayedexpansion

:: Set defaults
set BUILD=n
set DEPS=n
set PORT=3000
set ENV=d

:: Parse options
:parse_args
if "%1"=="" goto validate
if "%1"=="-h" goto help
if "%1"=="--help" goto help
if "%1"=="-b" (
    set BUILD=%2
    shift
    shift
    goto parse_args
)
if "%1"=="-d" (
    set DEPS=%2
    shift
    shift
    goto parse_args
)
if "%1"=="-p" (
    set PORT=%2
    shift
    shift
    goto parse_args
)
if "%1"=="-e" (
    set ENV=%2
    shift
    shift
    goto parse_args
)
echo [ERROR] Unknown option: %1
goto help

:help
echo =======================================================================
echo Alpha VW - Server Build and Dependency Setup Manager
echo =======================================================================
echo.
echo Usage: run.bat [options]
echo.
echo Options:
echo   -e p^|d      Environment mode (p = production, d = development, default: d)
echo   -b y^|n      Build the project (y = compile build, n = skip, default: n)
echo                * Note: Only applicable in development mode (-e d).
echo   -d y^|n      Install dependencies and push DB schema (y = setup, n = skip, default: n)
echo                * In production mode (-e p): Installs only native production packages.
echo                * In development mode (-e d): Installs all package.json packages.
echo   -p port     Port number to start the server on (default: 3000)
echo   -h          Show this help information window
echo.
echo Examples:
echo   run.bat -e p -d y -p 8080   (Production mode: Setup prod packages, skip build, run on 8080)
echo   run.bat -e d -d y -b y      (Development mode: Full setup, build, and run on 3000)
echo.
exit /b 0

:validate
:: Check Node.js installation
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not present in your environment PATH.
    echo Please install Node.js v18 or higher before continuing.
    exit /b 1
)

:: Check NPM installation
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] NPM is not installed or not present in your environment PATH.
    exit /b 1
)

:: Override build in production mode (since production builds are pre-compiled)
if /I "!ENV!"=="p" (
    set BUILD=n
)

echo.
echo =======================================================================
echo 🚀 STARTING ALPHA VW MANAGER UTILITY
echo =======================================================================
echo   * Environment            : !ENV! (p = production, d = development)
echo   * Build Project          : !BUILD!
echo   * Install Dependencies   : !DEPS!
echo   * Server Port            : !PORT!
echo =======================================================================
echo.

:: 1. Install dependencies and setup database if requested
if /I "!DEPS!"=="y" (
    if /I "!ENV!"=="p" (
        echo 📦 Installing native production-only external packages...
        call npm install --omit=dev sharp @prisma/client prisma
        if !ERRORLEVEL! neq 0 (
            echo [ERROR] npm install of production packages failed.
            exit /b !ERRORLEVEL!
        )
    ) else (
        echo 📦 Installing local project dev and production dependencies from package.json...
        set OLD_NODE_ENV=!NODE_ENV!
        set NODE_ENV=development
        call npm install
        set NODE_ENV=!OLD_NODE_ENV!
        if !ERRORLEVEL! neq 0 (
            echo [ERROR] npm install failed.
            exit /b !ERRORLEVEL!
        )
    )
    
    echo ⚙️ Generating Prisma client models...
    call npx prisma generate
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Prisma client model generation failed.
        exit /b !ERRORLEVEL!
    )
    
    echo 🗄️ Syncing SQLite database schema...
    call npx prisma db push --accept-data-loss
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Database schema sync push failed.
        exit /b !ERRORLEVEL!
    )
    echo [SUCCESS] Setup and dependency installation complete.
    echo.
)

:: 2. Start server based on environment configuration
if /I "!ENV!"=="p" (
    echo 🚀 Starting standalone production server on port !PORT!...
    set NODE_ENV=production
    set PORT=!PORT!
    call node .next\standalone\server.js
) else (
    if /I "!BUILD!"=="y" (
        echo 🗑️ Cleaning stale build cache .next...
        if exist .next (
            rmdir /s /q .next
        )
        echo 🏗️ Building Next.js project application for standalone production mode...
        call npx next build
        if !ERRORLEVEL! neq 0 (
            echo [ERROR] Next.js project build failed.
            exit /b !ERRORLEVEL!
        )
        
        echo 📂 Copying static assets for standalone server...
        if exist .next\standalone (
            xcopy /y /e /i /q .next\static .next\standalone\.next\static
            xcopy /y /e /i /q public .next\standalone\public
        )
        echo [SUCCESS] Production standalone build compiled successfully.
        echo.
        
        echo 🚀 Starting standalone production server on port !PORT!...
        set NODE_ENV=production
        set PORT=!PORT!
        call node .next\standalone\server.js
    ) else (
        echo 🚀 Starting Next.js development dev server on port !PORT!...
        call npx next dev -p !PORT!
    )
)
