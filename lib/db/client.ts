import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: Client | null = null;

function resolveUrl() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (url.startsWith("file:")) return url;
  if (url.startsWith("libsql:") || url.startsWith("https:") || url.startsWith("http:")) return url;
  // Treat anything else (e.g. Postgres) as not yet supported in this hackathon scaffold.
  // Fall back to local SQLite to keep dev unblocked; production should set a libsql or file URL.
  return "file:./dev.db";
}

export function getDb() {
  if (!_db) {
    const url = resolveUrl();
    _client = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export function getRawClient(): Client {
  if (!_client) getDb();
  return _client!;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
