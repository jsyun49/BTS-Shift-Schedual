import { Router } from 'express';
import { z } from 'zod';
import { dbGet, dbRun } from '../db/db';
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
}

// Login now only checks that the username exists and is active — no password required.
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '아이디를 입력해주세요.' });
  }
  const { username } = parsed.data;

  const user = await dbGet<UserRow>('SELECT * FROM users WHERE username = ?', [username]);

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
    },
  });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    contact: user.contact,
    color: user.color,
  });
});

const updateProfileSchema = z.object({
  contact: z.string().max(100).nullable().optional(),
});

router.patch('/me', authenticate, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '입력값이 올바르지 않습니다.' });
  }
  await dbRun('UPDATE users SET contact = ? WHERE id = ?', [parsed.data.contact ?? null, req.user!.id]);
  res.json({ ok: true });
});

export default router;
