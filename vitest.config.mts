import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Carga .env (si existe) para las pruebas que usan PEY_WEBHOOK_SECRET.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
