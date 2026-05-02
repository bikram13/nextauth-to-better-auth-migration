import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as legacy from "./schema/auth-legacy";
import * as ba from "./schema/auth";

const url = process.env.DATABASE_URL ?? "postgresql://auth_user:auth_pass@localhost:5433/auth_db";

export const sql = postgres(url, { max: 10, prepare: false });
export const db = drizzle(sql, { schema: { ...legacy, ...ba } });
