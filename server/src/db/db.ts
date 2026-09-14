import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// TURSO_DATABASE_URL points at a hosted libSQL/Turso database in production, so data survives
// redeploys and restarts. Without it, this falls back to a local file — fine for dev, but the
// file lives on the container's own ephemeral disk in most PaaS hosts (no persistence there).
const localPath = path.resolve(process.cwd(), process.env.DB_PATH || './data/app.db');
if (!process.env.TURSO_DATABASE_URL) {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
}
const url = process.env.TURSO_DATABASE_URL || `file:${localPath}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({ url, authToken });

type Args = Array<string | number | bigint | boolean | null | Uint8Array | Date>;

// Thin async wrappers matching the old node:sqlite prepare().get/.all/.run() shapes, so route
// handlers only need `await` + an args array instead of a full rewrite around the client API.
export async function dbGet<T = any>(sql: string, args: Args = []): Promise<T | undefined> {
  const rs = await db.execute({ sql, args });
  return rs.rows[0] as unknown as T | undefined;
}

export async function dbAll<T = any>(sql: string, args: Args = []): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows as unknown as T[];
}

export async function dbRun(
  sql: string,
  args: Args = []
): Promise<{ lastInsertRowid: number; changes: number }> {
  const rs = await db.execute({ sql, args });
  return { lastInsertRowid: Number(rs.lastInsertRowid ?? 0), changes: rs.rowsAffected };
}

export default db;
