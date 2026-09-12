import fs from 'fs';
import path from 'path';
import db from './db';

function columnExists(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  return rows.some((r) => r.name === column);
}

function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // CREATE TABLE IF NOT EXISTS above won't add new columns to an already-existing table.
  if (!columnExists('swap_requests', 'requested_shift_type_id')) {
    db.exec('ALTER TABLE swap_requests ADD COLUMN requested_shift_type_id INTEGER REFERENCES shift_types(id)');
    console.log('Added swap_requests.requested_shift_type_id column.');
  }

  console.log('Migration complete.');
}

migrate();
