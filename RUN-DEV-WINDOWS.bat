@echo off
setlocal
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
echo Start backend in this window: npm run dev:server
echo For Vite hot reload open separate terminals for:
echo   npm run dev:student
echo   npm run dev:admin
echo   npm run dev:staff
call npm run dev:server
