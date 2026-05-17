import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const isTurso = url.startsWith("libsql://") || url.startsWith("https://");
const isSqlite = url.startsWith("file:") || isTurso;

const config: Config = {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: isTurso ? "turso" : isSqlite ? "sqlite" : "postgresql",
  dbCredentials: isTurso
    ? { url, authToken: process.env.DATABASE_AUTH_TOKEN }
    : isSqlite
    ? { url }
    : { url },
  verbose: true,
  strict: true,
};

export default config;
