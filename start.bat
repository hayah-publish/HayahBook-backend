@echo off
title HayahBook Backend & ngrok Launcher
echo ==============================================
echo   Starting HayahBook Backend & ngrok Tunnel
echo ==============================================

:: 1. Start Backend in a new window
echo [1/2] Starting NestJS Backend Server...
start "HayahBook Backend" cmd /k "npm run start:dev"

:: Wait 4 seconds for NestJS to initialize
timeout /t 4 /nobreak >nul

:: 2. Stop any existing ngrok process and start a fresh one
echo [2/2] Starting ngrok Tunnel...
taskkill /f /im ngrok.exe >nul 2>&1
start "ngrok Tunnel" cmd /k "ngrok http 3000"

echo.
echo All services launched! Check the ngrok window for your public URL.
echo.
pause
