# v4.1 Multiplayer LAN Test & Debug Specification

**Date:** 2026-03-17
**Status:** Ready for execution
**Objective:** Find and fix all bugs preventing multiplayer gameplay over LAN
**Team:** Claude Code (Opus 4.6) + Attila (human tester on 5 PCs)

---

## 1. Human Testing Outcomes (v4.0 LAN Tests — All Failed)

### Test 1 — Basic Game Visibility
- Game loaded on all computers, all users logged in
- Game created by first user, second user joined successfully
- **FAIL:** Remaining 3 players could not see the game in the game list
- **FAIL:** Player who joined sent a chat message; host did not see it

### Test 2 — Ready State Sync
- **FAIL:** When a player toggled "I am ready", the ready state was not visible to other players

### Test 3 — Firewall Investigation
- Windows Firewall disabled on all machines
- No improvement observed
- Note: WebSocket runs over HTTP (port 80/443), so firewall was likely not the issue

### Test 4 — End-to-End Game Attempt
- 5 computers total: 1 dedicated server (dev), 4 player PCs on LAN
- Eventually all 4 players managed to join (after multiple retries)
- Chat messages lagged and did not reliably appear for all participants
- Ready toggle worked intermittently after multiple attempts
- Host clicked "Start Game" — countdown worked and was in sync across clients
- **FAIL:** After countdown, all 4 player screens showed white/blank — game did not render
- All questions and answer submission UI failed to appear

### Summary of Observed Failures
| # | Issue | Severity |
|---|-------|----------|
| F1 | Games not visible to all LAN players | Critical |
| F2 | Chat messages not delivered to all participants | Critical |
| F3 | Ready state not syncing across clients | Critical |
| F4 | White screen after game start (questions not rendering) | Critical |
| F5 | General WebSocket unreliability on LAN | Critical |

---

## 2. Root Cause Analysis (Code Review Findings)

### Bug 1: CRITICAL — `game_started` Race Condition (White Screen)

**File:** `multiplayer-quiz.component.ts` lines 136-141
**File:** `lobby.component.ts` lines 217-224

**The Problem:**
1. Server broadcasts `game_started` with the questions payload to ALL connected clients
2. Lobby component receives `game_started` and immediately navigates: `router.navigate(['/multiplayer/play', gameCode])`
3. Angular destroys the lobby component (and its WS subscription)
4. Angular creates the quiz component and subscribes to `game_started`
5. **But `game_started` already fired** — the quiz component never receives it
6. `questions()` signal stays empty `[]` — nothing renders → white screen

**Why the automated test passed:** The Python test script held a single WebSocket connection and didn't navigate between Angular routes. The `game_started` event was received on the same connection object.

**Fix Strategy:** Store `game_started` payload in the WS service (shared singleton) so quiz component can retrieve it on init, regardless of whether it subscribes before or after the event fires.

### Bug 2: CRITICAL — Production `wsUrl` Points to Nowhere

**File:** `environment.prod.ts` line 4
```typescript
wsUrl: '',  // Empty string!
```

**File:** `multiplayer-ws.service.ts` line 21
```typescript
const wsBase = environment.wsUrl || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
```

**The Problem:**
- In production (Docker), `wsUrl` is empty string `''`
- Empty string is falsy in JS, so the fallback runs: `ws://{location.host}/ws/game/...`
- This resolves to `ws://servername:80/ws/game/...` which hits nginx
- Nginx forwards `/ws/` to `http://python-api:8000/ws/` — this SHOULD work

**However:** The nginx config is missing `proxy_buffering off;` which can cause WebSocket frame buffering, leading to delayed/lost messages. This explains why chat and ready state are intermittent.

### Bug 3: HIGH — Nginx WebSocket Frame Buffering

**File:** `angular-app/nginx.conf` lines 25-34

**Missing directives:**
```nginx
proxy_buffering off;          # Prevent frame buffering
proxy_cache off;              # No caching for WS
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Without `proxy_buffering off`, nginx may buffer WebSocket frames and deliver them in batches rather than immediately. This directly explains:
- Chat messages arriving late or not at all
- Ready state changes not propagating
- Intermittent WebSocket behavior

### Bug 4: HIGH — No WebSocket Reconnection Logic

**File:** `multiplayer-ws.service.ts`

The WebSocket service has NO reconnection mechanism:
- `onclose` just sets `connected.set(false)` — doesn't attempt reconnect
- `onerror` just sets `connected.set(false)` — no retry
- If any transient network hiccup occurs on LAN, the connection is permanently lost
- User sees no indication that their connection dropped

This explains why some players couldn't see updates — their WS connections silently died.

### Bug 5: MEDIUM — No WebSocket Heartbeat/Ping-Pong

Neither the server nor the client implements keep-alive pings. On LAN with potential NAT timeouts or intermediary devices, idle WebSocket connections may be silently closed by network infrastructure. The lobby phase where players are just sitting and waiting is particularly vulnerable.

### Bug 6: MEDIUM — Lobby `ngOnDestroy` Disconnects WebSocket

**File:** `lobby.component.ts` line 171-173
```typescript
ngOnDestroy() {
    this.ws.disconnect();
}
```

When lobby navigates to quiz/dashboard after `game_started`:
1. Lobby `ngOnDestroy` fires → `ws.disconnect()` closes WebSocket
2. Quiz component `ngOnInit` fires → it subscribes to WS messages
3. But the WebSocket is already closed!
4. No reconnection happens → player is completely disconnected during gameplay

**This is the most critical bug.** The lobby explicitly kills the WebSocket connection when navigating away, but the quiz/dashboard components need that same connection to function.

### Bug 7: LOW — Game List Visibility (Possible UUID/String Comparison)

Games not appearing in the waiting games list for other players may be a separate issue — possibly related to how `GET /api/multiplayer/games` filters results, or the game status not being `waiting` when queried.

---

## 3. Fix Implementation Plan

### Fix 1: Remove `ws.disconnect()` from Lobby `ngOnDestroy` (CRITICAL)
**File:** `lobby.component.ts`

The lobby must NOT disconnect when navigating to the quiz/dashboard. The WebSocket is a singleton service — it should persist across route changes within the same game session. Only disconnect when explicitly leaving the game or when the game ends.

```typescript
ngOnDestroy() {
    // Do NOT disconnect WS here — quiz/dashboard needs it
    // WS will be disconnected by quiz/dashboard when game ends
}
```

### Fix 2: Store `game_started` Payload in WS Service (CRITICAL)
**File:** `multiplayer-ws.service.ts`

Add a signal to cache the last `game_started` payload so components mounting after the event can retrieve it:

```typescript
readonly lastGameStarted = signal<any>(null);

// In connect() or constructor, add:
this.messages$.pipe(filter(m => m.type === 'game_started')).subscribe(m => {
    this.lastGameStarted.set(m.payload);
});
```

**File:** `multiplayer-quiz.component.ts`

On init, check `ws.lastGameStarted()` before subscribing:

```typescript
ngOnInit() {
    // Check if game_started already fired
    const cached = this.ws.lastGameStarted();
    if (cached) {
        this.questions.set(cached.questions || []);
        this.startTime = Date.now();
        this.startTimer();
    }

    // Also subscribe for future events
    this.ws.onMessage('game_started').subscribe(...)
}
```

Same pattern for `host-dashboard.component.ts`.

### Fix 3: Add `proxy_buffering off` to Nginx (CRITICAL)
**File:** `angular-app/nginx.conf`

```nginx
location /ws/ {
    proxy_pass         http://python-api:8000/ws/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;    # ← Critical for WebSocket
    proxy_cache off;        # ← No caching for WS
}
```

### Fix 4: Add WebSocket Reconnection with Backoff (HIGH)
**File:** `multiplayer-ws.service.ts`

Add automatic reconnection with exponential backoff:

```typescript
private reconnectAttempts = 0;
private maxReconnectAttempts = 5;
private currentGameCode = '';

ws.onclose = () => {
    this.connected.set(false);
    if (this.currentGameCode && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.currentGameCode);
        }, delay);
    }
};
```

### Fix 5: Add Server-Side WebSocket Ping/Pong (HIGH)
**File:** `python-api/app/routers/multiplayer_ws.py`

Add periodic pings to detect dead connections:

```python
async def game_websocket(websocket: WebSocket, game_code: str):
    # ... auth and connect ...

    async def heartbeat():
        while True:
            try:
                await asyncio.sleep(30)
                await websocket.send_json({"type": "ping", "payload": {}, "timestamp": "..."})
            except:
                break

    ping_task = asyncio.create_task(heartbeat())
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "pong":
                continue  # Heartbeat response
            await game_manager.handle_message(game_code, user["sub"], data)
    except WebSocketDisconnect:
        ping_task.cancel()
        await game_manager.disconnect(game_code, user["sub"])
```

### Fix 6: Add Structured Debug Logging (DEBUG AID)
**File:** `python-api/app/services/multiplayer.py`

Add Python `logging` throughout the game engine to trace every event:

```python
import logging
logger = logging.getLogger("openmath.multiplayer")

# In every handler:
logger.info("WS_CONNECT game=%s user=%s name=%s", game_code, user_id, user_name)
logger.info("BROADCAST game=%s type=%s to=%d clients", game.game_code, msg_type, len(game.connections))
logger.info("CHAT game=%s from=%s text_len=%d", game.game_code, user_id, len(text))
# etc.
```

**File:** `angular-app/src/app/core/services/multiplayer-ws.service.ts`

Add console logging for all WS events:

```typescript
ws.onopen = () => { console.log('[WS] Connected to', gameCode); ... };
ws.onclose = (e) => { console.log('[WS] Closed', e.code, e.reason); ... };
ws.onerror = (e) => { console.error('[WS] Error', e); ... };
ws.onmessage = (e) => { console.log('[WS] ←', JSON.parse(e.data).type); ... };
send() { console.log('[WS] →', type); ... }
```

---

## 4. OpenTelemetry Integration Decision

**Recommendation: NOT now.**

The OTEL spec (`docs/roadmap_observability_otel_monitoring.md`) requires 4 additional Docker containers (otel-collector, prometheus, loki, grafana) and significant backend instrumentation. For this debugging session:

- **What we need:** Targeted WebSocket event logging to trace message flow
- **What OTEL provides:** Full production observability infrastructure
- **Trade-off:** OTEL setup is 1-2 days of work vs 15 minutes for `logging` + `console.log`

**Instead, we implement lightweight targeted debugging:**
1. Python `logging` module with structured JSON format in the multiplayer engine
2. Browser `console.log` in the WS service with message type + timestamp
3. Claude Code reads both server logs and browser console in real-time during testing
4. Database queries between test steps to verify state

**OTEL should be implemented as a separate effort** after the multiplayer game is working correctly, as part of the production readiness phase.

---

## 5. Test Environment Setup

### Hardware
| Machine | Role | OS | IP |
|---------|------|-----|-----|
| DEV Server | Hosts Docker prod stack + Claude Code | Windows 10/11 | 192.168.x.1 (example) |
| PC-2 | Player: Csinszka (host) | Windows 10/11 | 192.168.x.2 |
| PC-3 | Player: Hajni | Windows 10/11 | 192.168.x.3 |
| PC-4 | Player: Attila | Windows 10/11 | 192.168.x.4 |
| PC-5 | Player: Bernat | Windows 10/11 | 192.168.x.5 |

### Software Stack (on DEV Server)
```
docker-compose.prod.yml → 3 containers:
  ├── openmath-local-prod-db     (PostgreSQL 16)
  ├── openmath-local-prod-api    (FastAPI + uvicorn with --ws websockets)
  └── openmath-local-prod-frontend (Angular + nginx)
```

### Network
- All PCs on same LAN subnet
- Access OpenMath via `http://<DEV_SERVER_IP>:80` (or whichever `PUBLIC_PORT` is configured)
- WebSocket connects via same URL: `ws://<DEV_SERVER_IP>:80/ws/game/{code}`

---

## 6. Test Execution Workflow

### Phase A: Pre-Test Fix Implementation (Claude Code Only)

Claude Code implements all 6 fixes from Section 3 on the `main` branch:

| Step | Fix | Files Modified |
|------|-----|---------------|
| A.1 | Remove `ws.disconnect()` from lobby `ngOnDestroy` | `lobby.component.ts` |
| A.2 | Add `lastGameStarted` signal + cache in WS service | `multiplayer-ws.service.ts` |
| A.3 | Update quiz component to use cached game_started | `multiplayer-quiz.component.ts` |
| A.4 | Update dashboard component to use cached game_started | `host-dashboard.component.ts` |
| A.5 | Add `proxy_buffering off` to nginx WS config | `nginx.conf` |
| A.6 | Add WebSocket reconnection with backoff | `multiplayer-ws.service.ts` |
| A.7 | Add server-side ping/pong heartbeat | `multiplayer_ws.py` |
| A.8 | Add structured debug logging (backend) | `multiplayer.py` |
| A.9 | Add console debug logging (frontend) | `multiplayer-ws.service.ts` |
| A.10 | Rebuild Docker images and restart prod stack | `docker-compose.prod.yml` |

### Phase B: Smoke Test (Claude Code + 1 Browser via Chrome Plugin)

Before involving all 5 PCs, Claude Code validates the fixes work:

| Step | Test | Method |
|------|------|--------|
| B.1 | Angular build compiles without errors | `ng build` in container logs |
| B.2 | App loads at `http://localhost:80` | Chrome plugin screenshot |
| B.3 | Login works | Chrome plugin |
| B.4 | Create game → game code appears | Chrome plugin + REST API |
| B.5 | WS connection established (check browser console) | Chrome plugin console |
| B.6 | API test: `GET /api/multiplayer/games` returns the waiting game | `curl` from another terminal |

### Phase C: LAN Browser Session Control Plan

**Option A — Claude Code Controls 5 Chrome Profiles (Recommended)**

Claude Code opens 5 Chrome browser tabs within the MCP tab group, each logged in as a different user. This allows Claude Code to:
- See all 5 screens simultaneously
- Read browser console logs from each tab
- Control the timing of each action precisely
- Capture screenshots at every step

**How:**
1. Navigate Tab 1 → login as Csinszka → Create game
2. Navigate Tab 2 → login as Hajni → Join game
3. Navigate Tab 3 → login as Attila → Join game
4. Navigate Tab 4 → login as Bernat → Join game
5. Control all ready toggles, chat, and game start from the tabs

**Limitation:** All tabs connect from the same machine (localhost), not from separate LAN IPs. This tests the WebSocket logic but not actual LAN network path.

**Option B — Hybrid: Claude Code Controls Server + User Controls LAN PCs**

1. Claude Code starts the Docker prod stack and monitors:
   - Docker container logs (`docker logs -f openmath-local-prod-api`)
   - Database state (periodic SQL queries)
   - Backend WebSocket events (from structured logs)
2. Attila operates the 5 LAN PCs manually:
   - Opens Chrome on each PC → navigates to `http://<server_ip>`
   - Follows a step-by-step script provided by Claude Code
   - Reports what each screen shows (or takes screenshots)
3. Claude Code reads server logs in real-time and diagnoses issues

**Option C — Combined: Claude Code First, Then LAN Validation**

1. **First:** Claude Code runs the full game via Chrome tabs (Option A) to verify all fixes work in the happy path
2. **Then:** Attila runs the same scenario on 5 LAN PCs while Claude Code monitors server logs
3. If LAN fails but localhost worked, the bug is network-related (nginx, DNS, routing)
4. If both fail, the bug is in application logic

**Recommendation: Option C** — validates logic first, then isolates network issues.

### Phase D: Full LAN Test Protocol

**Pre-conditions:**
- Docker prod stack running with all fixes applied
- All 5 PCs can reach `http://<server_ip>` and see the login page
- 4 test users already registered (Csinszka, Hajni, Attila, Bernat)

**Step-by-step script for Attila (human tester):**

| Step | PC | Action | Expected | Report to Claude |
|------|-----|--------|----------|-----------------|
| D.1 | All | Open Chrome → `http://<server_ip>` | Login page loads | "All loaded" or which PC fails |
| D.2 | All | Login with respective user | Dashboard appears | "All logged in" or which fails |
| D.3 | PC-2 | Csinszka: Multiplayer → Create Game (multiplication 1-10, 5 Q, penalty 10s, min 2, max 5) | Game code shown, lobby visible | Report game code |
| D.4 | PC-3 | Hajni: Multiplayer → Join → enter game code OR click from list | Lobby visible, sees Csinszka as host | "Joined" or error message |
| D.5 | PC-2 | Csinszka: Check lobby | Hajni appears in player list | "See Hajni" or "Don't see" |
| **CHECKPOINT 1** | | **If D.5 fails → stop, Claude checks logs** | | |
| D.6 | PC-4 | Attila: Join game | Lobby visible | "Joined" |
| D.7 | PC-5 | Bernat: Join game | Lobby visible | "Joined" |
| D.8 | PC-2 | Csinszka: Check lobby | All 3 players visible | "See all 3" or which missing |
| **CHECKPOINT 2** | | **If D.8 fails → stop, Claude checks logs** | | |
| D.9 | PC-3 | Hajni: Send chat "Hello from Hajni!" | Message appears locally | "Sent" |
| D.10 | PC-2 | Csinszka: Check chat | "Hello from Hajni!" visible | "See chat" or "No chat" |
| D.11 | PC-4 | Attila: Check chat | "Hello from Hajni!" visible | "See chat" or "No chat" |
| **CHECKPOINT 3** | | **If D.10/D.11 fail → stop, Claude checks WS logs** | | |
| D.12 | PC-3 | Hajni: Toggle "I'm ready" ON | Switch turns on | "Ready toggled" |
| D.13 | PC-4 | Attila: Toggle "I'm ready" ON | Switch turns on | "Ready toggled" |
| D.14 | PC-5 | Bernat: Toggle "I'm ready" ON | Switch turns on | "Ready toggled" |
| D.15 | PC-2 | Csinszka: Check all players show "Ready" status | All green "Ready" tags | "All ready" or which not ready |
| **CHECKPOINT 4** | | **If D.15 fails → stop, Claude checks logs** | | |
| D.16 | PC-2 | Csinszka: Click "Start Game" | Countdown 10→1 appears on ALL screens | "Countdown on all" or which missing |
| D.17 | All | Wait for countdown to finish | Game starts: host sees dashboard, players see quiz | Report what each screen shows |
| **CHECKPOINT 5** | | **If any PC shows white screen → stop, Claude checks logs** | | |
| D.18 | PC-3 | Hajni: Answer first question | Answer result feedback | "Got feedback" or "Nothing happened" |
| D.19 | PC-2 | Csinszka: Check dashboard | Hajni's answer appears on dashboard | "See answer" or "No update" |
| D.20 | All players | Complete all 5 questions | Players see "Waiting for others" screen | Report each PC status |
| D.21 | All | Game completes → results shown | Podium/results visible | Report each PC |
| D.22 | PC-2 | Csinszka: Click "End Game" | All navigated back to menu | Report each PC |

### Phase E: Claude Code Real-Time Monitoring During LAN Test

While Attila runs Phase D on the LAN PCs, Claude Code simultaneously:

| Monitor | Method | What to look for |
|---------|--------|-----------------|
| **Backend logs** | `docker logs -f openmath-local-prod-api` | `WS_CONNECT`, `BROADCAST`, `CHAT`, `READY`, `GAME_STARTED` events per user |
| **Database state** | SQL queries between checkpoints | Game status, player count, ready flags, answer counts |
| **Container health** | `docker ps` + health status | All 3 containers healthy |
| **WebSocket connections** | Count from backend logs | Expected: 4 active connections during lobby |
| **Error detection** | `docker logs ... \| grep ERROR` | Any Python tracebacks or WS errors |

**Key diagnostic queries Claude Code runs at each checkpoint:**

```sql
-- Checkpoint 1-2: Player roster
SELECT p.slot_number, u.name, p.is_ready, p.joined_at
FROM multiplayer_players p JOIN users u ON p.user_id = u.id
WHERE p.game_id = (SELECT id FROM multiplayer_games WHERE game_code = '<CODE>')
ORDER BY p.slot_number;

-- Checkpoint 3: Chat messages
SELECT u.name, m.message, m.sent_at
FROM multiplayer_chat_messages m JOIN users u ON m.user_id = u.id
WHERE m.game_id = (SELECT id FROM multiplayer_games WHERE game_code = '<CODE>')
ORDER BY m.sent_at;

-- Checkpoint 4: Ready state
SELECT u.name, p.is_ready
FROM multiplayer_players p JOIN users u ON p.user_id = u.id
WHERE p.game_id = (SELECT id FROM multiplayer_games WHERE game_code = '<CODE>');

-- Checkpoint 5: Game status
SELECT status, started_at FROM multiplayer_games WHERE game_code = '<CODE>';

-- Post-game: Full results
SELECT u.name, p.correct_count, p.wrong_count, p.penalty_time_ms,
       p.total_time_ms, p.final_position, p.finished_at
FROM multiplayer_players p JOIN users u ON p.user_id = u.id
WHERE p.game_id = (SELECT id FROM multiplayer_games WHERE game_code = '<CODE>')
ORDER BY p.final_position;
```

---

## 7. Additional Debug Instrumentation

### 7.1 Backend Structured Logging Format

All multiplayer log lines use a consistent prefix for easy grep:

```
[MP] WS_CONNECT game=MATH-XXX user=<uuid> name=Hajni connections=3
[MP] BROADCAST game=MATH-XXX type=player_joined to=2 exclude=<uuid>
[MP] SEND_TO_HOST game=MATH-XXX type=answer_update
[MP] SEND_TO_USER game=MATH-XXX user=<uuid> type=answer_result
[MP] CHAT game=MATH-XXX from=Hajni len=15
[MP] READY game=MATH-XXX user=<uuid> ready=true
[MP] START_GAME game=MATH-XXX players=3 questions=5
[MP] COUNTDOWN game=MATH-XXX tick=10
[MP] GAME_STARTED game=MATH-XXX questions_sent=5
[MP] ANSWER game=MATH-XXX user=<uuid> q=1 correct=true time=1234ms
[MP] GAME_COMPLETED game=MATH-XXX winner=<uuid>
[MP] WS_DISCONNECT game=MATH-XXX user=<uuid> remaining=2
[MP] WS_PING game=MATH-XXX user=<uuid>
[MP] WS_DEAD game=MATH-XXX user=<uuid> (ping failed, removing)
```

### 7.2 Frontend Console Logging Format

```
[WS] Connecting to MATH-XXX...
[WS] Connected (readyState=1)
[WS] → player_ready {ready: true}
[WS] ← chat_broadcast {sender: "Hajni", text: "Hello!"}
[WS] ← game_started {questions: 5}
[WS] → submit_answer {question_id: "...", value: "12"}
[WS] ← answer_result {is_correct: true}
[WS] Connection closed (code=1000, reason="")
[WS] Reconnecting in 1000ms (attempt 1/5)
[WS] Reconnected successfully
```

### 7.3 Database Debug View

Create a convenience SQL view for monitoring active games:

```sql
-- Quick game status check
SELECT g.game_code, g.status,
       COUNT(p.id) as player_count,
       SUM(CASE WHEN p.is_ready THEN 1 ELSE 0 END) as ready_count,
       g.created_at
FROM multiplayer_games g
LEFT JOIN multiplayer_players p ON p.game_id = g.id
WHERE g.status NOT IN ('ended')
GROUP BY g.id
ORDER BY g.created_at DESC;
```

---

## 8. Fix Verification Checklist

After implementing all fixes, verify each original failure is resolved:

| Original Failure | Fix Applied | Verification Method |
|-----------------|-------------|-------------------|
| F1: Games not visible | Debug logs for game list API + verify DB status | Check `GET /api/multiplayer/games` returns game |
| F2: Chat not delivered | `proxy_buffering off` + debug logs | Send chat, check all clients receive within 1s |
| F3: Ready state not syncing | `proxy_buffering off` + debug logs | Toggle ready, check all clients update within 1s |
| F4: White screen after start | `lastGameStarted` cache + remove lobby disconnect | All players see quiz UI after countdown |
| F5: WebSocket unreliability | Reconnection + ping/pong + buffering fix | No silent disconnections during 5-minute game |

---

## 9. Rollback Plan

If fixes introduce new regressions:

1. All changes are on a new git branch (not directly on main)
2. Docker images are tagged with version; previous `latest` images cached locally
3. `docker-compose down && docker-compose up -d` with previous images restores to v4.0

---

## 10. Post-Fix Documentation

After successful LAN test, create:

1. **`docs/test_results_v4.1_multiplayer_lan.md`** — Detailed test results with pass/fail per step
2. **Commit message** referencing all 6 fixes with root cause for each
3. **Update `docs/spec_plan_v4.0_multiplayer.md`** — Add "Known Issues Fixed in v4.1" section

---

## 11. Future Improvements (Post-Fix)

Once multiplayer works reliably on LAN:

| Priority | Improvement |
|----------|------------|
| High | Implement OTEL per `roadmap_observability_otel_monitoring.md` — provides permanent monitoring |
| High | Add connection status indicator in UI (green/yellow/red dot) |
| Medium | Add "Reconnecting..." overlay when WebSocket drops |
| Medium | WebSocket binary frames for lower latency |
| Low | Service Worker for offline resilience |
| Low | WebRTC data channels for peer-to-peer (reduce server load) |
