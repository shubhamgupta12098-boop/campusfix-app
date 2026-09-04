# CampusFix Android mobile export fix

This build adds native Android handling for report exports inside the WebView APK.

## What changed
- CSV exports are saved to `Downloads/CampusFix/` through an Android JavaScript bridge.
- Existing `blob:` downloads from the deployed site are intercepted and saved natively.
- `window.print()` is bridged to Android PrintManager, so **Export as PDF** opens Android's print screen where **Save as PDF** can be selected.
- Normal HTTP/HTTPS downloads use Android DownloadManager with the real filename.
- External web links open outside the app; the native bridge remains limited to the CampusFix Render host.

## Build on Windows
From the project root:

```powershell
npm run android:apk
```

APK output:

`android-app\app\build\outputs\apk\debug\app-debug.apk`

## Test
1. Install the newly rebuilt APK (version 1.1.0-debug).
2. Open Admin -> Reports.
3. Tap **Export as CSV**. Check `Downloads/CampusFix/`.
4. Tap **Export as PDF**. In Android's print UI choose **Save as PDF** and save it.

The React source was also updated so future Render deployments call the native bridge directly when opened inside the APK.
