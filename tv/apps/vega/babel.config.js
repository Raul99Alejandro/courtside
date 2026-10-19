module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    // community import names -> @amazon-devices/* ports (see babel-plugin-aliases.js)
    './babel-plugin-aliases',
    // Reanimated plugin must be listed last
    '@amazon-devices/react-native-reanimated/plugin',
  ],
};
