-- Migration 0009: Rename students table to users
-- This is a preparatory step for v2.3 multi-role RBAC

DO $$
BEGIN
  -- Case 1: Already migrated — "users" exists. If 0001 re-created an empty
  -- "students" shell, drop it so this migration stays idempotent.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    DROP TABLE IF EXISTS students CASCADE;
    RETURN;
  END IF;

  -- Case 2: First run — rename students → users
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students' AND table_schema = 'public') THEN
    ALTER TABLE students RENAME TO users;
    ALTER TABLE quiz_sessions RENAME COLUMN student_id TO user_id;

    BEGIN ALTER TABLE users RENAME CONSTRAINT students_age_check TO users_age_check;
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END;
    BEGIN ALTER TABLE users RENAME CONSTRAINT students_gender_check TO users_gender_check;
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END;
    BEGIN ALTER TABLE quiz_sessions RENAME CONSTRAINT quiz_sessions_student_id_fkey TO quiz_sessions_user_id_fkey;
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END;

    BEGIN ALTER INDEX idx_sessions_student RENAME TO idx_sessions_user;
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END;
    BEGIN ALTER INDEX idx_students_email RENAME TO idx_users_email;
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END;
    BEGIN ALTER INDEX idx_students_google_sub RENAME TO idx_users_google_sub;
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END;
    BEGIN ALTER INDEX idx_students_role RENAME TO idx_users_role;
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END;
  END IF;
END $$;
