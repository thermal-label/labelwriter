import mbtech from '@mbtech-nl/eslint-config';

export default [
  ...mbtech,
  {
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/*.d.ts', '**/vitest.config.ts'],
  },
];
