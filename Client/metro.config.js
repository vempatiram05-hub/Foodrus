const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    blockList: [/\.cxx\/.*/],
  },
};

module.exports = mergeConfig(defaultConfig, config);