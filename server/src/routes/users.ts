import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db/db';
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
router.get('/', (req, res) => {
  if (req.user!.role === 'admin') {
    const rows = db
      .prepare(
        `SELECT id, name, username, role, contact, color, is_active, created_at
         FROM users ORDER BY role DESC, name ASC`
      )
      .all() as unknown as UserRow[];
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

  const rows = db
    .prepare(
      `SELECT id, name, role, color FROM users WHERE is_active = 1 ORDER BY role DESC, name ASC`
    )
    .all() as Pick<UserRow, 'id' | 'name' | 'role' | 'color'>[];
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
router.post('/', requireRole('admin'), (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { name, username, contact, color } = parsed.data;

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }

  const unusedHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, username, password_hash, role, contact, color, is_active, must_change_password)
       VALUES (?, ?, ?, 'worker', ?, ?, 1, 0)`
    )
    .run(name, username, unusedHash, contact ?? null, color ?? '#3b82f6');

  res.status(201).json({ id: Number(result.lastInsertRowid) });
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
router.patch('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 사용자 ID입니다.' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
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
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
    if (existing) {
      return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    }
  }

  db.prepare(
    `UPDATE users SET
       name = COALESCE(?, name),
       username = COALESCE(?, username),
       contact = CASE WHEN ? THEN ? ELSE contact END,
       color = COALESCE(?, color),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`
  ).run(
    name ?? null,
    username ?? null,
    contact !== undefined ? 1 : 0,
    contact ?? null,
    color ?? null,
    isActive === undefined ? null : isActive ? 1 : 0,
    id
  );

  res.json({ ok: true });
});

// Admin: permanently delete a worker account and everything tied to it. Deletes in dependency
// order so foreign-key checks (foreign_keys=ON) don't reject the user delete — schedules and
// notifications cascade on their own, but swap_requests and change_logs don't.
router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 사용자 ID입니다.' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (target.role === 'admin') {
    return res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
  }

  db.exec('BEGIN');
  try {
    db.prepare(
      `DELETE FROM swap_requests WHERE requester_id = ? OR target_id = ?
         OR schedule_id IN (SELECT id FROM schedules WHERE user_id = ?)
         OR target_schedule_id IN (SELECT id FROM schedules WHERE user_id = ?)`
    ).run(id, id, id, id);
    db.prepare('DELETE FROM change_logs WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.json({ ok: true });
});

export default router;
