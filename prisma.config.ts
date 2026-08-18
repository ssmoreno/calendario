import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer loads dotenv files on its own, so migration commands read
// the same local environment file the app does.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Deployed environments provide the variables directly.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  // The direct (unpooled) connection: Prisma Migrate needs advisory locks.
  datasource: { url: env("DIRECT_URL") },
  migrations: { seed: "pnpm exec tsx prisma/seed.ts" },
});
