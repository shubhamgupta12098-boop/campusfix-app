# Mobile export share fix

APK export behavior:

- CSV export opens Android Share chooser directly (WhatsApp, Gmail, Drive, Files, etc.).
- PDF export renders the current report to a temporary PDF and opens Android Share chooser.
- Export files are created in the app cache, not permanently saved to Downloads first.
- `saveBase64()` and `printPage()` remain as backward-compatible aliases so the current Render deployment also works after rebuilding the APK.
- The injected WebView hook also intercepts legacy `blob:` downloads.

Rebuild APK:

```powershell
npm run android:apk
```
