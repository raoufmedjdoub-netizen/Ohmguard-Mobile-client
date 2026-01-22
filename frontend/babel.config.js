const path = require('path');

console.log('>>> BABEL CONFIG LOADED <<<');

module.exports = function(api) {
  api.cache(true);
  
  return {
    presets: [
      ['babel-preset-expo', {
        worklets: false,
        reanimated: false,
      }],
    ],
    plugins: [
      path.resolve(__dirname, 'node_modules/react-native-worklets/plugin'),
      path.resolve(__dirname, 'node_modules/react-native-reanimated/plugin'),
    ],
  };
};
