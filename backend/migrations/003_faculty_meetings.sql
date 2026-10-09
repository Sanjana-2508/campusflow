CREATE TABLE IF NOT EXISTS faculty_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  cabin_room TEXT NOT NULL,
  building TEXT NOT NULL,
  floor TEXT NOT NULL DEFAULT '',
  updated_by INTEGER NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faculty_availability (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  location_status TEXT NOT NULL DEFAULT 'not_in_cabin'
    CHECK (location_status IN ('in_cabin', 'not_in_cabin')),
  meeting_status TEXT NOT NULL DEFAULT 'available'
    CHECK (meeting_status IN ('available', 'busy')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meeting_requests (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id),
  faculty_id INTEGER NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK (length(purpose) BETWEEN 1 AND 100),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  preferred_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  faculty_response TEXT NOT NULL DEFAULT '' CHECK (length(faculty_response) <= 2000),
  suggested_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS faculty_profiles_department_idx
  ON faculty_profiles(department, building, floor);

CREATE INDEX IF NOT EXISTS meeting_requests_student_idx
  ON meeting_requests(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS meeting_requests_faculty_status_idx
  ON meeting_requests(faculty_id, status, preferred_at);