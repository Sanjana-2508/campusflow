CREATE TABLE IF NOT EXISTS role_requests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('faculty', 'club_organiser')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  request_note TEXT NOT NULL DEFAULT '',
  reviewer_id INTEGER REFERENCES users(id),
  review_note TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS role_requests_one_pending_per_user
  ON role_requests(user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS role_requests_status_created_idx
  ON role_requests(status, requested_at DESC);

CREATE TABLE IF NOT EXISTS role_grants (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('faculty', 'club_organiser')),
  granted_by INTEGER NOT NULL REFERENCES users(id),
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);