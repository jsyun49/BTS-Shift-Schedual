import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const includeInactive = req.user!.role === 'admin' && req.query.all === '1';
  const rows = includeInactive
    ? db.prepare('SELECT * FROM shift_types ORDER BY id ASC').all()
    : db.prepare('SELECT * FROM shift_types WHERE is_active = 1 ORDER BY id ASC').all();
  res.json(rows);
});

const shiftTypeSchema = z.object({
  name: z.string().min(1, '근무 유형 이름을 입력해주세요.'),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '색상은 #RRGGBB 형식이어야 합니다.'),
  isOff: z.boolean().optional(),
});

router.post('/', requireRole('admin'), (req, res) => {
  const parsed = shiftTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { name, startTime, endTime, color, isOff } = parsed.data;

  const existing = db.prepare('SELECT id FROM shift_types WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: '이미 존재하는 근무 유형 이름입니다.' });

  const result = db
    .prepare(
      `INSERT INTO shift_types (name, start_time, end_time, color, is_off) VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, startTime ?? null, endTime ?? null, color, isOff ? 1 : 0);

  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

const updateShiftTypeSchema = z.object({
  name: z.string().min(1).optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isOff: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.patch('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const existing = db.prepare('SELECT * FROM shift_types WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '근무 유형을 찾을 수 없습니다.' });

  const parsed = updateShiftTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '입력값이 올바르지 않습니다.' });
  const { name, startTime, endTime, color, isOff, isActive } = parsed.data;

  db.prepare(
    `UPDATE shift_types SET
       name = COALESCE(?, name),
       start_time = CASE WHEN ? THEN ? ELSE start_time END,
       end_time = CASE WHEN ? THEN ? ELSE end_time END,
       color = COALESCE(?, color),
       is_off = COALESCE(?, is_off),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`
  ).run(
    name ?? null,
    startTime !== undefined ? 1 : 0,
    startTime ?? null,
    endTime !== undefined ? 1 : 0,
    endTime ?? null,
    color ?? null,
    isOff === undefined ? null : isOff ? 1 : 0,
    isActive === undefined ? null : isActive ? 1 : 0,
    id
  );

  res.json({ ok: true });
});

export default router;
