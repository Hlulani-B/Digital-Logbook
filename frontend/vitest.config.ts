import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // The sql.js wasm build can't locate sql-wasm.wasm outside a browser, so
      // tests run the cache layer against the asm.js build (same API, no wasm).
      {
        find: /^sql\.js$/,
        replacement: path.resolve(__dirname, './node_modules/sql.js/dist/sql-asm.js'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      // Frontend coverage badge scope: the pure-logic utility layer under
      // src/lib. UI pages/components are exercised by the backend service
      // suites and integration specs rather than unit tests, so including them
      // would measure rendering, not logic. `tour.ts` is excluded because it
      // depends on driver.js, which is not yet installed (WIP).
      include: ['src/lib/**'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/__tests__/**',
        'src/__integration__/',
        'src/lib/tour.ts',
      ],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
});
