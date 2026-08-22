@echo off
title Freezer El Balad - Test Print
echo.
echo ========================================
echo   Freezer El Balad - Test Print
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo [SETUP] Installing dependencies...
    call npm install
)

:: Check if .env exists
if not exist ".env" (
    echo [ERROR] No .env file found!
    echo Please copy .env.example to .env and configure it.
    pause
    exit /b 1
)

:: Run test print
echo Sending test receipt to printer...
echo.
node index.js --test
echo.
echo Done!
pause
