import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Server tests arrive in Task 33; keep the workspace green until then.
    passWithNoTests: true,
  },
});
