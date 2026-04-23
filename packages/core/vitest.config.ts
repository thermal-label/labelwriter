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
        '**/types.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
