PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  role_id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT NOT NULL UNIQUE,
  description TEXT
);

INSERT INTO roles (role_name, description) VALUES
  ('admin', 'Full system administration'),
  ('clerk', 'Patient registration and queue management'),
  ('pharmacist', 'Medicine stock and dispensing management'),
  ('patient', 'Patient account and queue booking')
ON CONFLICT(role_name) DO UPDATE SET description = excluded.description;

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  patient_number TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  facility_name TEXT NOT NULL,
  town TEXT NOT NULL,
  staff_count INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1
);

INSERT INTO facilities (id, facility_name, town, staff_count) VALUES
  ('qmmh', 'Queen Mamohato Memorial Hospital', 'Maseru', 6),
  ('motebang', 'Motebang Hospital', 'Hlotse', 4),
  ('mafeteng', 'Mafeteng Hospital', 'Mafeteng', 3),
  ('semonkong', 'Semonkong Health Centre', 'Semonkong', 2)
ON CONFLICT(id) DO UPDATE SET
  facility_name = excluded.facility_name,
  town = excluded.town,
  staff_count = excluded.staff_count;

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

INSERT INTO services (id, service_name) VALUES
  ('consult', 'General consultation'),
  ('pharmacy', 'Pharmacy collection'),
  ('chronic', 'Chronic care review')
ON CONFLICT(id) DO UPDATE SET service_name = excluded.service_name;

CREATE TABLE IF NOT EXISTS queue_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  facility_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'called', 'completed', 'no-show', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES users(user_id),
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  UNIQUE (facility_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_tickets (facility_id, status);

CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  medicine_name TEXT NOT NULL,
  description TEXT
);

INSERT INTO medicines (id, medicine_name, description) VALUES
  ('para', 'Paracetamol 500 mg', 'Pain and fever relief'),
  ('amox', 'Amoxicillin 500 mg', 'Antibiotic'),
  ('metf', 'Metformin 500 mg', 'Diabetes medicine'),
  ('aml', 'Amlodipine 5 mg', 'Blood pressure medicine'),
  ('ors', 'Oral rehydration salts', 'Rehydration'),
  ('salb', 'Salbutamol inhaler', 'Respiratory medicine'),
  ('cotri', 'Cotrimoxazole', 'Antibiotic'),
  ('tld', 'TLD (HIV treatment)', 'Restricted medicine catalogue item')
ON CONFLICT(id) DO UPDATE SET
  medicine_name = excluded.medicine_name,
  description = excluded.description;

CREATE TABLE IF NOT EXISTS medicine_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id),
  UNIQUE (facility_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS medicine_watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  facility_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  UNIQUE (patient_id, facility_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_notifications ON notifications (user_id, is_read, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
