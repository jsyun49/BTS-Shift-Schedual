import { Router } from 'express';
import db from '../db/db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(req.user!.id);
  const unreadCount = (
    db
      .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user!.id) as { c: number }
  ).c;
  res.json({ notifications: rows, unreadCount });
});

router.post('/:id/read', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 ID입니다.' });

  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as
    | { id: number; user_id: number }
    | undefined;
  if (!notif) return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
  if (notif.user_id !== req.user!.id) {
    return res.status(403).json({ error: '본인의 알림만 읽음 처리할 수 있습니다.' });
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true });
});

export default router;
