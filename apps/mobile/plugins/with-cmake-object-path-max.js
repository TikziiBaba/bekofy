// Windows'ta yerel (C++) derleme 260 karakterlik yol sınırına takılır: CMake, node_modules içindeki kaynakların
// nesne dosyalarını tam yollarıyla adlandırır (ör. react-native-screens, reanimated). Bu üst sınır verilince sınırı
// aşacak adları kısa bir özetle değiştirir. Uygulamaya ve yerel kodlu tüm kütüphanelere uygulanır (yayın derlemesinde
// klasör adları daha uzun: RelWithDebInfo, arm64-v8a). android/ klasörü prebuild ile üretildiği için ayar buradan eklenir.

const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

const ARG = '-DCMAKE_OBJECT_PATH_MAX=259';

const LIBRARIES = `
// Bekofy: kütüphanelerin C++ derlemesinde de uzun nesne yollarını kısalt (Windows yol sınırı).
subprojects { sub ->
    sub.plugins.withId('com.android.library') {
        sub.android.defaultConfig.externalNativeBuild.cmake.arguments('${ARG}')
    }
}
`;

module.exports = function withCmakeObjectPathMax(config) {
  config = withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(ARG)) {
      c.modResults.contents = c.modResults.contents.replace(/defaultConfig\s*\{/, (m) => `${m}\n        externalNativeBuild { cmake { arguments "${ARG}" } }`);
      // Derleme klasörü android/app/.cxx yerine android/.c: yayın derlemesinde (RelWithDebInfo/arm64-v8a) özetlenmiş
      // nesne adının da sığması için gereken birkaç karakter buradan gelir.
      c.modResults.contents = c.modResults.contents.replace(/\nandroid\s*\{/, (m) => `${m}\n    externalNativeBuild { cmake { buildStagingDirectory = new File(rootDir, '.c') } }`);
    }
    return c;
  });
  return withProjectBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(ARG)) c.modResults.contents += LIBRARIES;
    return c;
  });
};
