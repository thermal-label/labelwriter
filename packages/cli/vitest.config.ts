import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      exclude: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/*.config.ts',
        '**/dist/**',
        '**/*.d.ts',
        '**/index.ts',
        '**/bin/**',
      ],
      thresholds: {
        statements: 80,
        branches: 45,
        functions: 90,
        lines: 80,
      },
    },
  },
});
