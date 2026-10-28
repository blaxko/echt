import { defineConfig } from "vitest/config";

// Each workspace package is its own Vitest project so that `pnpm test` runs them all.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "policy",
          include: ["packages/policy/test/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "server",
          include: ["apps/server/test/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "scripts",
          include: ["scripts/test/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
