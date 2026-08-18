import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Next.js and the Eve runtime both re-evaluate modules on reload, so the client
 * is cached on globalThis to keep a single connection pool per process.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  calendarioPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma: PrismaClient =
  globalForPrisma.calendarioPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.calendarioPrisma = prisma;
}
