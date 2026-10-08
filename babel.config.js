module.exports = {
  presets: [
    ['module:@react-native/babel-preset', { enableBabelRuntime: '^7.25.0' }],
  ],
  plugins: [
    [
      'babel-plugin-react-compiler',
      {
        compilationMode: 'infer',
        target: '19',
      },
    ],
    [
      'module-resolver',
      {
        alias: {
          crypto: 'react-native-quick-crypto',
          stream: 'readable-stream',
          buffer: 'react-native-quick-crypto',
        },
      },
    ],
    'react-native-worklets/plugin',
  ],
};
