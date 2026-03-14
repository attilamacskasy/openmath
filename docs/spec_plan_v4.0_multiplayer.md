# v4.0 Multiplayer Quiz Mode - Implementation Plan

## Context

OpenMath v3.2 is a production-ready math quiz platform (Angular 18 + FastAPI + PostgreSQL). The v4.0 spec (`docs/spec_v4.0_multiplayer.md`) adds real-time multiplayer quiz competitions with WebSocket communication, a lobby system, host dashboard, and game history. This is the first WebSocket feature in the codebase.

## Implementation Order (13 phases)

---

### Phase 1: Database Migration + Schema Visualization
**Files:**
- `db/migrations/0022_multiplayer_tables.sql`
- `db/migrations/0022_before.dbml` (copy of `0021_after.dbml`)
- `db/migrations/0022_after.dbml` (full schema with new tables in red `headercolor: #dc3545`)
- `db/migrations/0022_diff.dbml` (NEW: only new/changed tables shown in red, for quick diff review)
- `docs/spec_v3.3_dbml_schema_visualization.md` (update: add diff file to the convention)

Create 5 new tables following existing patterns (UUIDs, TIMESTAMPTZ, JSONB):
- `multiplayer_games` - game state, config, game code, host reference
- `multiplayer_questions` - shared question set per game
- `multiplayer_players` - player slots, ready state, scores, timing
- `multiplayer_answers` - per-player answers with lap times and penalties
- `multiplayer_chat_messages` - in-game chat

**Key adaptation from spec:** The spec uses `SERIAL` PKs and `INTEGER` FKs, but the existing schema uses `UUID` PKs everywhere. Adapt to use UUIDs for consistency, except `game_code` remains VARCHAR(10).

**DBML diff file convention (new):** The `0022_diff.dbml` file shows ONLY the new or changed tables with `headercolor: #dc3545` (red), plus their FK references to existing tables (shown without headercolor). This makes it easy to see at a glance what changed in a migration. The existing tables that are only referenced (not changed) appear as stubs with just their PK column.

**Update `spec_v3.3_dbml_schema_visualization.md`:**
- Section 2 naming convention: add `{NNN}_diff.dbml` as a third companion file
- Section 9 deliverables: list all 3 files per migration
- New section explaining the diff file purpose and conventions

---

### Phase 2: Backend REST API
**Files:**
- `python-api/app/routers/multiplayer.py` (new) - REST endpoints
- `python-api/app/schemas/multiplayer.py` (new) - Pydantic models
- `python-api/app/queries.py` - add multiplayer query functions

**Endpoints (from spec section 7):**
- `POST /api/multiplayer/games` - create game (generates code, questions)
- `GET /api/multiplayer/games` - list waiting games
- `GET /api/multiplayer/games/{code}` - game details
- `POST /api/multiplayer/games/{code}/join` - join game
- `DELETE /api/multiplayer/games/{code}/leave` - leave game
- `GET /api/multiplayer/history` - user's game history (role-filtered)
- `GET /api/multiplayer/history/{code}` - game detail with results + chat
- `GET /api/multiplayer/admin/games` - admin list all
- `DELETE /api/multiplayer/admin/games/{code}` - admin delete

**Reuses:** `generate_questions()` from `services/generator.py`, `get_current_user` from `dependencies.py`, game code generation per spec section 6.3.

---

### Phase 3: WebSocket Infrastructure
**Files:**
- `python-api/app/routers/multiplayer_ws.py` (new) - WebSocket endpoint
- `python-api/app/services/multiplayer.py` (new) - `GameManager` + `GameBroadcaster`
- `python-api/app/main.py` - register WS router
- `angular-app/nginx.conf` - add `/ws/` proxy block

**Design (from spec sections 5.2-5.5, 13.12):**
- Single WS endpoint: `/ws/game/{game_code}?token=JWT`
- JWT validated at connection time only (spec 13.9)
- `GameBroadcaster` protocol with `InProcessBroadcaster` implementation (Kubernetes-ready abstraction per spec 13.12)
- `GameManager` as injectable singleton managing active games
- `/ws/health` endpoint for container probes

**Message protocol** (spec section 5.3): JSON envelope `{type, payload, timestamp}`

Client to Server: `player_ready`, `chat_message`, `submit_answer`, `start_game`, `end_game`
Server to Client: `player_joined`, `player_left`, `player_ready_changed`, `chat_broadcast`, `countdown_tick`, `game_started`, `answer_update`, `position_update`, `game_completed`, `game_ended`

**Routing rules:** `answer_update` and `position_update` sent to host only. All others broadcast to all participants.

---

### Phase 4: Game Engine
**File:** `python-api/app/services/multiplayer.py` (extend)

**State machine** (spec section 6.2): `waiting -> countdown -> playing -> completed -> ended`

**Game logic:**
- Answer validation using existing `grader.py`
- Penalty system: wrong answer adds configured seconds (5/10/20)
- Server-authoritative timing (spec 13.3)
- Position calculation: most questions answered, then lowest total time
- Min 500ms between answers (anti-cheat, spec 13.4)
- Persist state to DB eagerly on every change (spec 13.12)

**Countdown:** Server sends `countdown_tick` (10 to 0) with 1-second intervals via `asyncio.sleep`

**Disconnection handling** (spec 13.2): lobby disconnect removes player; game disconnect marks unanswered with max penalty; host disconnect during game allows game to continue autonomously.

---

### Phase 5: Angular - Menu, Create Game, Join Game
**Files:**
- `angular-app/src/app/features/multiplayer/multiplayer-menu.component.ts` (new)
- `angular-app/src/app/features/multiplayer/create-game.component.ts` (new)
- `angular-app/src/app/features/multiplayer/join-game.component.ts` (new)
- `angular-app/src/app/core/services/multiplayer.service.ts` (new) - REST API calls
- `angular-app/src/app/models/multiplayer.model.ts` (new) - TypeScript interfaces
- `angular-app/src/app/app.routes.ts` - add multiplayer routes
- `angular-app/src/app/shared/components/header/header.component.ts` - add Multiplayer nav item

**MultiplayerMenuComponent:** 3-card landing (Join/Create/History) per spec 4.1
**CreateGameComponent:** Reuses quiz type dropdown, difficulty selector, timetable multi-select from `StartComponent`. Adds penalty select, player count inputs. Preview panel.
**JoinGameComponent:** Game code input + DataTable of waiting games with auto-refresh.

---

### Phase 6: Angular - WebSocket Service + Lobby
**Files:**
- `angular-app/src/app/core/services/multiplayer-ws.service.ts` (new)
- `angular-app/src/app/features/multiplayer/lobby.component.ts` (new)

**WS Service (spec 5.4):** Signal-based WebSocket wrapper with `connect()`, `send()`, `onMessage()`, `disconnect()`. Uses `Subject` for message stream + `filter`/`map` for typed subscriptions.

**LobbyComponent (spec 4.3):** Split layout - player table (left) + chat (right). Ready toggle (`p-inputSwitch`). Host sees Start Game button (disabled until all ready + min players). Leave Game with confirm dialog. Countdown overlay on game start.

---

### Phase 7: Angular - Player Quiz View
**File:** `angular-app/src/app/features/multiplayer/multiplayer-quiz.component.ts` (new)

**Based on existing `QuizComponent`** but with multiplayer additions (spec 4.5):
- Visible timer (elapsed + penalty + total) using `p-toolbar` + `p-tag`
- Penalty flash animation on wrong answer (CSS `@keyframes`)
- Answer submission via WebSocket (`submit_answer`) instead of REST
- Question indicators (correct/wrong/current/pending) using `p-tag`
- No competitor progress shown during play

---

### Phase 8: Angular - Host Dashboard
**File:** `angular-app/src/app/features/multiplayer/host-dashboard.component.ts` (new)

**Live dashboard (spec 4.6):**
- `p-table` with frozen Pos + Name columns, scrollable question columns
- Real-time updates from `answer_update` and `position_update` WS messages
- Auto-sort by questions completed then lowest total time
- Green/red circle icons for correct/wrong answers
- Lap time + penalty tags per cell
- Chat panel at bottom
- Elapsed timer in toolbar

---

### Phase 9: Angular - Post-Game Results + History
**Files:**
- `angular-app/src/app/features/multiplayer/game-results.component.ts` (new) - podium + results
- `angular-app/src/app/features/multiplayer/history-list.component.ts` (new)
- `angular-app/src/app/features/multiplayer/history-detail.component.ts` (new)

**Results (spec 4.7):** Podium animation (top 3), full results table (reuses dashboard table layout), "Show actual answers" toggle for teachers/admins, chat panel, End Game button for host.

**History list (spec 4.9):** Paginated table with date, code, quiz type, players, winner. Role-filtered visibility.

**History detail:** Read-only dashboard view with chat transcript.

---

### Phase 10: Localization
**Files:**
- `angular-app/src/assets/i18n/en.json` - add `multiplayer.*` keys
- `angular-app/src/assets/i18n/hu.json` - add `multiplayer.*` keys

All keys from spec section 9 plus component-specific strings.

---

### Phase 11: Badges
**Files:**
- `db/migrations/0022_multiplayer_tables.sql` (include badge inserts)
- `python-api/app/services/badges.py` - add multiplayer badge evaluation

6 new badges from spec section 10: `mp_first_win`, `mp_5_wins`, `mp_perfect_game`, `mp_10_games`, `mp_speed_demon`, `mp_host_10`.

Badge evaluation triggers when game transitions to `completed` status.

---

### Phase 12: Notifications
**File:** `python-api/app/services/notifications.py` - add multiplayer notification helpers

Events from spec section 11: winner notification, participant placement, teacher notification for student participation.

---

### Phase 13: Wire Everything Together
**Files:**
- `python-api/app/main.py` - register multiplayer REST + WS routers
- `angular-app/src/app/app.routes.ts` - finalize all routes
- `angular-app/src/environments/environment.ts` - add `wsUrl`

---

## Key Files Modified (existing)

| File | Changes |
|------|---------|
| `python-api/app/main.py` | Register 2 new routers |
| `python-api/app/queries.py` | Add multiplayer query functions |
| `angular-app/src/app/app.routes.ts` | Add 8 multiplayer routes |
| `angular-app/src/app/shared/components/header/header.component.ts` | Add Multiplayer nav item |
| `angular-app/src/app/core/services/api.service.ts` | Add multiplayer REST methods |
| `angular-app/src/environments/environment.ts` | Add `wsUrl` |
| `angular-app/src/assets/i18n/en.json` | Add ~30 multiplayer i18n keys |
| `angular-app/src/assets/i18n/hu.json` | Add ~30 multiplayer i18n keys |
| `angular-app/nginx.conf` | Add `/ws/` WebSocket proxy block |
| `python-api/app/services/badges.py` | Add multiplayer badge rules |
| `python-api/app/services/notifications.py` | Add multiplayer notifications |
| `docs/spec_v3.3_dbml_schema_visualization.md` | Add diff file convention |

## Key Files Created (new)

| File | Purpose |
|------|---------|
| `docs/spec_plan_v4.0_multiplayer.md` | This implementation plan |
| `db/migrations/0022_multiplayer_tables.sql` | 5 tables + badges + indexes |
| `db/migrations/0022_before.dbml` | Schema snapshot before migration |
| `db/migrations/0022_after.dbml` | Schema snapshot after migration (new tables in red) |
| `db/migrations/0022_diff.dbml` | Diff view: only new/changed tables (red) + FK stubs |
| `python-api/app/routers/multiplayer.py` | REST endpoints |
| `python-api/app/routers/multiplayer_ws.py` | WebSocket endpoint |
| `python-api/app/schemas/multiplayer.py` | Pydantic request/response models |
| `python-api/app/services/multiplayer.py` | GameManager, GameBroadcaster, game engine |
| `angular-app/src/app/core/services/multiplayer.service.ts` | REST API client |
| `angular-app/src/app/core/services/multiplayer-ws.service.ts` | WebSocket client |
| `angular-app/src/app/models/multiplayer.model.ts` | TypeScript interfaces |
| `angular-app/src/app/features/multiplayer/multiplayer-menu.component.ts` | Landing page |
| `angular-app/src/app/features/multiplayer/create-game.component.ts` | Game creation form |
| `angular-app/src/app/features/multiplayer/join-game.component.ts` | Game browser |
| `angular-app/src/app/features/multiplayer/lobby.component.ts` | Pre-game lobby |
| `angular-app/src/app/features/multiplayer/multiplayer-quiz.component.ts` | Player quiz view |
| `angular-app/src/app/features/multiplayer/host-dashboard.component.ts` | Live scoreboard |
| `angular-app/src/app/features/multiplayer/game-results.component.ts` | Post-game results |
| `angular-app/src/app/features/multiplayer/history-list.component.ts` | History list |
| `angular-app/src/app/features/multiplayer/history-detail.component.ts` | History detail |

## Reused Code

| Existing | Reused In |
|----------|-----------|
| `services/generator.py:generate_questions()` | Game creation (shared question set) |
| `services/grader.py:grade_answer()` | Answer validation in game engine |
| `services/badges.py:evaluate_badges()` | Extended with multiplayer rules |
| `services/notifications.py:create_notification()` | Game completion notifications |
| `dependencies.py:get_current_user` | REST auth |
| `auth.py:decode_access_token` | WebSocket auth |
| `database.py:get_pool/get_connection` | All new queries |
| `StartComponent` quiz type dropdown pattern | CreateGameComponent |
| `QuizComponent` question rendering | MultiplayerQuizComponent |
| `KatexPipe` | MultiplayerQuizComponent |

## Verification

1. **Database:** Run migration against dev PostgreSQL, verify tables created
2. **REST API:** Test game CRUD via curl or API client
3. **WebSocket:** Test with wscat or browser dev tools - connect, send messages, verify broadcasts
4. **Full flow:** Create game, join with 2nd user, ready, start, answer questions, see results, check history
5. **Edge cases:** Disconnect/reconnect, full game rejection, host disconnect
6. **Build:** `cd angular-app && npm run build` - verify no TypeScript errors
7. **DBML:** Import all 3 DBML files into dbdiagram.io and verify visualization
