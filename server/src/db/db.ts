import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || './data/app.db';
const resolvedPath = path.resolve(process.cwd(), dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const db = new DatabaseSync(resolvedPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export default db;
