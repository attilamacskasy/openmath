-- Migration 0009: Rename students table to users
-- This is a preparatory step for v2.3 multi-role RBAC

BEGIN;

-- 1. Rename the table
ALTER TABLE students RENAME TO users;

-- 2. Rename FK column
ALTER TABLE quiz_sessions RENAME COLUMN student_id TO user_id;

-- 3. Rename constraints
ALTER TABLE users RENAME CONSTRAINT students_age_check TO users_age_check;
ALTER TABLE users RENAME CONSTRAINT students_gender_check TO users_gender_check;
ALTER TABLE quiz_sessions RENAME CONSTRAINT quiz_sessions_student_id_fkey TO quiz_sessions_user_id_fkey;

-- 4. Rename indexes
ALTER INDEX idx_sessions_student RENAME TO idx_sessions_user;
ALTER INDEX idx_students_email RENAME TO idx_users_email;
ALTER INDEX idx_students_google_sub RENAME TO idx_users_google_sub;
ALTER INDEX idx_students_role RENAME TO idx_users_role;

COMMIT;
