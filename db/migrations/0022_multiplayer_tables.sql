-- Migration 0022: Multiplayer Quiz Mode tables
-- Adds real-time multiplayer game support (v4.0)

-- ── Game state enum values ──────────────────────────────────
-- status: waiting | countdown | playing | completed | ended

-- ── multiplayer_games ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS multiplayer_games (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_code       VARCHAR(10) NOT NULL UNIQUE,
    host_user_id    UUID NOT NULL REFERENCES users(id),
    quiz_type_id    UUID NOT NULL REFERENCES quiz_types(id),
    difficulty      TEXT NOT NULL DEFAULT 'medium'
                    CHECK (difficulty IN ('low', 'medium', 'hard')),
    total_questions INTEGER NOT NULL DEFAULT 10
                    CHECK (total_questions > 0),
    penalty_seconds INTEGER NOT NULL DEFAULT 10
                    CHECK (penalty_seconds IN (5, 10, 20)),
    min_players     INTEGER NOT NULL DEFAULT 2
                    CHECK (min_players BETWEEN 2 AND 25),
    max_players     INTEGER NOT NULL DEFAULT 5
                    CHECK (max_players BETWEEN 2 AND 25),
    status          VARCHAR(20) NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'countdown', 'playing', 'completed', 'ended')),
    learned_timetables JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,

    CHECK (max_players >= min_players)
);

CREATE INDEX IF NOT EXISTS idx_mp_games_status ON multiplayer_games(status);
CREATE INDEX IF NOT EXISTS idx_mp_games_host ON multiplayer_games(host_user_id);
CREATE INDEX IF NOT EXISTS idx_mp_games_code ON multiplayer_games(game_code);
CREATE INDEX IF NOT EXISTS idx_mp_games_created ON multiplayer_games(created_at DESC);

-- ── multiplayer_questions ───────────────────────────────────

CREATE TABLE IF NOT EXISTS multiplayer_questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id         UUID NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL CHECK (position >= 1),
    quiz_type_id    UUID NOT NULL REFERENCES quiz_types(id),
    a               INTEGER,
    b               INTEGER,
    c               INTEGER,
    d               INTEGER,
    correct         TEXT NOT NULL,
    prompt          JSONB,
    UNIQUE(game_id, position)
);

CREATE INDEX IF NOT EXISTS idx_mp_questions_game ON multiplayer_questions(game_id);

-- ── multiplayer_players ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS multiplayer_players (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id         UUID NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    slot_number     INTEGER NOT NULL CHECK (slot_number >= 1),
    is_ready        BOOLEAN NOT NULL DEFAULT FALSE,
    total_time_ms   INTEGER,
    penalty_time_ms INTEGER NOT NULL DEFAULT 0,
    correct_count   INTEGER NOT NULL DEFAULT 0,
    wrong_count     INTEGER NOT NULL DEFAULT 0,
    final_position  INTEGER,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    UNIQUE(game_id, user_id),
    UNIQUE(game_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_mp_players_game ON multiplayer_players(game_id);
CREATE INDEX IF NOT EXISTS idx_mp_players_user ON multiplayer_players(user_id);

-- ── multiplayer_answers ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS multiplayer_answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id         UUID NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL REFERENCES multiplayer_players(id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES multiplayer_questions(id) ON DELETE CASCADE,
    value           TEXT,
    is_correct      BOOLEAN NOT NULL,
    lap_time_ms     INTEGER NOT NULL,
    penalty_ms      INTEGER NOT NULL DEFAULT 0,
    answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_answers_game ON multiplayer_answers(game_id);
CREATE INDEX IF NOT EXISTS idx_mp_answers_player ON multiplayer_answers(player_id);

-- ── multiplayer_chat_messages ───────────────────────────────

CREATE TABLE IF NOT EXISTS multiplayer_chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id         UUID NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    message         VARCHAR(200) NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_chat_game ON multiplayer_chat_messages(game_id);
CREATE INDEX IF NOT EXISTS idx_mp_chat_sent ON multiplayer_chat_messages(game_id, sent_at);

-- ── Multiplayer badges ──────────────────────────────────────

INSERT INTO badges (code, name_en, name_hu, description_en, description_hu, icon, category, rule, sort_order)
VALUES
  ('mp_first_win', 'First Victory', 'Első győzelem',
   'Win your first multiplayer game', 'Nyerd meg az első többjátékos játékod',
   'pi pi-trophy', 'general',
   '{"type": "mp_wins", "count": 1}'::jsonb, 100),

  ('mp_5_wins', 'Champion', 'Bajnok',
   'Win 5 multiplayer games', 'Nyerj meg 5 többjátékos játékot',
   'pi pi-trophy', 'general',
   '{"type": "mp_wins", "count": 5}'::jsonb, 101),

  ('mp_perfect_game', 'Flawless', 'Hibátlan',
   'Win a multiplayer game with 100% accuracy', 'Nyerj meg egy többjátékos játékot 100%-os pontossággal',
   'pi pi-star-fill', 'accuracy',
   '{"type": "mp_perfect_game"}'::jsonb, 102),

  ('mp_10_games', 'Veteran', 'Veterán',
   'Play in 10 multiplayer games', 'Játssz 10 többjátékos játékban',
   'pi pi-users', 'general',
   '{"type": "mp_games_played", "count": 10}'::jsonb, 103),

  ('mp_speed_demon', 'Speed Demon', 'Villámgyors',
   'Win a game with all answers under 3 seconds each', 'Nyerj meg egy játékot úgy, hogy minden válaszod 3 másodperc alatt legyen',
   'pi pi-bolt', 'speed',
   '{"type": "mp_speed_demon", "max_answer_time_ms": 3000}'::jsonb, 104),

  ('mp_host_10', 'Game Master', 'Játékmester',
   'Host 10 multiplayer games', 'Adj házigazdát 10 többjátékos játéknak',
   'pi pi-server', 'general',
   '{"type": "mp_games_hosted", "count": 10}'::jsonb, 105)
ON CONFLICT (code) DO NOTHING;
