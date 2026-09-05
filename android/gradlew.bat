@echo off
setlocal
set "APP_HOME=%~dp0"
set "WRAPPER_JAR=%APP_HOME%gradle\wrapper\gradle-wrapper.jar"

if defined JAVA_HOME (
  set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
  if not exist "%JAVA_EXE%" (
    echo ERROR: JAVA_HOME points to an invalid Java installation: %JAVA_HOME%
    exit /b 1
  )
) else (
  set "JAVA_EXE=java.exe"
  where java.exe >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Java was not found. Install JDK 17+ or set JAVA_HOME.
    exit /b 1
  )
)

if not exist "%WRAPPER_JAR%" (
  echo ERROR: Missing %WRAPPER_JAR%
  exit /b 1
)

"%JAVA_EXE%" -classpath "%WRAPPER_JAR%" org.gradle.wrapper.GradleWrapperMain %*
exit /b %ERRORLEVEL%
