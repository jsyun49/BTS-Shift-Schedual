import { Router } from 'express';
import { dbAll, dbGet, dbRun } from '../db/db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const rows = await dbAll('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [
    req.user!.id,
  ]);
  const countRow = await dbGet<{ c: number }>(
    'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user!.id]
  );
  res.json({ notifications: rows, unreadCount: countRow!.c });
});

router.post('/:id/read', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const notif = await dbGet<{ id: number; user_id: number }>('SELECT * FROM notifications WHERE id = ?', [id]);
  if (!notif) return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
  if (notif.user_id !== req.user!.id) {
    return res.status(403).json({ error: '본인의 알림만 읽음 처리할 수 있습니다.' });
  }

  await dbRun('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  res.json({ ok: true });
});

router.post('/read-all', async (req, res) => {
  await dbRun('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user!.id]);
  res.json({ ok: true });
});

export default router;
