CREATE TABLE IF NOT EXISTS quiz_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO quiz_types (code, description)
VALUES ('multiplication_1_10', 'Multiplication quiz with factors between 1 and 10')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE quiz_sessions
  ADD COLUMN IF NOT EXISTS quiz_type_id UUID;

UPDATE quiz_sessions
SET quiz_type_id = qt.id
FROM quiz_types qt
WHERE qt.code = 'multiplication_1_10'
  AND quiz_sessions.quiz_type_id IS NULL;

ALTER TABLE quiz_sessions
  ALTER COLUMN quiz_type_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_sessions_quiz_type_id_fkey'
  ) THEN
    ALTER TABLE quiz_sessions
      ADD CONSTRAINT quiz_sessions_quiz_type_id_fkey
      FOREIGN KEY (quiz_type_id) REFERENCES quiz_types(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_quiz_type ON quiz_sessions(quiz_type_id);

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS quiz_type_id UUID;

UPDATE questions
SET quiz_type_id = qs.quiz_type_id
FROM quiz_sessions qs
WHERE questions.session_id = qs.id
  AND questions.quiz_type_id IS NULL;

ALTER TABLE questions
  ALTER COLUMN quiz_type_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_quiz_type_id_fkey'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_quiz_type_id_fkey
      FOREIGN KEY (quiz_type_id) REFERENCES quiz_types(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_quiz_type ON questions(quiz_type_id);

ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS quiz_type_id UUID;

UPDATE answers
SET quiz_type_id = q.quiz_type_id
FROM questions q
WHERE answers.question_id = q.id
  AND answers.quiz_type_id IS NULL;

ALTER TABLE answers
  ALTER COLUMN quiz_type_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'answers_quiz_type_id_fkey'
  ) THEN
    ALTER TABLE answers
      ADD CONSTRAINT answers_quiz_type_id_fkey
      FOREIGN KEY (quiz_type_id) REFERENCES quiz_types(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_answers_quiz_type ON answers(quiz_type_id);
