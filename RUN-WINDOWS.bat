@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo CCMMS Full Stack - Student Admin Staff
echo MongoDB + API + Firebase Forgot Password
echo ==========================================
if not exist .env (
  echo.
  echo ERROR: .env file not found.
  echo Copy .env.example to .env and add MONGODB_URI, JWT_SECRET and FIREBASE_API_KEY.
  echo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
)
echo Building Student, Admin and Staff...
call npm run build
if errorlevel 1 goto :fail
echo Starting CCMMS on http://localhost:3000
call npm start
exit /b 0
:fail
echo.
echo Build/start failed. Check the error above.
pause
exit /b 1
