import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db/db';
import { authenticate, signToken } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
});

interface UserRow {
  id: number;
  name: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'worker';
  contact: string | null;
  color: string;
  is_active: number;
  must_change_password: number;
}

// Login now only checks that the username exists and is active — no password required.
router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '아이디를 입력해주세요.' });
  }
  const { username } = parsed.data;

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | UserRow
    | undefined;

  if (!user) {
    return res.status(401).json({ error: '존재하지 않는 아이디입니다.' });
  }
  if (!user.is_active) {
    return res.status(403).json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' });
  }

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      contact: user.contact,
      color: user.color,
      mustChangePassword: !!user.must_change_password,
    },
  });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as
    | UserRow
    | undefined;
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    contact: user.contact,
    color: user.color,
    mustChangePassword: !!user.must_change_password,
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(3, '비밀번호는 3자 이상이어야 합니다.'),
});

// Only the admin account may self-service its own password here.
// Worker passwords are managed exclusively by the admin via /api/users/:id/reset-password.
router.post('/change-password', authenticate, (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: '비밀번호 변경은 관리자만 할 수 있습니다. 관리자에게 문의하세요.' });
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as
    | UserRow
    | undefined;
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?'
  ).run(newHash, user.id);

  res.json({ ok: true });
});

const updateProfileSchema = z.object({
  contact: z.string().max(100).nullable().optional(),
});

router.patch('/me', authenticate, (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '입력값이 올바르지 않습니다.' });
  }
  db.prepare('UPDATE users SET contact = ? WHERE id = ?').run(
    parsed.data.contact ?? null,
    req.user!.id
  );
  res.json({ ok: true });
});

export default router;
