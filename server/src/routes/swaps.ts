import { Router, Response } from 'express';
import { z } from 'zod';
import db, { dbAll, dbGet, dbRun } from '../db/db';
import { authenticate, requireRole } from '../middleware/auth';
import { logChange, notify } from '../utils/helpers';

const router = Router();
router.use(authenticate);

interface ScheduleRow {
  id: number;
  user_id: number;
  date: string;
  shift_type_id: number;
  created_by: number;
  updated_at: string;
}

interface SwapRow {
  id: number;
  requester_id: number;
  target_id: number;
  schedule_id: number;
  target_schedule_id: number | null;
  requested_shift_type_id: number | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  resolved_at: string | null;
}

function swapDetailQuery(whereClause: string) {
  return `
    SELECT sr.*,
           req.name as requester_name, req.color as requester_color,
           tgt.name as target_name, tgt.color as target_color,
           s1.date as schedule_date, s1.shift_type_id as schedule_shift_type_id, st1.name as schedule_shift_type_name,
           s2.date as target_schedule_date, s2.shift_type_id as target_schedule_shift_type_id, st2.name as target_schedule_shift_type_name,
           st3.name as requested_shift_type_name, st3.color as requested_shift_type_color
    FROM swap_requests sr
    JOIN users req ON req.id = sr.requester_id
    JOIN users tgt ON tgt.id = sr.target_id
    JOIN schedules s1 ON s1.id = sr.schedule_id
    JOIN shift_types st1 ON st1.id = s1.shift_type_id
    LEFT JOIN schedules s2 ON s2.id = sr.target_schedule_id
    LEFT JOIN shift_types st2 ON st2.id = s2.shift_type_id
    LEFT JOIN shift_types st3 ON st3.id = sr.requested_shift_type_id
    ${whereClause}
    ORDER BY sr.created_at DESC
  `;
}

// List swap requests. Workers see only requests they're involved in; admins see all.
router.get('/', async (req, res) => {
  if (req.user!.role === 'admin') {
    const rows = await dbAll(swapDetailQuery(''));
    return res.json(rows);
  }
  const rows = await dbAll(swapDetailQuery('WHERE sr.requester_id = ? OR sr.target_id = ?'), [
    req.user!.id,
    req.user!.id,
  ]);
  res.json(rows);
});

const createSchema = z.object({
  // A change request may only ever target the requester's own schedule — no exceptions,
  // including for admins, who can edit any schedule directly without this workflow.
  targetId: z.number().int().positive().optional(),
  scheduleId: z.number().int().positive(),
  requestedShiftTypeId: z.number().int().positive(),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { scheduleId, requestedShiftTypeId } = parsed.data;
  const targetId = parsed.data.targetId ?? req.user!.id;

  if (targetId !== req.user!.id) {
    return res.status(403).json({ error: '본인의 근무만 변경 요청할 수 있습니다.' });
  }

  const schedule = await dbGet<ScheduleRow>('SELECT * FROM schedules WHERE id = ?', [scheduleId]);
  if (!schedule) return res.status(404).json({ error: '근무 기록을 찾을 수 없습니다.' });

  const target = await dbGet<{ id: number; name: string; is_active: number }>(
    'SELECT id, name, is_active FROM users WHERE id = ?',
    [targetId]
  );
  if (!target || !target.is_active) {
    return res.status(404).json({ error: '대상 근무자를 찾을 수 없습니다.' });
  }

  if (schedule.user_id !== targetId) {
    return res.status(400).json({ error: '선택한 근무가 대상 근무자의 것이 아닙니다.' });
  }

  const shiftType = await dbGet<{ id: number; name: string; is_active: number }>(
    'SELECT id, name, is_active FROM shift_types WHERE id = ?',
    [requestedShiftTypeId]
  );
  if (!shiftType || !shiftType.is_active) {
    return res.status(404).json({ error: '근무 유형을 찾을 수 없습니다.' });
  }
  if (shiftType.id === schedule.shift_type_id) {
    return res.status(400).json({ error: '이미 해당 근무 유형으로 등록되어 있습니다.' });
  }

  const duplicate = await dbGet(`SELECT id FROM swap_requests WHERE status = 'pending' AND schedule_id = ?`, [
    scheduleId,
  ]);
  if (duplicate) {
    return res.status(409).json({ error: '이미 이 근무에 대한 변경 요청이 진행 중입니다.' });
  }

  const result = await dbRun(
    `INSERT INTO swap_requests (requester_id, target_id, schedule_id, requested_shift_type_id, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [req.user!.id, targetId, scheduleId, requestedShiftTypeId]
  );

  const isSelfRequest = targetId === req.user!.id;
  if (isSelfRequest) {
    const admins = await dbAll<{ id: number }>(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`);
    for (const admin of admins) {
      await notify(
        admin.id,
        'SWAP_REQUEST_RECEIVED',
        `${req.user!.name}님이 본인의 ${schedule.date} 근무를 ${shiftType.name}(으)로 변경 요청했습니다.`,
        result.lastInsertRowid
      );
    }
  } else {
    await notify(
      targetId,
      'SWAP_REQUEST_RECEIVED',
      `${req.user!.name}님이 ${schedule.date} 근무를 ${shiftType.name}(으)로 변경 요청했습니다.`,
      result.lastInsertRowid
    );
  }

  res.status(201).json({ id: result.lastInsertRowid });
});

async function getSwapOr404(id: number, res: Response): Promise<SwapRow | undefined> {
  const swap = await dbGet<SwapRow>('SELECT * FROM swap_requests WHERE id = ?', [id]);
  if (!swap) {
    res.status(404).json({ error: '교대 요청을 찾을 수 없습니다.' });
    return undefined;
  }
  return swap;
}

// Accept: for a request targeting another worker, only that worker (or an admin) may accept.
// For a self-targeted request (worker asking to change their own schedule), only an admin may
// accept — workers cannot self-approve changes beyond 희망휴무, per the schedule editing rules.
// Performed atomically.
router.post('/:id/accept', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const swap = await getSwapOr404(id, res);
  if (!swap) return;

  const isSelfRequest = swap.target_id === swap.requester_id;
  if (isSelfRequest) {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: '본인의 근무 변경 요청은 관리자만 승인할 수 있습니다.' });
    }
  } else if (req.user!.role !== 'admin' && swap.target_id !== req.user!.id) {
    return res.status(403).json({ error: '변경 요청 대상자만 수락할 수 있습니다.' });
  }
  if (swap.status !== 'pending') {
    return res.status(409).json({ error: '이미 처리된 변경 요청입니다.' });
  }

  const s1 = await dbGet<ScheduleRow>('SELECT * FROM schedules WHERE id = ?', [swap.schedule_id]);
  if (!s1 || s1.user_id !== swap.target_id) {
    return res.status(409).json({ error: '대상자의 근무 정보가 변경되어 처리할 수 없습니다.' });
  }
  if (!swap.requested_shift_type_id) {
    return res.status(409).json({ error: '요청된 근무 유형 정보가 없습니다.' });
  }

  let others: SwapRow[] = [];
  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `UPDATE schedules SET shift_type_id = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [swap.requested_shift_type_id, s1.id],
    });

    await tx.execute({
      sql: `UPDATE swap_requests SET status = 'accepted', resolved_at = datetime('now') WHERE id = ?`,
      args: [id],
    });

    // Auto-cancel any other pending requests referencing the now-changed schedule.
    const othersRs = await tx.execute({
      sql: `SELECT * FROM swap_requests WHERE status = 'pending' AND id != ? AND schedule_id = ?`,
      args: [id, s1.id],
    });
    others = othersRs.rows as unknown as SwapRow[];
    for (const other of others) {
      await tx.execute({
        sql: `UPDATE swap_requests SET status = 'cancelled', resolved_at = datetime('now') WHERE id = ?`,
        args: [other.id],
      });
    }

    await tx.execute({
      sql: `INSERT INTO change_logs (user_id, action, target_schedule_id, detail) VALUES (?, ?, ?, ?)`,
      args: [
        req.user!.id,
        'SWAP_ACCEPT',
        s1.id,
        JSON.stringify({
          swapId: id,
          requesterId: swap.requester_id,
          targetId: swap.target_id,
          scheduleId: s1.id,
          requestedShiftTypeId: swap.requested_shift_type_id,
        }),
      ],
    });

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }

  for (const other of others) {
    await notify(
      other.requester_id,
      'SWAP_AUTO_CANCELLED',
      '관련된 근무가 다른 변경 요청으로 처리되어 요청이 자동 취소되었습니다.',
      other.id
    );
  }

  await notify(swap.requester_id, 'SWAP_ACCEPTED', `${s1.date} 근무 변경 요청이 수락되었습니다.`, id);
  if (swap.target_id !== swap.requester_id) {
    await notify(swap.target_id, 'SWAP_ACCEPTED', `${s1.date} 근무가 변경 요청에 따라 수락되었습니다.`, id);
  }

  res.json({ ok: true });
});

router.post('/:id/reject', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const swap = await getSwapOr404(id, res);
  if (!swap) return;

  if (req.user!.role !== 'admin' && swap.target_id !== req.user!.id) {
    return res.status(403).json({ error: '변경 요청 대상자만 거절할 수 있습니다.' });
  }
  if (swap.status !== 'pending') {
    return res.status(409).json({ error: '이미 처리된 변경 요청입니다.' });
  }

  await dbRun(`UPDATE swap_requests SET status = 'rejected', resolved_at = datetime('now') WHERE id = ?`, [id]);

  await notify(swap.requester_id, 'SWAP_REJECTED', '근무 변경 요청이 거절되었습니다.', id);

  res.json({ ok: true });
});

router.post('/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const swap = await getSwapOr404(id, res);
  if (!swap) return;

  if (req.user!.role !== 'admin' && swap.requester_id !== req.user!.id) {
    return res.status(403).json({ error: '요청자만 변경 요청을 취소할 수 있습니다.' });
  }
  if (swap.status !== 'pending') {
    return res.status(409).json({ error: '이미 처리된 변경 요청입니다.' });
  }

  await dbRun(`UPDATE swap_requests SET status = 'cancelled', resolved_at = datetime('now') WHERE id = ?`, [id]);

  if (req.user!.role === 'admin') {
    await notify(swap.requester_id, 'SWAP_AUTO_CANCELLED', '관리자가 근무 변경 요청을 취소했습니다.', id);
  } else if (swap.target_id !== swap.requester_id) {
    await notify(swap.target_id, 'SWAP_AUTO_CANCELLED', '요청자가 근무 변경 요청을 취소했습니다.', id);
  }

  res.json({ ok: true });
});

// Admin: permanently delete one swap request record (from the admin swap-management screen).
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const swap = await getSwapOr404(id, res);
  if (!swap) return;

  await dbRun('DELETE FROM swap_requests WHERE id = ?', [id]);
  res.json({ ok: true });
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

// Admin: permanently delete multiple swap request records at once (전체 선택 / 전체 삭제).
router.post('/bulk-delete', requireRole('admin'), async (req, res) => {
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { ids } = parsed.data;

  const tx = await db.transaction('write');
  try {
    let deleted = 0;
    for (const id of ids) {
      const rs = await tx.execute({ sql: 'DELETE FROM swap_requests WHERE id = ?', args: [id] });
      deleted += rs.rowsAffected;
    }
    await tx.commit();
    res.json({ ok: true, deleted });
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
});

export default router;
