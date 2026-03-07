-- v2.5: Add created_at to association tables if missing, then create view
ALTER TABLE teacher_students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE parent_students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- View for student association info (teachers + parents with timestamps)
CREATE OR REPLACE VIEW student_associations AS
SELECT
    ts.student_id,
    'teacher' AS relationship,
    ts.teacher_id AS related_user_id,
    u.name AS related_name,
    u.email AS related_email,
    ts.created_at AS associated_at
FROM teacher_students ts
JOIN users u ON u.id = ts.teacher_id
UNION ALL
SELECT
    ps.student_id,
    'parent' AS relationship,
    ps.parent_id AS related_user_id,
    u.name AS related_name,
    u.email AS related_email,
    ps.created_at AS associated_at
FROM parent_students ps
JOIN users u ON u.id = ps.parent_id;
