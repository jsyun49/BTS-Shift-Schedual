import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
// Patches Express 4 so rejected promises in async route handlers reach the error middleware
// below, instead of hanging the request or crashing the process. Must be imported before routes.
import 'express-async-errors';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import shiftTypeRoutes from './routes/shiftTypes';
import scheduleRoutes from './routes/schedules';
import swapRoutes from './routes/swaps';
import notificationRoutes from './routes/notifications';
import statsRoutes from './routes/stats';
import exportRoutes from './routes/exportRoutes';
import settingsRoutes from './routes/settings';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// No public registration route exists anywhere in this API by design —
// worker accounts can only be created by an admin via /api/users.
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shift-types', shiftTypeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/settings', settingsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
