-- Migration 0011: Limit each student to max 2 parents
-- v2.4: Enforced via BEFORE INSERT trigger on parent_students

CREATE OR REPLACE FUNCTION check_max_parents()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM parent_students WHERE student_id = NEW.student_id) >= 2 THEN
    RAISE EXCEPTION 'A student can have at most 2 parents';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_max_parents ON parent_students;
CREATE TRIGGER trg_max_parents
  BEFORE INSERT ON parent_students
  FOR EACH ROW
  EXECUTE FUNCTION check_max_parents();
