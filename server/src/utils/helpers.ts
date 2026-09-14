import { dbRun } from '../db/db';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export async function logChange(
  userId: number,
  action: string,
  targetScheduleId: number | null,
  detail: Record<string, unknown> | null
) {
  await dbRun(
    `INSERT INTO change_logs (user_id, action, target_schedule_id, detail) VALUES (?, ?, ?, ?)`,
    [userId, action, targetScheduleId, detail ? JSON.stringify(detail) : null]
  );
}

export async function notify(
  userId: number,
  type: string,
  message: string,
  relatedId: number | null
) {
  await dbRun(
    `INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, ?, ?, ?)`,
    [userId, type, message, relatedId]
  );
}
