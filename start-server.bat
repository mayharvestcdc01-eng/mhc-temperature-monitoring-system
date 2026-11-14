@echo off
title MHC Hourly Temperature Monitoring System
cd /d "%~dp0"
echo Starting MHC Temperature Monitoring System...
echo.
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
echo Starting server...
npm start
pause
