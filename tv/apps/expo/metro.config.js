// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname); // eslint-disable-line no-undef

// Configure Metro to work with Yarn workspaces
config.watchFolders = [
  path.resolve(__dirname, '../../packages/shared'),
  path.resolve(__dirname, '../..'),
  // courtside/src/core: the pure TypeScript domain core, shared with the repo root
  path.resolve(__dirname, '../../../src/core'),
];

config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../../node_modules'),
  ],
  extraNodeModules: {
    '@courtside/core': path.resolve(__dirname, '../../../src/core'),
    '@courtside/shared': path.resolve(__dirname, '../../packages/shared/src'),
  },
};

// When enabled, the optional code below will allow Metro to resolve
// and bundle source files with TV-specific extensions
// (e.g., *.ios.tv.tsx, *.android.tv.tsx, *.tv.tsx)
//
// Metro will still resolve source files with standard extensions
// as usual if TV-specific files are not found for a module.
//
if (process.env?.EXPO_TV === '1') {
  const originalSourceExts = config.resolver.sourceExts;
  const tvSourceExts = [
    ...originalSourceExts.map((e) => `tv.${e}`),
    ...originalSourceExts,
  ];
  config.resolver.sourceExts = tvSourceExts;
}

// src/core is NodeNext-style TypeScript: it imports './types.js' while the file is types.ts.
// Metro does not map .js to .ts, so retry relative .js imports from src/core as .ts.
const coreDir = path.resolve(__dirname, '../../../src/core');
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve || ((ctx, name, plat) => ctx.resolveRequest(ctx, name, plat));
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    context.originModulePath.startsWith(coreDir)
  ) {
    return resolve(context, moduleName.slice(0, -3), platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
