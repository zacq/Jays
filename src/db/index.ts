import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __jaysPool?: Pool;
};

export const pool =
  globalForDb.__jaysPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10_000,
  });

globalForDb.__jaysPool = pool;

export const db = drizzle(pool);
