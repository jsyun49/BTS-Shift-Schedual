import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db';
import { authenticate, requireRole } from '../middleware/auth';
import { isValidDate, logChange, notify } from '../utils/helpers';

const router = Router();
router.use(authenticate);

// Workers may self-service only these shift types; every other type is admin-managed.
const WISH_OFF_NAME = '희망휴무';
const EDUCATION_NAME = '교육';
const SELF_SERVICE_NAMES = [WISH_OFF_NAME, EDUCATION_NAME];
const WORKER_RESTRICTION_MESSAGE = `근무자는 ${SELF_SERVICE_NAMES.join(', ')}만 직접 등록/수정/삭제할 수 있습니다. 다른 근무는 관리자에게 요청해주세요.`;

interface ScheduleRow {
  id: number;
  user_id: number;
  date: string;
  shift_type_id: number;
  created_by: number;
  updated_at: string;
}

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month은 YYYY-MM 형식이어야 합니다.'),
});

// Anyone authenticated can view the full team calendar (read-only for others' shifts).
router.get('/', (req, res) => {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }
  const { month } = parsed.data;

  const rows = db
    .prepare(
      `SELECT s.id, s.user_id, s.date, s.shift_type_id, s.created_by, s.updated_at,
              u.name as user_name, u.color as user_color,
              st.name as shift_type_name, st.color as shift_type_color, st.is_off as shift_is_off,
              st.start_time, st.end_time
       FROM schedules s
       JOIN users u ON u.id = s.user_id
       JOIN shift_types st ON st.id = s.shift_type_id
       WHERE s.date LIKE ?
       ORDER BY s.date ASC`
    )
    .all(`${month}-%`);

  const minStaffSetting = db
    .prepare("SELECT value FROM settings WHERE key = 'min_staff_per_day'")
    .get() as { value: string } | undefined;
  const minStaff = minStaffSetting ? parseInt(minStaffSetting.value, 10) : 0;

  const workingCountByDate: Record<string, number> = {};
  for (const r of rows as any[]) {
    if (!r.shift_is_off) {
      workingCountByDate[r.date] = (workingCountByDate[r.date] || 0) + 1;
    }
  }

  const daysInMonth = new Date(
    parseInt(month.slice(0, 4), 10),
    parseInt(month.slice(5, 7), 10),
    0
  ).getDate();
  const understaffedDates: string[] = [];
  if (minStaff > 0) {
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      if ((workingCountByDate[dateStr] || 0) < minStaff) {
        understaffedDates.push(dateStr);
      }
    }
  }

  res.json({ schedules: rows, understaffedDates, minStaffPerDay: minStaff });
});

const createSchema = z.object({
  date: z.string().refine(isValidDate, 'date는 YYYY-MM-DD 형식이어야 합니다.'),
  shiftTypeId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
});

router.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { date, shiftTypeId } = parsed.data;
  const requestedUserId = parsed.data.userId ?? req.user!.id;

  // Server-side ownership check: workers may only register their own shifts.
  if (req.user!.role !== 'admin' && requestedUserId !== req.user!.id) {
    return res.status(403).json({ error: '본인의 근무만 등록할 수 있습니다.' });
  }

  const targetUser = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(requestedUserId) as
    | { id: number; is_active: number }
    | undefined;
  if (!targetUser) return res.status(404).json({ error: '대상 사용자를 찾을 수 없습니다.' });
  if (!targetUser.is_active) return res.status(400).json({ error: '비활성화된 사용자에게는 근무를 등록할 수 없습니다.' });

  const shiftType = db
    .prepare('SELECT id, name FROM shift_types WHERE id = ? AND is_active = 1')
    .get(shiftTypeId) as { id: number; name: string } | undefined;
  if (!shiftType) return res.status(400).json({ error: '존재하지 않거나 비활성화된 근무 유형입니다.' });

  if (req.user!.role !== 'admin' && !SELF_SERVICE_NAMES.includes(shiftType.name)) {
    return res.status(403).json({ error: WORKER_RESTRICTION_MESSAGE });
  }

  const existing = db
    .prepare('SELECT id FROM schedules WHERE user_id = ? AND date = ?')
    .get(requestedUserId, date);
  if (existing) {
    return res.status(409).json({ error: '해당 날짜에 이미 근무가 등록되어 있습니다.' });
  }

  const result = db
    .prepare(
      `INSERT INTO schedules (user_id, date, shift_type_id, created_by) VALUES (?, ?, ?, ?)`
    )
    .run(requestedUserId, date, shiftTypeId, req.user!.id);

  logChange(db, req.user!.id, 'CREATE_SCHEDULE', Number(result.lastInsertRowid), {
    userId: requestedUserId,
    date,
    shiftTypeId,
  });

  if (req.user!.role === 'admin' && requestedUserId !== req.user!.id) {
    notify(
      db,
      requestedUserId,
      'ADMIN_MODIFIED_SCHEDULE',
      `관리자가 회원님의 ${date} 근무를 등록했습니다.`,
      Number(result.lastInsertRowid)
    );
  }

  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

const bulkCreateSchema = z.object({
  startDate: z.string().refine(isValidDate, 'startDate는 YYYY-MM-DD 형식이어야 합니다.'),
  endDate: z.string().refine(isValidDate, 'endDate는 YYYY-MM-DD 형식이어야 합니다.'),
  shiftTypeId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
});

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Register the same shift type across a date range in one call (기간 선택 등록).
router.post('/bulk-create', (req, res) => {
  const parsed = bulkCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { startDate, endDate, shiftTypeId } = parsed.data;
  const requestedUserId = parsed.data.userId ?? req.user!.id;

  if (req.user!.role !== 'admin' && requestedUserId !== req.user!.id) {
    return res.status(403).json({ error: '본인의 근무만 등록할 수 있습니다.' });
  }
  if (endDate < startDate) {
    return res.status(400).json({ error: '종료일은 시작일 이후여야 합니다.' });
  }

  const dates = dateRange(startDate, endDate);
  if (dates.length > 366) {
    return res.status(400).json({ error: '한 번에 등록할 수 있는 기간은 최대 366일입니다.' });
  }

  const targetUser = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(requestedUserId) as
    | { id: number; is_active: number }
    | undefined;
  if (!targetUser) return res.status(404).json({ error: '대상 사용자를 찾을 수 없습니다.' });
  if (!targetUser.is_active) return res.status(400).json({ error: '비활성화된 사용자에게는 근무를 등록할 수 없습니다.' });

  const shiftType = db
    .prepare('SELECT id, name FROM shift_types WHERE id = ? AND is_active = 1')
    .get(shiftTypeId) as { id: number; name: string } | undefined;
  if (!shiftType) return res.status(400).json({ error: '존재하지 않거나 비활성화된 근무 유형입니다.' });

  if (req.user!.role !== 'admin' && !SELF_SERVICE_NAMES.includes(shiftType.name)) {
    return res.status(403).json({ error: WORKER_RESTRICTION_MESSAGE });
  }

  const checkStmt = db.prepare('SELECT id FROM schedules WHERE user_id = ? AND date = ?');
  const insertStmt = db.prepare(
    `INSERT INTO schedules (user_id, date, shift_type_id, created_by) VALUES (?, ?, ?, ?)`
  );

  const skipped: string[] = [];
  let created = 0;

  db.exec('BEGIN');
  try {
    for (const date of dates) {
      const existing = checkStmt.get(requestedUserId, date);
      if (existing) {
        skipped.push(date);
        continue;
      }
      const result = insertStmt.run(requestedUserId, date, shiftTypeId, req.user!.id);
      logChange(db, req.user!.id, 'CREATE_SCHEDULE', Number(result.lastInsertRowid), {
        userId: requestedUserId,
        date,
        shiftTypeId,
      });
      created++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  if (created > 0 && req.user!.role === 'admin' && requestedUserId !== req.user!.id) {
    notify(
      db,
      requestedUserId,
      'ADMIN_MODIFIED_SCHEDULE',
      `관리자가 회원님의 ${startDate} ~ ${endDate} 근무를 등록했습니다.`,
      null
    );
  }

  res.status(201).json({ created, skipped });
});

const updateSchema = z
  .object({
    shiftTypeId: z.number().int().positive().optional(),
    date: z.string().refine(isValidDate, 'date는 YYYY-MM-DD 형식이어야 합니다.').optional(),
  })
  .refine((data) => data.shiftTypeId !== undefined || data.date !== undefined, {
    message: '변경할 근무 유형 또는 날짜를 입력해주세요.',
  });

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as
    | ScheduleRow
    | undefined;
  if (!schedule) return res.status(404).json({ error: '근무 기록을 찾을 수 없습니다.' });

  // Server-side ownership check: only the owner or an admin may edit.
  if (req.user!.role !== 'admin' && schedule.user_id !== req.user!.id) {
    return res.status(403).json({ error: '본인의 근무만 수정할 수 있습니다.' });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { shiftTypeId, date } = parsed.data;

  // Only an admin may move a schedule to a different date; workers may only edit between
  // their own self-service entries (never relocate them or touch any other type).
  if (req.user!.role !== 'admin') {
    if (date !== undefined) {
      return res.status(403).json({ error: '근무 날짜 이동은 관리자만 할 수 있습니다.' });
    }
    const currentType = db
      .prepare('SELECT name FROM shift_types WHERE id = ?')
      .get(schedule.shift_type_id) as { name: string } | undefined;
    if (!currentType || !SELF_SERVICE_NAMES.includes(currentType.name)) {
      return res.status(403).json({ error: WORKER_RESTRICTION_MESSAGE });
    }
  }

  if (shiftTypeId !== undefined) {
    const shiftType = db
      .prepare('SELECT id, name FROM shift_types WHERE id = ? AND is_active = 1')
      .get(shiftTypeId) as { id: number; name: string } | undefined;
    if (!shiftType) return res.status(400).json({ error: '존재하지 않거나 비활성화된 근무 유형입니다.' });

    if (req.user!.role !== 'admin' && !SELF_SERVICE_NAMES.includes(shiftType.name)) {
      return res.status(403).json({ error: WORKER_RESTRICTION_MESSAGE });
    }
  }

  const targetDate = date ?? schedule.date;
  if (date !== undefined && date !== schedule.date) {
    const conflict = db
      .prepare('SELECT id FROM schedules WHERE user_id = ? AND date = ? AND id != ?')
      .get(schedule.user_id, date, id);
    if (conflict) {
      return res.status(409).json({ error: '해당 날짜에 이미 근무가 등록되어 있습니다.' });
    }
  }

  db.prepare(
    `UPDATE schedules SET shift_type_id = COALESCE(?, shift_type_id), date = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(shiftTypeId ?? null, targetDate, id);

  logChange(db, req.user!.id, 'UPDATE_SCHEDULE', id, {
    fromShiftTypeId: schedule.shift_type_id,
    toShiftTypeId: shiftTypeId ?? schedule.shift_type_id,
    fromDate: schedule.date,
    toDate: targetDate,
  });

  if (req.user!.role === 'admin' && schedule.user_id !== req.user!.id) {
    notify(
      db,
      schedule.user_id,
      'ADMIN_MODIFIED_SCHEDULE',
      date !== undefined && date !== schedule.date
        ? `관리자가 회원님의 ${schedule.date} 근무를 ${targetDate}로 이동했습니다.`
        : `관리자가 회원님의 ${schedule.date} 근무를 수정했습니다.`,
      id
    );
  }

  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as
    | ScheduleRow
    | undefined;
  if (!schedule) return res.status(404).json({ error: '근무 기록을 찾을 수 없습니다.' });

  if (req.user!.role !== 'admin' && schedule.user_id !== req.user!.id) {
    return res.status(403).json({ error: '본인의 근무만 삭제할 수 있습니다.' });
  }

  // Workers may only delete their own self-service entries.
  if (req.user!.role !== 'admin') {
    const currentType = db
      .prepare('SELECT name FROM shift_types WHERE id = ?')
      .get(schedule.shift_type_id) as { name: string } | undefined;
    if (!currentType || !SELF_SERVICE_NAMES.includes(currentType.name)) {
      return res.status(403).json({ error: WORKER_RESTRICTION_MESSAGE });
    }
  }

  const activeSwap = db
    .prepare("SELECT id FROM swap_requests WHERE status = 'pending' AND (schedule_id = ? OR target_schedule_id = ?)")
    .get(id, id);
  if (activeSwap) {
    return res.status(409).json({ error: '진행 중인 교대 요청이 있는 근무는 삭제할 수 없습니다. 먼저 요청을 취소해주세요.' });
  }

  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

  logChange(db, req.user!.id, 'DELETE_SCHEDULE', id, {
    userId: schedule.user_id,
    date: schedule.date,
    shiftTypeId: schedule.shift_type_id,
  });

  if (req.user!.role === 'admin' && schedule.user_id !== req.user!.id) {
    notify(
      db,
      schedule.user_id,
      'ADMIN_MODIFIED_SCHEDULE',
      `관리자가 회원님의 ${schedule.date} 근무를 삭제했습니다.`,
      id
    );
  }

  res.json({ ok: true });
});

// Admin: view change history
router.get('/change-logs', requireRole('admin'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT cl.id, cl.action, cl.target_schedule_id, cl.detail, cl.timestamp,
              u.name as user_name
       FROM change_logs cl
       JOIN users u ON u.id = cl.user_id
       ORDER BY cl.timestamp DESC
       LIMIT 500`
    )
    .all();
  res.json(rows);
});

export default router;
