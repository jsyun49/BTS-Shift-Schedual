import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'min_staff_per_day'").get() as
    | { value: string }
    | undefined;
  res.json({ minStaffPerDay: row ? parseInt(row.value, 10) : 0 });
});

const updateSchema = z.object({
  minStaffPerDay: z.number().int().min(0).max(6),
});

router.patch('/', requireRole('admin'), (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '입력값이 올바르지 않습니다.' });

  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('min_staff_per_day', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(parsed.data.minStaffPerDay));

  res.json({ ok: true });
});

export default router;
