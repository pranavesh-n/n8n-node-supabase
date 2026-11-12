export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'graphify-out/**',
      '.agents/**',
      'coverage/**',
    ],
  },
  {
    files: ['scripts/**/*.js', '*.js', '*.mjs'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'warn',
    },
  },
  {
    files: ['tests/**/*.mjs'],
    rules: {
      'no-undef': 'off',
    },
  },
];
