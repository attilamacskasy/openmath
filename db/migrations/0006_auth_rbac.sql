-- Migration: 0006_auth_rbac.sql
-- OpenMath v2.1 — Authentication & RBAC schema changes

-- Add authentication columns to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'admin'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local'
    CHECK (auth_provider IN ('local', 'google', 'both'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;

-- Replace age with birthday for auto-calculated age
ALTER TABLE students ADD COLUMN IF NOT EXISTS birthday DATE;

-- Backfill: convert existing age to approximate birthday
-- (uses Jan 1 of birth year as estimate since exact date is unknown)
UPDATE students
SET birthday = make_date(
    EXTRACT(YEAR FROM CURRENT_DATE)::int - age, 1, 1
)
WHERE age IS NOT NULL AND birthday IS NULL;

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);

-- Index for Google sub lookups (SSO)
CREATE INDEX IF NOT EXISTS idx_students_google_sub ON students(google_sub);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_students_role ON students(role);
