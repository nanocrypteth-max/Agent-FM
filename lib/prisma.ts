import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client for serverless environments (Vercel).
 *
 * IMPORTANT: this must cache the client in ALL environments, not just
 * development. Each Vercel serverless function invocation can spin up a
 * fresh Node.js execution context, and without a true global singleton,
 * every cold start (and sometimes every request, depending on bundling)
 * creates a brand new PrismaClient with its own connection pool. Those
 * connections are never released, so they accumulate against the database's
 * max_connections limit until Postgres starts rejecting new connections
 * with "Too many database connections opened" / "FATAL: remaining
 * connection slots are reserved for roles with the SUPERUSER attribute".
 *
 * Caching on `globalThis` (which persists across hot invocations of the
 * same Lambda/Edge worker) keeps the connection count bounded.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Cache in ALL environments (previously this was gated to non-production,
// which was the root cause of the connection leak in production).
globalForPrisma.prisma = prisma;
