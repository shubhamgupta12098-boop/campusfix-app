# CCMMS Android APK build

The `android/` folder is a native Android WebView wrapper for the deployed CCMMS Render app.
It keeps the existing Node/MongoDB backend and opens:

`https://campusfix-app-x04t.onrender.com`

The URL is set in `app/build.gradle` as `BuildConfig.WEB_APP_URL`.

## Android Studio

1. Install Android Studio and Android SDK Platform 35.
2. Open **this `android` folder** in Android Studio.
3. Let Gradle sync finish.
4. Select **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Debug APK output: `app/build/outputs/apk/debug/app-debug.apk`.

## Terminal

A Gradle 8.9 wrapper/bootstrap is included. Run:

```bash
./gradlew clean assembleDebug
```

On Windows:

```bat
gradlew.bat clean assembleDebug
```

## Release APK

Use Android Studio **Build > Generate Signed App Bundle / APK** and create/select your signing keystore. Never commit a real release keystore or its password to Git.

## Logo

The Android launcher icon and the web/PWA logo both use the supplied CCMMS logo.

## Export / Send inside APK

The web app detects the `CCMMSAndroid` bridge. Report **Export** opens Android's save-file dialog and **Send** opens Android's native share sheet, so these buttons continue to work in the APK WebView.
