-- Migration 0007: Quiz Type Editor – schema extensions & new quiz types
-- v2.2: Admin quiz type CRUD, 16 new curriculum-aligned quiz types

-- ── Schema additions ───────────────────────────────────────────
ALTER TABLE quiz_types
  ADD COLUMN IF NOT EXISTS category        TEXT,
  ADD COLUMN IF NOT EXISTS recommended_age_min INT,
  ADD COLUMN IF NOT EXISTS recommended_age_max INT,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order      INT     NOT NULL DEFAULT 0;

-- Age range sanity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_types_age_range_check') THEN
    ALTER TABLE quiz_types
      ADD CONSTRAINT quiz_types_age_range_check CHECK (
        recommended_age_min IS NULL
        OR recommended_age_max IS NULL
        OR recommended_age_min <= recommended_age_max
      );
  END IF;
END $$;

-- ── Backfill existing rows ─────────────────────────────────────
UPDATE quiz_types SET category = 'multiplication', sort_order = 1,
       recommended_age_min = 7, recommended_age_max = 9
WHERE code = 'multiplication_1_10';

UPDATE quiz_types SET category = 'multiplication', sort_order = 2,
       recommended_age_min = 8, recommended_age_max = 10
WHERE code = 'sum_products_1_10';

-- ── Seed new quiz types ────────────────────────────────────────

-- Arithmetic
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('add_within_20',        'Addition within 20 (a + b ≤ 20)',                 'a_plus_b',         'int', 'arithmetic',    3,  6, 8),
  ('sub_within_20',        'Subtraction within 20 (a − b, a ≥ b)',            'a_minus_b',        'int', 'arithmetic',    4,  6, 8),
  ('add_round_tens',       'Addition of round tens (10+20, 30+40 …)',         'round_tens_add',   'int', 'arithmetic',    5,  7, 8),
  ('sub_round_tens',       'Subtraction of round tens (50−20 …)',             'round_tens_sub',   'int', 'arithmetic',    6,  7, 8),
  ('add_within_100',       'Addition within 100 (a + b ≤ 100)',               'a_plus_b_100',     'int', 'arithmetic',    7,  7, 9),
  ('sub_within_100',       'Subtraction within 100 (a − b, a ≥ b)',           'a_minus_b_100',    'int', 'arithmetic',    8,  7, 9),
  ('two_digit_plus_one',   'Two‑digit + one‑digit (47 + 6)',                  'two_plus_one',     'int', 'arithmetic',    9,  7, 9),
  ('two_digit_minus_one',  'Two‑digit − one‑digit (63 − 5)',                  'two_minus_one',    'int', 'arithmetic',   10,  7, 9)
ON CONFLICT (code) DO NOTHING;

-- Multiplication & Division
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('times_table_3',    'Times table of 3 (3 × 1 … 3 × 10)',          'times_table',   'int', 'multiplication', 11, 7, 9),
  ('times_table_4',    'Times table of 4 (4 × 1 … 4 × 10)',          'times_table',   'int', 'multiplication', 12, 7, 9),
  ('times_table_6',    'Times table of 6 (6 × 1 … 6 × 10)',          'times_table',   'int', 'multiplication', 13, 8, 9),
  ('division_exact',   'Division without remainder (12 ÷ 3 = 4)',     'a_div_b',       'int', 'multiplication', 14, 8, 10),
  ('division_remainder','Division with remainder (13 ÷ 4 = 3 r 1)',   'a_div_b_rem',   'text','multiplication', 15, 8, 10),
  ('double_number',    'Double of a number (2 × a)',                   'double',        'int', 'multiplication', 16, 7, 9)
ON CONFLICT (code) DO NOTHING;

-- Counting patterns
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('count_by_2', 'Continue the pattern: counting by 2 (6, 8, 10, ?, ?)',  'count_by_n', 'tuple', 'patterns', 17, 7, 8),
  ('count_by_5', 'Continue the pattern: counting by 5 (5, 10, 15, ?, ?)', 'count_by_n', 'tuple', 'patterns', 18, 7, 8)
ON CONFLICT (code) DO NOTHING;

-- Roman numerals
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('roman_to_arabic', 'Roman → Arabic (XIV = ?)',    'roman_to_int',  'int',  'roman', 19, 7, 9),
  ('arabic_to_roman', 'Arabic → Roman (27 = ?)',     'int_to_roman',  'text', 'roman', 20, 7, 9)
ON CONFLICT (code) DO NOTHING;

-- Measurement
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('measure_dm_to_cm', 'Conversion: dm → cm (5 dm = ? cm)',        'dm_to_cm',       'int', 'measurement', 21, 7, 9),
  ('measure_m_to_cm',  'Conversion: m → cm (2 m = ? cm)',          'm_to_cm',        'int', 'measurement', 22, 7, 9),
  ('length_addition',  'Length addition (35 cm + 12 cm = ? cm)',    'length_add',     'int', 'measurement', 23, 7, 9)
ON CONFLICT (code) DO NOTHING;
