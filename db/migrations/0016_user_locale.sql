-- v2.6: User locale preference for multi-language support
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

-- Validate locale values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_locale'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_locale CHECK (locale IN ('en', 'hu'));
  END IF;
END $$;

-- Index for locale-based queries (review templates, notifications)
CREATE INDEX IF NOT EXISTS idx_users_locale ON users(locale);
