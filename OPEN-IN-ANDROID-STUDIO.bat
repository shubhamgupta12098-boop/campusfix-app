@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "PROJECT_DIR=%~dp0android-app"

echo CCMMS android-app folder: %PROJECT_DIR%
echo Android Studio dhoondh rahe hain...

set "STUDIO_EXE="

if exist "%LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe" set "STUDIO_EXE=%LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe"
if exist "%PROGRAMFILES%\Android\Android Studio\bin\studio64.exe" set "STUDIO_EXE=%PROGRAMFILES%\Android\Android Studio\bin\studio64.exe"
if exist "%PROGRAMFILES(X86)%\Android\Android Studio\bin\studio64.exe" set "STUDIO_EXE=%PROGRAMFILES(X86)%\Android\Android Studio\bin\studio64.exe"
if exist "C:\Program Files\Android\Android Studio\bin\studio64.exe" set "STUDIO_EXE=C:\Program Files\Android\Android Studio\bin\studio64.exe"

if "%STUDIO_EXE%"=="" (
  echo.
  echo Android Studio install nahi mila in-in common locations me:
  echo   %LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe
  echo   %PROGRAMFILES%\Android\Android Studio\bin\studio64.exe
  echo.
  echo Agar Android Studio kisi custom location pe install hai, to is file ko
  echo Notepad me kholke upar STUDIO_EXE wali line me sahi path daal do.
  echo Ya phir Android Studio khud open karke File - Open - "%PROJECT_DIR%" select kar lo.
  echo.
  pause
  exit /b 1
)

echo Mil gaya: %STUDIO_EXE%
echo Android Studio khol rahe hain android-app project ke saath...
start "" "%STUDIO_EXE%" "%PROJECT_DIR%"

echo.
echo Android Studio khul raha hai. Gradle sync hone do (SDK/dependencies download honge,
echo internet chahiye). Sync complete hone ke baad: Build menu - Build Bundle(s)/APK(s) - Build APK(s).
echo APK yahan milega: android-app\app\build\outputs\apk\debug\app-debug.apk
pause
