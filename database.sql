CREATE DATABASE IF NOT EXISTS mediqueue_lesotho
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mediqueue_lesotho;

-- Roles used by the Express authentication and authorisation middleware.
CREATE TABLE IF NOT EXISTS roles (
  role_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(40) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
);

INSERT INTO roles (role_name, description) VALUES
  ('admin', 'Full system administration'),
  ('clerk', 'Patient registration and queue management'),
  ('pharmacist', 'Medicine stock and dispensing management'),
  ('patient', 'Patient account and queue booking')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Authentication schema expected by server/index.js and scripts/create-admin.mjs.
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NULL,
  account_status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  patient_number VARCHAR(60) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS facilities (
  id VARCHAR(40) PRIMARY KEY,
  facility_name VARCHAR(150) NOT NULL,
  town VARCHAR(100) NOT NULL,
  staff_count INT UNSIGNED NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO facilities (id, facility_name, town, staff_count) VALUES
  ('qmmh', 'Queen Mamohato Memorial Hospital', 'Maseru', 6),
  ('motebang', 'Motebang Hospital', 'Hlotse', 4),
  ('mafeteng', 'Mafeteng Hospital', 'Mafeteng', 3),
  ('semonkong', 'Semonkong Health Centre', 'Semonkong', 2)
ON DUPLICATE KEY UPDATE
  facility_name = VALUES(facility_name),
  town = VALUES(town),
  staff_count = VALUES(staff_count);

CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(40) PRIMARY KEY,
  service_name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO services (id, service_name) VALUES
  ('consult', 'General consultation'),
  ('pharmacy', 'Pharmacy collection'),
  ('chronic', 'Chronic care review')
ON DUPLICATE KEY UPDATE service_name = VALUES(service_name);

CREATE TABLE IF NOT EXISTS queue_tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_number INT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  facility_id VARCHAR(40) NOT NULL,
  service_id VARCHAR(40) NOT NULL,
  status ENUM('waiting','called','completed','no-show','cancelled') NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ticket_patient FOREIGN KEY (patient_id) REFERENCES users(user_id),
  CONSTRAINT fk_ticket_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_ticket_service FOREIGN KEY (service_id) REFERENCES services(id),
  UNIQUE KEY uq_facility_ticket (facility_id, ticket_number),
  INDEX idx_queue_status (facility_id, status)
);

CREATE TABLE IF NOT EXISTS medicines (
  id VARCHAR(40) PRIMARY KEY,
  medicine_name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL
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
ON DUPLICATE KEY UPDATE
  medicine_name = VALUES(medicine_name),
  description = VALUES(description);

CREATE TABLE IF NOT EXISTS medicine_stock (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  facility_id VARCHAR(40) NOT NULL,
  medicine_id VARCHAR(40) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_stock_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT fk_stock_user FOREIGN KEY (updated_by) REFERENCES users(user_id),
  UNIQUE KEY uq_facility_medicine (facility_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS medicine_watchlist (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  facility_id VARCHAR(40) NOT NULL,
  medicine_id VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_watch_patient FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_watch_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  UNIQUE KEY uq_patient_watch (patient_id, facility_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  message VARCHAR(500) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_notifications (user_id, is_read, created_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- The current React prototype synchronises its shared application state here.
CREATE TABLE IF NOT EXISTS app_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  state_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
