# CCMMS Android APK

This repository now contains a native Android WebView shell in `android-app/`.

## App URL

The APK opens:

`https://campusfix-app-x04t.onrender.com`

The URL is compiled into `BuildConfig.WEB_URL` from `android-app/app/build.gradle`.

## Windows / Android Studio

1. Install Android Studio and Android SDK 35.
2. Open the `android-app` folder in Android Studio.
3. Allow Gradle/SDK sync to finish.
4. Build > Build Bundle(s) / APK(s) > Build APK(s).

Or double-click `BUILD-ANDROID-APK.bat` from the repository root.

Debug APK output:

`android-app/app/build/outputs/apk/debug/app-debug.apk`

## GitHub automatic APK build

The workflow `.github/workflows/android-apk.yml` builds an installable debug APK whenever Android files are pushed to `main`, or when the workflow is manually run.

GitHub: Actions > Build Android APK > Run workflow. After completion, download the `CCMMS-CampusFix-APK` artifact.

## Render note

The Android app is a client for the Render website/API. If the Render service is down or returns HTTP 5xx, the Android app displays a Retry screen. The server must be healthy for login and API features to work.

## File uploads and downloads

The Android shell enables WebView file chooser, cookies/session storage, JavaScript, DOM storage and Android DownloadManager so complaint attachments and report downloads can work from the web UI.
