// Metro config for the Vega app (RN 0.72 line, @amazon-devices/* libraries).
// Shared code imports the community package names; here they are redirected to the Vega ports.
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const tvRoot = path.resolve(__dirname, '../..');
const coreDir = path.resolve(tvRoot, '../src/core');
const sharedSrc = path.resolve(tvRoot, 'packages/shared/src');
const vegaModules = path.resolve(__dirname, 'node_modules');

const ALIASES = require('./aliases');

const config = {
  projectRoot: __dirname,
  watchFolders: [
    tvRoot,
    coreDir,
    // generated moments (git-ignored) and committed cards, imported as JSON by shared
    path.resolve(tvRoot, '../build'),
    path.resolve(tvRoot, '../cards'),
  ],
  resolver: {
    unstable_enableSymlinks: true,
    // *.kepler.ts (remote keys) win over the plain file; the tv root has no hoisted deps
    // (nmHoistingLimits: workspaces), so shared and core resolve bare imports from here.
    platforms: ['kepler', 'native', 'ios', 'android'],
    nodeModulesPaths: [vegaModules],
    extraNodeModules: {
      '@courtside/core': coreDir,
      '@courtside/shared': sharedSrc,
      react: path.join(vegaModules, 'react'),
      'react-native': path.join(vegaModules, 'react-native'),
    },
    resolveRequest: (context, moduleName, platform) => {
      // src/core is NodeNext TypeScript (imports './x.js' for x.ts): retry relative .js as extensionless.
      if (
        moduleName.startsWith('.') &&
        moduleName.endsWith('.js') &&
        context.originModulePath.startsWith(coreDir)
      ) {
        moduleName = moduleName.slice(0, -3);
      }
      const alias = ALIASES[moduleName];
      if (alias) return context.resolveRequest(context, alias, platform);
      for (const [from, to] of Object.entries(ALIASES)) {
        if (moduleName.startsWith(from + '/')) {
          return context.resolveRequest(context, to + moduleName.slice(from.length), platform);
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
