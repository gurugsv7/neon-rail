@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist public\index.html call npm run build
node server.mjs --open
pause
