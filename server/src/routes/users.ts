import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db, { dbAll, dbGet, dbRun } from '../db/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

interface UserRow {
  id: number;
  name: string;
  username: string;
  role: 'admin' | 'worker';
  contact: string | null;
  color: string;
  is_active: number;
  created_at: string;
}

// Any authenticated user: basic roster for calendar legend / swap target picker.
// Workers only see active accounts; admins see everyone with full detail.
router.get('/', async (req, res) => {
  if (req.user!.role === 'admin') {
    const rows = await dbAll<UserRow>(
      `SELECT id, name, username, role, contact, color, is_active, created_at
       FROM users ORDER BY role DESC, name ASC`
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        username: r.username,
        role: r.role,
        contact: r.contact,
        color: r.color,
        isActive: !!r.is_active,
        createdAt: r.created_at,
      }))
    );
  }

  const rows = await dbAll<Pick<UserRow, 'id' | 'name' | 'role' | 'color'>>(
    `SELECT id, name, role, color FROM users WHERE is_active = 1 ORDER BY role DESC, name ASC`
  );
  res.json(rows.map((r) => ({ id: r.id, name: r.name, role: r.role, color: r.color })));
});

const createUserSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  username: z
    .string()
    .min(3, '아이디는 3자 이상이어야 합니다.')
    .regex(/^[a-zA-Z0-9_.-]+$/, '아이디는 영문/숫자/._- 만 사용할 수 있습니다.'),
  contact: z.string().max(100).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '색상은 #RRGGBB 형식이어야 합니다.')
    .optional(),
});

// Admin: create a worker account. Login is username-only, so no password is collected —
// password_hash is still NOT NULL in the schema, so it's filled with an unusable random value.
router.post('/', requireRole('admin'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { name, username, contact, color } = parsed.data;

  const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }

  const unusedHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
  const result = await dbRun(
    `INSERT INTO users (name, username, password_hash, role, contact, color, is_active, must_change_password)
     VALUES (?, ?, ?, 'worker', ?, ?, 1, 0)`,
    [name, username, unusedHash, contact ?? null, color ?? '#3b82f6']
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  username: z
    .string()
    .min(3, '아이디는 3자 이상이어야 합니다.')
    .regex(/^[a-zA-Z0-9_.-]+$/, '아이디는 영문/숫자/._- 만 사용할 수 있습니다.')
    .optional(),
  contact: z.string().max(100).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  isActive: z.boolean().optional(),
});

// Admin: update a worker account (name, id/아이디, contact, color, active status).
// Only an admin can reach this route — workers cannot rename or reassign their own id/password.
router.patch('/:id', requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 사용자 ID입니다.' });

  const target = await dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (target.role === 'admin') {
    return res.status(400).json({ error: '관리자 계정은 이 API로 수정할 수 없습니다.' });
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { name, username, contact, color, isActive } = parsed.data;

  if (username) {
    const existing = await dbGet('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
    if (existing) {
      return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    }
  }

  await dbRun(
    `UPDATE users SET
       name = COALESCE(?, name),
       username = COALESCE(?, username),
       contact = CASE WHEN ? THEN ? ELSE contact END,
       color = COALESCE(?, color),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [
      name ?? null,
      username ?? null,
      contact !== undefined ? 1 : 0,
      contact ?? null,
      color ?? null,
      isActive === undefined ? null : isActive ? 1 : 0,
      id,
    ]
  );

  res.json({ ok: true });
});

// Admin: permanently delete a worker account and everything tied to it. libSQL doesn't reliably
// honor ON DELETE CASCADE (foreign_keys pragma state isn't guaranteed across calls), so every
// dependent table is cleaned up explicitly here, in one atomic transaction.
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 사용자 ID입니다.' });

  const target = await dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (target.role === 'admin') {
    return res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
  }

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `DELETE FROM swap_requests WHERE requester_id = ? OR target_id = ?
              OR schedule_id IN (SELECT id FROM schedules WHERE user_id = ?)
              OR target_schedule_id IN (SELECT id FROM schedules WHERE user_id = ?)`,
      args: [id, id, id, id],
    });
    await tx.execute({ sql: 'DELETE FROM notifications WHERE user_id = ?', args: [id] });
    await tx.execute({ sql: 'DELETE FROM change_logs WHERE user_id = ?', args: [id] });
    await tx.execute({ sql: 'DELETE FROM schedules WHERE user_id = ?', args: [id] });
    await tx.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }

  res.json({ ok: true });
});

export default router;
