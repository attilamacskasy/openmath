-- Migration: JSONB modernization for OpenMath v2.0
-- Phase 1 & 2: Add JSONB columns, backfill existing data, add indexes.
-- This migration is safe to re-run (idempotent guards).

-- ════════════════════════════════════════════════════════════
-- 1. quiz_types: add answer_type + template_kind columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE quiz_types
  ADD COLUMN IF NOT EXISTS answer_type TEXT NOT NULL DEFAULT 'int';

ALTER TABLE quiz_types
  ADD COLUMN IF NOT EXISTS template_kind TEXT NULL;

UPDATE quiz_types SET template_kind = 'axb'
WHERE code = 'multiplication_1_10' AND template_kind IS NULL;

UPDATE quiz_types SET template_kind = 'axb_plus_cxd'
WHERE code = 'sum_products_1_10' AND template_kind IS NULL;

-- ════════════════════════════════════════════════════════════
-- 2. questions: add prompt JSONB column
-- ════════════════════════════════════════════════════════════

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS prompt JSONB;

-- Relax NOT NULL on legacy a/b columns for future quiz types
-- (existing constraints prevent NULL; we leave them as-is for
--  phase 1 to keep backward compatibility.)

-- ════════════════════════════════════════════════════════════
-- 3. answers: add response JSONB + raw_input columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS response JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS raw_input TEXT NULL;

-- ════════════════════════════════════════════════════════════
-- 4. Backfill questions.prompt from legacy columns
-- ════════════════════════════════════════════════════════════

UPDATE questions SET prompt = jsonb_build_object(
  'template', jsonb_build_object(
    'kind', CASE
      WHEN c IS NOT NULL THEN 'axb_plus_cxd'
      ELSE 'axb'
    END,
    'a', a, 'b', b, 'c', c, 'd', d
  ),
  'answer', jsonb_build_object('type', 'int'),
  'render', CASE
    WHEN c IS NOT NULL THEN '(' || a || ' × ' || b || ') + (' || c || ' × ' || d || ')'
    ELSE a || ' × ' || b
  END
)
WHERE prompt IS NULL;

-- ════════════════════════════════════════════════════════════
-- 5. Backfill answers.response from legacy value column
-- ════════════════════════════════════════════════════════════

UPDATE answers SET response = jsonb_build_object(
  'raw', value::text,
  'parsed', jsonb_build_object('type', 'int', 'value', value)
)
WHERE (response IS NULL OR response = '{}'::jsonb) AND value IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- 6. GIN indexes for JSONB analytics queries
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS questions_prompt_gin ON questions USING gin(prompt);
CREATE INDEX IF NOT EXISTS answers_response_gin ON answers USING gin(response);

-- Functional index on template kind for fast filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'questions_template_kind_idx'
  ) THEN
    CREATE INDEX questions_template_kind_idx ON questions((prompt->'template'->>'kind'));
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 7. Student session index (for performance stats queries)
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_sessions_student ON quiz_sessions(student_id);
