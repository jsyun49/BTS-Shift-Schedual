import fs from 'fs';
import path from 'path';
import db, { dbAll } from './db';

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await dbAll<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await db.executeMultiple(schema);

  // CREATE TABLE IF NOT EXISTS above won't add new columns to an already-existing table.
  if (!(await columnExists('swap_requests', 'requested_shift_type_id'))) {
    await db.execute('ALTER TABLE swap_requests ADD COLUMN requested_shift_type_id INTEGER REFERENCES shift_types(id)');
    console.log('Added swap_requests.requested_shift_type_id column.');
  }

  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
