@echo off
echo Installing JWT packages...
cd /d "%~dp0"
npm install jsonwebtoken uuid
echo.
echo Installation complete!
pause
