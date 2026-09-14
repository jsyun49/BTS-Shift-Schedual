import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { dbGet, dbRun } from './db';

dotenv.config();

async function seed() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin1234';
  const adminName = process.env.SEED_ADMIN_NAME || '관리자';

  const existingAdmin = await dbGet('SELECT id FROM users WHERE username = ?', [adminUsername]);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    await dbRun(
      `INSERT INTO users (name, username, password_hash, role, contact, color, is_active, must_change_password)
       VALUES (?, ?, ?, 'admin', NULL, '#111827', 1, 0)`,
      [adminName, adminUsername, hash]
    );
    console.log(`Admin account created: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log('Admin account already exists, skipping.');
  }

  const shiftTypeCount = (await dbGet<{ c: number }>('SELECT COUNT(*) as c FROM shift_types'))!.c;
  if (shiftTypeCount === 0) {
    const insertSql = `INSERT INTO shift_types (name, start_time, end_time, color, is_off) VALUES (?, ?, ?, ?, ?)`;
    await dbRun(insertSql, ['Office', '08:00', '17:00', '#3b82f6', 0]);
    await dbRun(insertSql, ['GY', '22:00', '06:00', '#8b5cf6', 0]);
    await dbRun(insertSql, ['SW', '14:00', '22:00', '#f59e0b', 0]);
    await dbRun(insertSql, ['Day', '06:00', '14:00', '#06b6d4', 0]);
    await dbRun(insertSql, ['대휴', null, null, '#64748b', 1]);
    await dbRun(insertSql, ['연차', null, null, '#ec4899', 1]);
    await dbRun(insertSql, ['휴무', null, null, '#ef4444', 1]);
    console.log('Default shift types created: Office, GY, SW, Day, 대휴, 연차, 휴무');
  } else {
    console.log('Shift types already exist, skipping.');
  }

  const existingSetting = await dbGet("SELECT value FROM settings WHERE key = 'min_staff_per_day'");
  if (!existingSetting) {
    await dbRun("INSERT INTO settings (key, value) VALUES ('min_staff_per_day', '2')");
    console.log('Default setting min_staff_per_day=2 created.');
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
