module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    // Reanimated plugin must be listed last
    '@amazon-devices/react-native-reanimated/plugin',
  ],
};
