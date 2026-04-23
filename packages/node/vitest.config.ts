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
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
  },
});
