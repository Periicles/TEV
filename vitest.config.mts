import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Integration tests (`*.int.test.ts`) use DATABASE_URL; locally it comes from .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    // Integration tests share one database.
    fileParallelism: false,
  },
});
