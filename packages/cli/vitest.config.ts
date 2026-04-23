import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@thermal-label/labelwriter-core': path.resolve(__dirname, '../core/src/index.ts'),
      '@thermal-label/labelwriter-node': path.resolve(__dirname, '../node/src/index.ts'),
    },
  },
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
