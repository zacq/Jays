import { getConnectionString } from "@netlify/database";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// DATABASE_URL overrides for local dev / external Postgres; on Netlify, Netlify Database provides NETLIFY_DB_URL.
function resolveUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    return getConnectionString();
  } catch {
    return undefined;
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __jaysPool?: Pool;
};

export const pool =
  globalForDb.__jaysPool ??
  new Pool({
    connectionString: resolveUrl(),
    max: 3,
    idleTimeoutMillis: 10_000,
  });

globalForDb.__jaysPool = pool;

export const db = drizzle(pool);
