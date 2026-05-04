const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'react-native' condition so packages like @firebase/auth resolve
// their RN-specific bundles via the package.json exports field.
// Without this, Metro falls through to the 'default' (browser/ESM) bundle
// which doesn't export getReactNativePersistence.
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = config;
