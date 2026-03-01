INSERT INTO quiz_types (code, description)
VALUES ('sum_products_1_10', 'Sum of products quiz: (a × b) + (c × d) with factors 1..10')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS c INT,
  ADD COLUMN IF NOT EXISTS d INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_c_check'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_c_check CHECK (c IS NULL OR c BETWEEN 1 AND 10);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_d_check'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_d_check CHECK (d IS NULL OR d BETWEEN 1 AND 10);
  END IF;
END $$;
