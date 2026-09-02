# APK kaise banayein — Admin, Staff, Student (all 3)

Is sandbox mein Android SDK aur Gradle download ka network access nahi hai,
isliye final `.apk` yahan compile nahi ho saka. Teeno apps
(`admin/`, `staff/`, `student/`) ke andar Capacitor + Android project
pehle se taiyaar kar diya gaya hai.

Backend URL already set hai: `https://campusfix-app-x04t.onrender.com`

## Option A — Sabse aasaan: GitHub Actions (bina kisi install ke real APK)

1. Is poore folder ko ek naye **GitHub repo** mein push karo.
2. GitHub par jaate hi **Actions** tab mein `Build CampusFix APKs` workflow
   khud-ba-khud chalega (ya "Run workflow" button se manually chala do).
3. Workflow complete hone ke baad, us run ke niche **Artifacts** section
   mein 3 zip milenge:
   - `campusfix-admin-debug-apk`
   - `campusfix-staff-debug-apk`
   - `campusfix-student-debug-apk`
4. Har zip download karke andar se `app-debug.apk` nikal lo — ye seedha
   phone par install ho jayega.

Ye sabse simple tarika hai kyunki GitHub ke servers ke paas Android SDK/Gradle
download karne ka full internet access hai (humare sandbox ke paas nahi).

## Option B — Android Studio (local machine par)

1. `admin/android` folder ko Android Studio mein **Open** karo.
2. Gradle sync hone do (internet chahiye, pehli baar time lagega).
3. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. APK: `admin/android/app/build/outputs/apk/debug/app-debug.apk`

`staff/android` aur `student/android` ke liye repeat karo.

## Option C — Terminal (agar aapke laptop mein Android SDK installed hai)

```bash
cd admin/android && ./gradlew assembleDebug
cd ../../staff/android && ./gradlew assembleDebug
cd ../../student/android && ./gradlew assembleDebug
```

## Web app mein change ke baad APK update karna ho to

```bash
cd admin              # ya staff / student
npm install
npx vite build --base=./ --outDir=dist-capacitor
npx cap sync android
```

Phir dobara build karo (Option A/B/C mein se koi bhi).

## App IDs (package names)

| App     | Package name          |
|---------|------------------------|
| Admin   | com.campusfix.admin    |
| Staff   | com.campusfix.staff    |
| Student | com.campusfix.student  |
