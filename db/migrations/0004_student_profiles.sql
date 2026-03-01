ALTER TABLE students
  ADD COLUMN IF NOT EXISTS age INT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS learned_timetables INT[];

UPDATE students
SET learned_timetables = ARRAY[1,2,3,4,5,6,7,8,9,10]
WHERE learned_timetables IS NULL OR array_length(learned_timetables, 1) IS NULL;

ALTER TABLE students
  ALTER COLUMN learned_timetables SET NOT NULL,
  ALTER COLUMN learned_timetables SET DEFAULT ARRAY[1,2,3,4,5,6,7,8,9,10];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_age_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_age_check CHECK (age IS NULL OR age BETWEEN 4 AND 120);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_gender_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_gender_check CHECK (
        gender IS NULL OR gender IN ('female', 'male', 'other', 'prefer_not_say')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_learned_timetables_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_learned_timetables_check CHECK (
        array_length(learned_timetables, 1) >= 1
        AND learned_timetables <@ ARRAY[1,2,3,4,5,6,7,8,9,10]::INT[]
      );
  END IF;
END $$;
