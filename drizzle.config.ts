import { defineConfig } from "drizzle-kit";

// Schema changes: `npm run db:generate`, then move the new SQL file from ./drizzle into
// netlify/database/migrations/ with a timestamp prefix (e.g. 20261201120000_add_x.sql).
// Netlify applies those files automatically on deploy. Never `drizzle-kit push`/`migrate` against Netlify Database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
