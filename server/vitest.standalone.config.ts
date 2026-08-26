import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.standalone.test.ts'],
    fileParallelism: true,
    testTimeout: 10_000,
  },
});
