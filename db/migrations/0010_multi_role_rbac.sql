-- Migration 0010: Multi-role RBAC, relationship tables, quiz reviews
-- Depends on: 0009 (rename students → users)

-- ── 1. Roles table & seed data ──────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, description) VALUES
  ('admin',   'Full system access'),
  ('student', 'Can take quizzes and view own history'),
  ('teacher', 'Can view assigned students and review quizzes'),
  ('parent',  'Can view child quizzes and sign off on reviews')
ON CONFLICT (name) DO NOTHING;

-- ── 2. User–role junction table ─────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ── 3. Migrate existing role data ───────────────────────────

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = u.role
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Drop the old role column (after backend is updated to use user_roles)
-- ALTER TABLE users DROP COLUMN IF EXISTS role;
-- Kept commented — drop only after confirming the new system works

-- ── 4. Teacher ↔ Student assignments ────────────────────────

CREATE TABLE IF NOT EXISTS teacher_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON teacher_students(student_id);

-- ── 5. Parent ↔ Student assignments ────────────────────────

CREATE TABLE IF NOT EXISTS parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);

-- ── 6. Quiz reviews (unified teacher + parent) ─────────────

CREATE TABLE IF NOT EXISTS quiz_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('teacher', 'parent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'signed')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quiz_reviews_session ON quiz_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_reviews_reviewer ON quiz_reviews(reviewer_id);
