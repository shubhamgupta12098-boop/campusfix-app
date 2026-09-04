import { existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const androidDir = join(root, 'android-app');

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    join(homedir(), 'Library', 'Android', 'sdk'),
    join(homedir(), 'Android', 'Sdk'),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

const sdk = findSdk();
if (!sdk) {
  console.error('\nAndroid SDK nahi mila. Android Studio me SDK install karke phir npm run android:apk chalayein.\n');
  process.exit(1);
}

writeFileSync(join(androidDir, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
process.env.ANDROID_HOME = sdk;
process.env.ANDROID_SDK_ROOT = sdk;

const isWin = process.platform === 'win32';
const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
console.log(`Android SDK: ${sdk}`);
console.log('Building CampusFix APK with mobile CSV/PDF export fix...\n');

const result = spawnSync(gradleCmd, ['clean', 'assembleDebug'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWin,
  env: process.env,
});
if (result.error) {
  console.error(`\nGradle start nahi hua: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
console.log('\nAPK READY:');
console.log(apk);
