@echo off
setlocal
set GRADLE_VERSION=8.9
set CACHE_DIR=%USERPROFILE%\.gradle\ccmms-bootstrap
set GRADLE_HOME=%CACHE_DIR%\gradle-%GRADLE_VERSION%
set ZIP=%CACHE_DIR%\gradle-%GRADLE_VERSION%-bin.zip

if exist "%GRADLE_HOME%\bin\gradle.bat" goto run

if not exist "%CACHE_DIR%" mkdir "%CACHE_DIR%"
echo Downloading Gradle %GRADLE_VERSION%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip' -OutFile '%ZIP%'; Expand-Archive -Path '%ZIP%' -DestinationPath '%CACHE_DIR%' -Force"
if errorlevel 1 (
  echo Gradle download failed. Android Studio me android-app folder open karke Sync karein.
  exit /b 1
)

:run
call "%GRADLE_HOME%\bin\gradle.bat" %*
exit /b %ERRORLEVEL%
