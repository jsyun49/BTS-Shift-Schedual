import { Router } from 'express';
import { z } from 'zod';
import { dbAll } from '../db/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin'));

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month은 YYYY-MM 형식이어야 합니다.'),
});

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

router.get('/schedules.csv', async (req, res) => {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { month } = parsed.data;

  const rows = await dbAll<{
    date: string;
    user_name: string;
    shift_type_name: string;
    start_time: string | null;
    end_time: string | null;
  }>(
    `SELECT s.date, u.name as user_name, st.name as shift_type_name, st.start_time, st.end_time
     FROM schedules s
     JOIN users u ON u.id = s.user_id
     JOIN shift_types st ON st.id = s.shift_type_id
     WHERE s.date LIKE ?
     ORDER BY s.date ASC, u.name ASC`,
    [`${month}-%`]
  );

  const header = ['날짜', '근무자', '근무유형', '시작시간', '종료시간'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.date),
        csvEscape(r.user_name),
        csvEscape(r.shift_type_name),
        csvEscape(r.start_time || ''),
        csvEscape(r.end_time || ''),
      ].join(',')
    );
  }
  const csv = '﻿' + lines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="schedules-${month}.csv"`);
  res.send(csv);
});

export default router;
