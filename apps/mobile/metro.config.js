// Monorepo: Expo, kök node_modules'u kendisi tanır. Tek ek: React kopyası sabitlenir.
// React Native, React sürümünün kendi çizicisiyle birebir aynı olmasını ister (SDK 58: 19.3.0); web ve masaüstü
// kökte başka bir yama sürümü kullanır. Kökteki paketler (react-native, react-query...) "react" istediğinde de
// mobilin kendi kopyası verilir; böylece pakete tek React girer.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const PINNED = new Set(['react', 'react-dom']);
const fromProject = path.join(__dirname, 'package.json');
const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  if (PINNED.has(moduleName.split('/')[0])) return resolve({ ...context, originModulePath: fromProject }, moduleName, platform);
  return resolve(context, moduleName, platform);
};

module.exports = config;
