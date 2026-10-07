// Community package name -> Vega port. Used by metro.config.js and scripts/check-vega.mjs.
module.exports = {
  // Vega's react-native is the Kepler fork (the stock 0.72.0 package is only a peer placeholder).
  // If Vega's CLI already redirects this, the alias is a harmless no-op.
  'react-native': '@amazon-devices/react-native-kepler',
  '@react-navigation/native': '@amazon-devices/react-navigation__native',
  '@react-navigation/native-stack': '@amazon-devices/react-navigation__native-stack',
  '@react-navigation/core': '@amazon-devices/react-navigation__core',
  '@react-navigation/routers': '@amazon-devices/react-navigation__routers',
  '@react-navigation/elements': '@amazon-devices/react-navigation__elements',
  'react-native-svg': '@amazon-devices/react-native-svg',
  'react-native-qrcode-svg': '@amazon-devices/react-native-qrcode-svg',
  'react-native-gesture-handler': '@amazon-devices/react-native-gesture-handler',
  'react-native-reanimated': '@amazon-devices/react-native-reanimated',
  'react-native-safe-area-context': '@amazon-devices/react-native-safe-area-context',
  'react-native-screens': '@amazon-devices/react-native-screens',
  // @react-native-async-storage/async-storage is NOT aliased: the Vega doc keeps that import and
  // ships the system library through @amazon-devices/react-native-async-storage__async-storage.
};
