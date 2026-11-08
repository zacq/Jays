import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const env = process.env;
const url = env.DATABASE_URL_UNPOOLED || env.NETLIFY_DATABASE_URL_UNPOOLED || env.DATABASE_URL || env.NETLIFY_DATABASE_URL;
if (!url) {
  throw new Error(
    "No database URL found. Set DATABASE_URL (scope: Builds + Functions) or connect a Neon database to this Netlify site.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
