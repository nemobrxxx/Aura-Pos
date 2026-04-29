module.exports = {
  plugins: ['@firebase/security-rules'],
  extends: ['plugin:@firebase/security-rules/recommended'],
  rules: {
    '@firebase/security-rules/no-bit-wise': 'error',
  },
  overrides: [
    {
      files: ['*.rules'],
      parser: '@firebase/eslint-plugin-security-rules/rules-parser',
    },
  ],
};
