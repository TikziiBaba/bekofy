// Yayın APK'si: kökteki .env'den imza bilgisini okur (ekrana basmaz), telefonlar için (arm64 + arm32) derler,
// sonucu apps/mobile/dist/Bekofy-<sürüm>.apk olarak bırakır. Önce: npm run prebuild -w @bekofy/mobile
// Kullanım: node apps/mobile/scripts/apk.mjs

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(APP, '../..');
const env = Object.fromEntries(readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/).map((l) => l.match(/^(BEKOFY_ANDROID_[A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
if (!env.BEKOFY_ANDROID_KEYSTORE || !existsSync(env.BEKOFY_ANDROID_KEYSTORE)) throw new Error('Yayın anahtarı bulunamadı: .env içinde BEKOFY_ANDROID_KEYSTORE');
const version = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')).expo.version;

const gradlew = join(APP, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
execFileSync(gradlew, ['assembleRelease', '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a'], {
  cwd: join(APP, 'android'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    ...env,
    JAVA_HOME: process.env.JAVA_HOME ?? 'C:/Program Files/Android/Android Studio/jbr',
    // prebuild android/local.properties'i siler; SDK'yı Android Studio'nun varsayılan yerinden al.
    ANDROID_HOME: process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'Android/Sdk'),
  },
});

const out = join(APP, 'android/app/build/outputs/apk/release/app-release.apk');
mkdirSync(join(APP, 'dist'), { recursive: true });
const target = join(APP, 'dist', `Bekofy-${version}.apk`);
copyFileSync(out, target);
console.log(`\nAPK: ${target} (${(statSync(target).size / 1e6).toFixed(1)} MB)`);
