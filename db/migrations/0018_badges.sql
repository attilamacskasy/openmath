-- v2.7: Badge definitions
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_hu TEXT NOT NULL,
    description_en TEXT NOT NULL,
    description_hu TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'pi pi-star',
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'speed', 'accuracy', 'consistency', 'mastery')),
    rule JSONB NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial badges
INSERT INTO badges (code, name_en, name_hu, description_en, description_hu, icon, category, rule, sort_order) VALUES
  ('first_quiz',       'First Quiz',            'Első kvíz',              'Complete your first quiz session',                         'Teljesítsd az első kvíz munkameneted',                      'pi pi-play',        'general',     '{"type": "session_count", "threshold": 1}',                    1),
  ('perfect_score',    'Perfect Score',         'Tökéletes pontszám',     'Score 100% on any quiz session',                           'Szerezz 100%-ot bármelyik kvízen',                          'pi pi-check-circle','accuracy',    '{"type": "perfect_score"}',                                    2),
  ('speed_demon',      'Speed Demon',           'Villámgyors',            'Complete a 10-question quiz in under 60 seconds',           'Teljesíts egy 10 kérdéses kvízt 60 másodperc alatt',        'pi pi-bolt',        'speed',       '{"type": "speed", "max_seconds": 60, "min_questions": 10}',    3),
  ('streak_master',    'Streak Master',         'Sorozatbajnok',          'Answer 20 questions correctly in a row within one session', '20 egymást követő helyes válasz egy munkamenetben',         'pi pi-forward',     'accuracy',    '{"type": "streak", "threshold": 20}',                          4),
  ('practice_50',      'Practice Makes Perfect','A gyakorlat teszi a mestert','Complete 50 quiz sessions',                            'Teljesíts 50 kvíz munkamenetet',                            'pi pi-heart',       'consistency', '{"type": "session_count", "threshold": 50}',                   5),
  ('daily_7',          'Daily Learner',         'Napi tanuló',            'Complete at least one quiz per day for 7 consecutive days', 'Teljesíts legalább egy kvízt naponta 7 egymást követő napon','pi pi-calendar',    'consistency', '{"type": "daily_streak", "days": 7}',                          6),
  ('timetable_champ',  'Timetable Champion',    'Szorzótábla bajnok',     'Achieve 90%+ accuracy on hard difficulty for all timetables (1-10)', '90%+ pontosság nehéz szinten az összes szorzótáblán (1-10)','pi pi-trophy',  'mastery',     '{"type": "timetable_mastery", "min_accuracy": 90, "difficulty": "hard", "tables": [1,2,3,4,5,6,7,8,9,10]}', 7),
  ('multi_talent',     'Multi-Talent',          'Sokoldalú tehetség',     'Score above 80% on at least 5 different quiz types',       'Szerezz 80% feletti pontszámot legalább 5 különböző kvíztípuson', 'pi pi-sitemap', 'mastery',  '{"type": "multi_quiz_type", "min_score": 80, "min_types": 5}', 8)
ON CONFLICT (code) DO NOTHING;
