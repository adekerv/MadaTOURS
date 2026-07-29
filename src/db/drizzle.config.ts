import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const getDbConnectionString = (): string | undefined => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  if (process.env.SUPABASE_POSTGRES_URL) return process.env.SUPABASE_POSTGRES_URL;
  
  for (const [key, value] of Object.entries(process.env)) {
    if (value && (value.startsWith('postgres://') || value.startsWith('postgresql://'))) {
      return value;
    }
  }
  return undefined;
};

const dbUrl = getDbConnectionString();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: dbUrl
    ? { url: dbUrl }
    : {
        host: process.env.SQL_HOST || "localhost",
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432,
        user: process.env.SQL_ADMIN_USER || process.env.SQL_USER || "postgres",
        password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || "",
        database: process.env.SQL_DB_NAME || "postgres",
        ssl: false,
      },
  verbose: true,
});
