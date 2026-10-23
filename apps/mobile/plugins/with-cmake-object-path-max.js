// Windows'ta yerel (C++) derleme 260 karakterlik yol sınırına takılır: CMake, node_modules içindeki kaynakların
// nesne dosyalarını tam yollarıyla adlandırır (ör. react-native-screens). Bu üst sınır verilince sınırı aşacak adları
// kısa bir özetle değiştirir. android/ klasörü prebuild ile üretildiği için ayar buradan eklenir.

const { withAppBuildGradle } = require('expo/config-plugins');

const ARG = '-DCMAKE_OBJECT_PATH_MAX=259';

module.exports = function withCmakeObjectPathMax(config) {
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(ARG)) {
      c.modResults.contents = c.modResults.contents.replace(/defaultConfig\s*\{/, (m) => `${m}\n        externalNativeBuild { cmake { arguments "${ARG}" } }`);
    }
    return c;
  });
};
