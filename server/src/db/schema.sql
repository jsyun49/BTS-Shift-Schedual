-- Shift scheduler database schema (SQLite)

CREATE TABLE IF NOT EXISTS users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  username              TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('admin', 'worker')),
  contact               TEXT,
  color                 TEXT NOT NULL DEFAULT '#3b82f6',
  is_active             INTEGER NOT NULL DEFAULT 1,
  must_change_password  INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shift_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  start_time  TEXT,
  end_time    TEXT,
  color       TEXT NOT NULL DEFAULT '#10b981',
  is_off      INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS schedules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date           TEXT NOT NULL,
  shift_type_id  INTEGER NOT NULL REFERENCES shift_types(id),
  created_by     INTEGER NOT NULL REFERENCES users(id),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

CREATE TABLE IF NOT EXISTS swap_requests (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id             INTEGER NOT NULL REFERENCES users(id),
  target_id                INTEGER NOT NULL REFERENCES users(id),
  schedule_id              INTEGER NOT NULL REFERENCES schedules(id),
  target_schedule_id       INTEGER REFERENCES schedules(id),
  requested_shift_type_id  INTEGER REFERENCES shift_types(id),
  status                   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at              TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  is_read     INTEGER NOT NULL DEFAULT 0,
  related_id  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS change_logs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  action              TEXT NOT NULL,
  target_schedule_id  INTEGER,
  detail              TEXT,
  timestamp           TEXT NOT NULL DEFAULT (datetime('now'))
);
