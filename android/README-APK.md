# CCMMS Android APK build

The `android/` folder is the native Android WebView wrapper for the deployed CCMMS Render app.
It loads:

`https://campusfix-app-x04t.onrender.com`

The URL is defined in `app/build.gradle` as `BuildConfig.WEB_APP_URL`.

## Requirements

- Android Studio with Android SDK Platform 35 installed
- JDK 17 or newer (JDK 17 is the safest choice for Android Gradle Plugin 8.7.3)
- Internet access on the first Gradle sync so the Gradle 8.9 distribution and Android plugin can be downloaded

## Android Studio build

1. Extract the project ZIP.
2. Open the **`android`** folder in Android Studio, not the repository root.
3. In **Settings > Build Tools > Gradle**, select JDK 17 if Gradle/JDK errors appear.
4. Let Gradle Sync finish.
5. Choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
6. Debug APK output: `app/build/outputs/apk/debug/app-debug.apk`.

## Terminal build

macOS/Linux:

```bash
cd android
./gradlew clean assembleDebug
```

Windows PowerShell / Command Prompt:

```bat
cd android
gradlew.bat clean assembleDebug
```

From the project root you can also run:

```bash
npm run apk:debug
```

## Release APK

Use Android Studio **Build > Generate Signed App Bundle / APK** and create/select a signing keystore. Do not commit a release keystore or its passwords to Git.

## Troubleshooting

- `JAVA_HOME` / Java error: use JDK 17 and make sure `java -version` works.
- `SDK location not found`: open the project in Android Studio or create `android/local.properties` containing your Android SDK path.
- Gradle distribution download error: check internet/firewall; the first build downloads Gradle 8.9.
- Android SDK 35 missing: install **Android 15 / API 35** from SDK Manager.

## Export / Send in APK

The WebView exposes the `CCMMSAndroid` bridge. Report **Export** uses Android's document save dialog and **Send** uses Android's native share sheet.
