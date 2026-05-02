import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./db/schema/auth-legacy.ts", "./db/schema/auth.ts"],
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://auth_user:auth_pass@localhost:5433/auth_db",
  },
  strict: true,
  verbose: true,
});
