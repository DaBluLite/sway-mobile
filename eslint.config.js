import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import reactNativeConfig from '@react-native/eslint-config/flat';

export default defineConfig([
  reactHooks.configs.flat.recommended,
  ...reactNativeConfig,
  {
    root: true,
    rules: {
      'react-native/no-inline-styles': 'off',
      'react-hooks/react-compiler': 'error',
    },
  }
]);
