// Yayın APK'si kalıcı Bekofy anahtarıyla imzalanır: anahtar değişirse kullanıcının telefonundaki uygulama
// güncellenemez. Anahtar dosyası ve parolası depoda değil, ortam değişkenlerinden gelir (kökteki .env):
// BEKOFY_ANDROID_KEYSTORE, BEKOFY_ANDROID_KEYSTORE_PASSWORD, BEKOFY_ANDROID_KEY_ALIAS.
// Değişkenler yoksa (ör. başka bir makinede deneme derlemesi) hata ayıklama anahtarına düşer.

const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = 'BEKOFY_ANDROID_KEYSTORE';
const RELEASE_CONFIG = `
        release {
            if (System.getenv('${MARK}')) {
                storeFile file(System.getenv('${MARK}'))
                storePassword System.getenv('BEKOFY_ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('BEKOFY_ANDROID_KEY_ALIAS')
                keyPassword System.getenv('BEKOFY_ANDROID_KEYSTORE_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (c) => {
    let s = c.modResults.contents;
    if (s.includes(MARK)) return c;
    s = s.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_CONFIG}`);
    // buildTypes.release içindeki ilk "signingConfig signingConfigs.debug" satırı.
    s = s.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, `$1signingConfig System.getenv('${MARK}') ? signingConfigs.release : signingConfigs.debug`);
    c.modResults.contents = s;
    return c;
  });
};
