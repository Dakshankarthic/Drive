const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

if (!config.resolver) {
  config.resolver = {};
}

// ---------------------------------------------------------------------------
// Platform-specific extensions are handled by Expo's default config.
// We only need to ensure .web.* extensions are available (at the END,
// so native files are preferred on Android/iOS).
// ---------------------------------------------------------------------------
const defaultExts = config.resolver.sourceExts || [];
if (!defaultExts.includes('web.tsx')) {
  config.resolver.sourceExts = [
    ...defaultExts,
    'web.tsx',
    'web.ts',
    'web.jsx',
    'web.js',
  ];
}

// ---------------------------------------------------------------------------
// Custom resolver: block native-only MapLibre modules on web.
//
// When Metro bundles for web it aliases `react-native` → `react-native-web`.
// react-native-web does NOT export PermissionsAndroid, so any MapLibre file
// that imports it (e.g. requestAndroidLocationPermissions.js) must be
// redirected to a safe no-op stub.
//
// `resolveRequest` is the only hook that sees the *resolved* path and can
// redirect it before Metro emits the "Unable to resolve" error.
// ---------------------------------------------------------------------------
const permissionsStub = path.resolve(
  __dirname,
  'stubs/PermissionsAndroid.js'
);

const requestAndroidStub = path.resolve(
  __dirname,
  'stubs/requestAndroidLocationPermissions.js'
);

const mapLibreStub = path.resolve(
  __dirname,
  'stubs/MapLibreGL.js'
);

const reactNativeMapsStub = path.resolve(
  __dirname,
  'stubs/ReactNativeMaps.js'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Redirect the PermissionsAndroid path that react-native-web is missing.
    if (
      moduleName === 'react-native-web/dist/exports/PermissionsAndroid' ||
      moduleName.endsWith('/PermissionsAndroid')
    ) {
      return { filePath: permissionsStub, type: 'sourceFile' };
    }

    // Redirect the entire requestAndroidLocationPermissions module
    if (moduleName.includes('requestAndroidLocationPermissions')) {
      return { filePath: requestAndroidStub, type: 'sourceFile' };
    }

    // Redirect MapLibre itself on web
    if (moduleName === '@maplibre/maplibre-react-native') {
      return { filePath: mapLibreStub, type: 'sourceFile' };
    }

    // Redirect react-native-maps on web (native-only, crashes Metro)
    if (moduleName === 'react-native-maps' || moduleName.startsWith('react-native-maps/')) {
      return { filePath: reactNativeMapsStub, type: 'sourceFile' };
    }

    // Block react-native internal imports that react-native-web doesn't support
    if (moduleName.includes('react-native/Libraries/Utilities/codegenNativeCommands')) {
      return { filePath: permissionsStub, type: 'sourceFile' };
    }
  }

  // Fall through to default resolution for everything else.
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
