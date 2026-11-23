// https://docs.expo.dev/guides/using-eslint/ — tekshirish: npx eslint src test
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // O'zbekcha matnda apostrof ko'p (o'z, to'g'ri) — React Native <Text> da uni HTML kabi yashirish shart emas
      'react/no-unescaped-entities': 'off',
    },
  },
]);
