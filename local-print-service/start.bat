@echo off
title Freezer El Balad - Print Service
echo.
echo ========================================
echo   Freezer El Balad - Thermal Print Service
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo Download the LTS version and run the installer.
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo [SETUP] Installing dependencies (first time only)...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
    echo [SETUP] Dependencies installed successfully!
    echo.
)

:: Check if .env exists
if not exist ".env" (
    echo [SETUP] No configuration file found.
    echo.
    echo Please copy .env.example to .env and fill in your settings:
    echo   1. Copy .env.example to .env
    echo   2. Open .env in Notepad
    echo   3. Fill in your API_TOKEN and printer settings
    echo   4. Save the file
    echo.
    echo Opening .env.example for reference...
    notepad .env.example
    pause
    exit /b 1
)

:: Start the service
echo Starting print service...
echo (Press Ctrl+C to stop)
echo.
node index.js

pause
