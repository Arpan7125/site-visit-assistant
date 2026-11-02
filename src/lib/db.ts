import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** A Prisma client or an interactive-transaction client. Domain functions accept either. */
export type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
