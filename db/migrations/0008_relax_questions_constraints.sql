-- Migration 0008: Relax questions table constraints for new quiz types
-- v2.2: New quiz types have a/b values outside 1–10, nullable b, and text correct values

-- Drop old CHECK constraints
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_a_check;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_b_check;

-- Make a, b nullable (many new quiz types don't use b, e.g. roman numerals)
ALTER TABLE questions ALTER COLUMN a DROP NOT NULL;
ALTER TABLE questions ALTER COLUMN b DROP NOT NULL;

-- Change correct from integer to text (needed for text answers like "XXVII", "3 r 1", "12, 14")
ALTER TABLE questions ALTER COLUMN correct TYPE TEXT USING correct::TEXT;
