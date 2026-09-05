@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "PROJECT_DIR=%~dp0android"

echo CCMMS android folder: %PROJECT_DIR%
echo Android Studio dhoondh rahe hain...

set "STUDIO_EXE="

if exist "%LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe" set "STUDIO_EXE=%LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe"
if exist "%PROGRAMFILES%\Android\Android Studio\bin\studio64.exe" set "STUDIO_EXE=%PROGRAMFILES%\Android\Android Studio\bin\studio64.exe"
if exist "%PROGRAMFILES(X86)%\Android\Android Studio\bin\studio64.exe" set "STUDIO_EXE=%PROGRAMFILES(X86)%\Android\Android Studio\bin\studio64.exe"
if exist "C:\Program Files\Android\Android Studio\bin\studio64.exe" set "STUDIO_EXE=C:\Program Files\Android\Android Studio\bin\studio64.exe"

if "%STUDIO_EXE%"=="" (
  echo.
  echo Android Studio install nahi mila in common locations me:
  echo   %LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe
  echo   %PROGRAMFILES%\Android\Android Studio\bin\studio64.exe
  echo.
  echo Is file ko Notepad me kholke STUDIO_EXE line me apna sahi path daal do,
  echo ya Android Studio khud open karke File - Open - "%PROJECT_DIR%" select kar lo.
  echo.
  pause
  exit /b 1
)

echo Mil gaya: %STUDIO_EXE%
echo Android Studio khol rahe hain 'android' project ke saath...
start "" "%STUDIO_EXE%" "%PROJECT_DIR%"

echo.
echo Android Studio khul raha hai. Gradle sync hone do (internet chahiye, Gradle 8.9
echo aur Android SDK 35 pehli baar download honge). JDK error aaye to Settings ^> Build
echo Tools ^> Gradle me Gradle JDK ko 17 set kar dena.
echo Sync hone ke baad: Build - Build Bundle(s)/APK(s) - Build APK(s).
echo APK milega: android\app\build\outputs\apk\debug\app-debug.apk
pause
