// module.exports = {
//   root: true,
//   extends: '@react-native',
// };




module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'babel.config.js',
    'metro.config.js',
    'node_modules/**',
    'android/**',
    'ios/**',
    'packages/**',
  ],
  rules: {
    // Disable rules that cause issues with RN 0.85
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'off',
    'react/no-unstable-nested-components': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-redundant-type-constituents': 'off',
  },
};