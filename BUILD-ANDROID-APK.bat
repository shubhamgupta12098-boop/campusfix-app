@echo off
setlocal
cd /d "%~dp0android-app"

if "%ANDROID_HOME%"=="" if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if "%ANDROID_SDK_ROOT%"=="" if not "%ANDROID_HOME%"=="" set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

if "%ANDROID_HOME%"=="" (
  echo Android SDK path nahi mila.
  echo Android Studio install/open karke SDK install karein, phir ye file dobara chalayein.
  pause
  exit /b 1
)

if not exist local.properties (
  echo sdk.dir=%ANDROID_HOME:\=\\%>local.properties
)

call gradlew.bat clean assembleDebug
if errorlevel 1 (
  echo.
  echo APK build FAILED. Upar ka Gradle error check karein.
  pause
  exit /b 1
)

echo.
echo APK READY:
echo %CD%\app\build\outputs\apk\debug\app-debug.apk
start "" "%CD%\app\build\outputs\apk\debug"
pause
