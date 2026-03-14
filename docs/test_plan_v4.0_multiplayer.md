# v4.0 Multiplayer Quiz Mode — Test Plan

**Date:** 2026-03-14
**Tester:** Claude Code (automated) + Attila (manual review)
**Environment:** Windows Server 2025, PostgreSQL 16 (Docker), FastAPI 8000, Angular 4200

---

## Test Users

| Name | Email | Password | Role |
|------|-------|----------|------|
| Csinszka | csinszka@test.openmath.com | Test1234! | student (host) |
| Hajni | hajni@test.openmath.com | Test1234! | student (player) |
| Attila | attila@test.openmath.com | Test1234! | student (player) |
| Bernat | bernat@test.openmath.com | Test1234! | student (player) |

All users registered locally (no Google auth), birthday: 2015-06-15 (age 10), locale: hu.

---

## Phase 1: Database & Migration Verification (Background — No UI)

**Method:** Direct SQL queries via asyncpg

| # | Test | Expected |
|---|------|----------|
| 1.1 | Verify 5 multiplayer tables exist | multiplayer_games, _questions, _players, _answers, _chat_messages |
| 1.2 | Verify table constraints (CHECK, UNIQUE, FK) | All constraints from migration 0022 present |
| 1.3 | Verify 6 multiplayer badges inserted | mp_first_win, mp_5_wins, mp_perfect_game, mp_10_games, mp_speed_demon, mp_host_10 |
| 1.4 | Verify indexes created | 9 indexes on multiplayer tables |

---

## Phase 2: Auth & User Registration (Background — No UI)

**Method:** curl/HTTP calls to FastAPI

| # | Test | Expected |
|---|------|----------|
| 2.1 | Register Csinszka | 201 + JWT tokens returned |
| 2.2 | Register Hajni | 201 + JWT tokens returned |
| 2.3 | Register Attila | 201 + JWT tokens returned |
| 2.4 | Register Bernat | 201 + JWT tokens returned |
| 2.5 | Login each user | 200 + valid JWT for each |
| 2.6 | GET /api/auth/me with token | Returns correct user profile |
| 2.7 | Duplicate email registration | 409 Conflict |
| 2.8 | Invalid password (too short) | 422 Validation Error |

---

## Phase 3: Multiplayer REST API (Background — No UI)

**Method:** curl/HTTP calls with JWT auth

| # | Test | Expected |
|---|------|----------|
| 3.1 | POST /api/multiplayer/games — create game as Csinszka | 200 + game_code (MATH-XXX format) |
| 3.2 | GET /api/multiplayer/games — list waiting games | Array with the created game |
| 3.3 | GET /api/multiplayer/games/{code} — game detail | Game + empty players array |
| 3.4 | POST /api/multiplayer/games/{code}/join — Hajni joins | 200 + player object |
| 3.5 | POST /api/multiplayer/games/{code}/join — Attila joins | 200 + slot_number=2 |
| 3.6 | POST /api/multiplayer/games/{code}/join — Bernat joins | 200 + slot_number=3 |
| 3.7 | POST /api/multiplayer/games/{code}/join — host joins own game | 400/409 error |
| 3.8 | POST /api/multiplayer/games/{code}/join — over max_players | 400 error |
| 3.9 | DELETE /api/multiplayer/games/{code}/leave — Bernat leaves | 200 + left=true |
| 3.10 | GET /api/multiplayer/games/{code} — verify player count | 2 players (Hajni, Attila) |
| 3.11 | POST /api/multiplayer/games/{code}/join — Bernat re-joins | 200 |
| 3.12 | Create game with invalid quiz type | 404 error |
| 3.13 | Create game with invalid penalty (15) | 422 validation error |
| 3.14 | Create game with minPlayers > maxPlayers | 422 validation error |

After Phase 3, **clean up** the test game (delete via DB) so Phase 5 starts fresh.

---

## Phase 4: WebSocket Protocol (Background — No UI)

**Method:** Python websockets library — programmatic connection

| # | Test | Expected |
|---|------|----------|
| 4.1 | Connect with valid JWT | WebSocket open, no error |
| 4.2 | Connect with invalid JWT | WebSocket closed with code 4001 |
| 4.3 | Connect to non-existent game | WebSocket closed with code 4004 |
| 4.4 | Send player_ready message | Broadcast player_ready_changed to all |
| 4.5 | Send chat_message | Broadcast chat_broadcast to all |
| 4.6 | WS health endpoint | GET /ws/health returns {"status":"ok","websocket":true} |

After Phase 4, **clean up** any test games.

---

## Phase 5: Simulated 4-Player Multiplayer Game (Hybrid — User Confirmation Required)

This is the main test. It simulates a full game lifecycle with 4 players.

### Approach

I will use a **Python script** to orchestrate all 4 players via WebSocket simultaneously (since the Chrome extension controls one browser with multiple tabs, but WebSocket state per tab would be fragile). The script will:

1. Register/login all 4 users
2. Create a game as Csinszka (host)
3. Have Hajni, Attila, Bernat join via REST API
4. Connect all 4 WebSocket connections
5. Toggle ready states, send chat messages
6. Host starts game → countdown → playing
7. Each player answers questions (with varying speeds and accuracy)
8. Game completes → results calculated

**Before starting:** I will pause and show you the game code + lobby state so you can observe it in the Angular UI as host (Csinszka). You'll be able to see players joining and the live dashboard.

### Player Answer Profiles

| Player | Strategy | Expected Outcome |
|--------|----------|-----------------|
| Csinszka | Host — does NOT play (observes dashboard) | N/A — host watches |
| Hajni | Fast + all correct, ~1-2s per answer | 1st place, lowest time |
| Attila | Medium speed, 1 wrong answer, ~2-4s | 2nd place, some penalty |
| Bernat | Slow, 2 wrong answers, ~3-5s | 3rd place, more penalty |

### Step-by-Step Sequence

| Step | Action | Verification |
|------|--------|-------------|
| 5.1 | Create game: multiplication_1_10, 5 questions, penalty=10s, min=2, max=5 | Game code generated |
| 5.2 | **PAUSE — Show game code to user** | User opens lobby in Angular as Csinszka |
| 5.3 | Hajni joins via API | User sees player appear in lobby |
| 5.4 | Attila joins via API | User sees 2nd player |
| 5.5 | Bernat joins via API | User sees 3rd player |
| 5.6 | Connect 3 player WebSockets | All connected |
| 5.7 | Players toggle ready | User sees ready indicators |
| 5.8 | Send chat messages from each player | User sees chat in lobby |
| 5.9 | **PAUSE — Confirm start** | User confirms game can start |
| 5.10 | Host starts game via WS | Countdown begins (10s) |
| 5.11 | Game enters playing state | Questions distributed |
| 5.12 | Hajni answers all correct, fast | Host dashboard updates live |
| 5.13 | Attila answers with 1 wrong | Host dashboard shows penalties |
| 5.14 | Bernat answers with 2 wrong | Host dashboard shows all positions |
| 5.15 | All players finish | Game status → completed |
| 5.16 | Host ends game | Game status → ended |
| 5.17 | Verify final positions in DB | Hajni=1st, Attila=2nd, Bernat=3rd |
| 5.18 | Verify answers in DB | All 15 answers (3 players x 5 questions) |
| 5.19 | Verify chat messages in DB | All chat messages persisted |

---

## Phase 6: Post-Game Verification (Background — No UI)

**Method:** REST API calls + DB queries

| # | Test | Expected |
|---|------|----------|
| 6.1 | GET /api/multiplayer/history (as Hajni) | Shows completed game |
| 6.2 | GET /api/multiplayer/history/{code} | Full results: players, answers, chat |
| 6.3 | Verify winner = Hajni (position 1) | Correct in DB |
| 6.4 | Verify penalty calculations | Attila: 10s penalty, Bernat: 20s penalty |
| 6.5 | Verify badge evaluation ran | mp_first_win badge check for Hajni |
| 6.6 | Query multiplayer_answers for correctness | is_correct flags match expected |

---

## Phase 7: Frontend UI Smoke Test (User Involved)

**Method:** Chrome extension — navigate Angular app

| # | Test | Expected |
|---|------|----------|
| 7.1 | Navigate to /multiplayer | 3-card menu (Join, Create, History) visible |
| 7.2 | Navigate to /multiplayer/create | Form with quiz type, difficulty, questions etc. |
| 7.3 | Navigate to /multiplayer/join | Game code input + waiting games table |
| 7.4 | Navigate to /multiplayer/history | Completed game(s) visible |
| 7.5 | Navigate to /multiplayer/history/{code} | Results table with positions, chat transcript |
| 7.6 | Header menu has Multiplayer submenu | Join, Create, History links present |

---

## Phase 8: Edge Cases & Error Handling (Background — No UI)

| # | Test | Expected |
|---|------|----------|
| 8.1 | Join a game that doesn't exist | 404 |
| 8.2 | Join a game that's already playing | 400 |
| 8.3 | Submit answer to wrong question_id | Error or ignored |
| 8.4 | Submit duplicate answer to same question | UNIQUE constraint or error |
| 8.5 | Unauthenticated request to /games | 401 |
| 8.6 | Leave a game during playing state | 400 |

---

## Data Retention

All test data (users, games, answers) will be **kept in the database** after testing per user request. The 4 test users and completed game serve as seed data for future testing.

---

## Execution Order

1. **Phase 1-2** — Run in background (database + auth), report results
2. **Phase 3-4** — Run in background (REST API + WebSocket protocol), report results
3. **Phase 7** — UI smoke test with user (Chrome extension)
4. **Phase 5** — Simulated game with user confirmation at key moments
5. **Phase 6** — Post-game verification in background
6. **Phase 8** — Edge cases in background
7. **Generate** test results document with all PASS/FAIL outcomes

---

## Tools Used

| Tool | Purpose |
|------|---------|
| curl (Bash) | REST API testing |
| asyncpg (Python) | Direct database verification |
| websockets (Python) | WebSocket protocol testing + game simulation |
| Claude in Chrome | Angular UI smoke testing |
| preview_* tools | Not needed (user has app open separately) |
