import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function crearPrismaClient() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const limite = Number(url.searchParams.get("connection_limit")) || 5;
  url.searchParams.delete("pgbouncer");
  url.searchParams.delete("connection_limit");
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    max: limite,
    idleTimeoutMillis: 300_000,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 60_000 } });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? crearPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
