import type { DatabaseSync } from 'node:sqlite';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function logChange(
  conn: DatabaseSync,
  userId: number,
  action: string,
  targetScheduleId: number | null,
  detail: Record<string, unknown> | null
) {
  conn
    .prepare(
      `INSERT INTO change_logs (user_id, action, target_schedule_id, detail) VALUES (?, ?, ?, ?)`
    )
    .run(userId, action, targetScheduleId, detail ? JSON.stringify(detail) : null);
}

export function notify(
  conn: DatabaseSync,
  userId: number,
  type: string,
  message: string,
  relatedId: number | null
) {
  conn
    .prepare(
      `INSERT INTO notifications (user_id, type, message, related_id) VALUES (?, ?, ?, ?)`
    )
    .run(userId, type, message, relatedId);
}
