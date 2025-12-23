import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      CONFIG_PATH: path.resolve('./test/inputs/config.test.json'),
      // SIGNER_PRIVATE_KEY: '',
      ADMIN_API_KEY: 'test-key-123',
      LOG_LEVEL: 'silent',
    },
    globals: true,
    environment: "node",
    include: ["test/**/*.spec.ts", "test/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    setupFiles: ["test/setup.ts", "test/mocks/logger.ts", "test/mocks/config.mock.ts"],
    globalTeardown: ["tests/teardown.ts"],
    testTimeout: 10000,
    silent: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "src/index.ts", ...configDefaults.exclude],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
