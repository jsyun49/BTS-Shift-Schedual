import { Router } from 'express';
import { z } from 'zod';
import { dbAll } from '../db/db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month은 YYYY-MM 형식이어야 합니다.'),
});

router.get('/', async (req, res) => {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { month } = parsed.data;

  const users = await dbAll<{ id: number; name: string; color: string }>(
    `SELECT id, name, color FROM users WHERE role = 'worker' ORDER BY name ASC`
  );

  const shiftTypes = await dbAll<{ id: number; name: string; is_off: number }>(
    'SELECT id, name, is_off FROM shift_types'
  );

  const rows = await dbAll<{ user_id: number; shift_type_id: number; cnt: number }>(
    `SELECT s.user_id, s.shift_type_id, COUNT(*) as cnt
     FROM schedules s
     WHERE s.date LIKE ?
     GROUP BY s.user_id, s.shift_type_id`,
    [`${month}-%`]
  );

  const stats = users.map((u) => {
    const byShiftType: Record<string, number> = {};
    let totalWorkDays = 0;
    let offDays = 0;
    for (const st of shiftTypes) {
      const row = rows.find((r) => r.user_id === u.id && r.shift_type_id === st.id);
      const count = row ? row.cnt : 0;
      byShiftType[st.name] = count;
      if (st.is_off) offDays += count;
      else totalWorkDays += count;
    }
    return { userId: u.id, name: u.name, color: u.color, totalWorkDays, offDays, byShiftType };
  });

  res.json({ month, shiftTypes: shiftTypes.map((s) => s.name), stats });
});

export default router;
