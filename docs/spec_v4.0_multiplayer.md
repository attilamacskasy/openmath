# OpenMath Specification
## v4.0  Multiplayer Quiz Mode

**Version:** 4.0  
**Status:** Draft Specification  
**Module:** Multiplayer / Real-Time / WebSocket  
**Depends on:** v3.2 (production Docker, backup/restore, DevOps CLI)

---

# 1. Overview

This specification adds **real-time multiplayer quiz support** to OpenMath.
Players compete head-to-head on the same quiz  answering the same questions
under time pressure  while a dedicated host monitors progress on a live
dashboard.

The design is inspired by the multiplayer experiences of classic games:

- **Unreal Tournament**  the menu flow: Create Game  Join Game  History
- **Age of Empires II**  the lobby system: player list, ready checks, chat,
  start when everyone is ready
- **LAN party culture**  local, direct, competitive, social

Any user regardless of role (student, teacher, parent, admin) can **host** or
**join** a game. The host does not participate as a player  they run a
"dedicated server" that controls the game flow and displays the real-time
scoreboard. This mirrors the dedicated server model from competitive gaming.

---

# 2. Goals

1. Add a competitive multiplayer quiz mode with real-time gameplay
2. Support 25 players per game with a lobby and ready-check system
3. Provide a real-time host dashboard showing live player progress
4. Add in-lobby chat for social interaction before, during, and after games
5. Implement a fair penalty system for wrong answers (time-based)
6. Store multiplayer game results for history review
7. Introduce WebSocket infrastructure to FastAPI and Angular (first use)
8. Keep the single-player quiz experience unchanged

---

# 3. Scope

## Included in v4.0

- Multiplayer menu (Create Game, Join Game, History)
- Game creation with quiz configuration (type, difficulty, questions, penalties)
- Lobby with player list, ready check, and chat
- Countdown timer and synchronized game start
- Individual player quiz experience (same questions, timed, penalty system)
- Real-time host dashboard with live position tracking
- Post-game results reveal in lobby
- Game history with replay view
- WebSocket layer (FastAPI  Angular) for all real-time communication
- Database schema for multiplayer games, players, answers, and chat

## Not included in v4.0

- Spectator mode (watch a game without playing)
- Tournament brackets or multi-round competitions
- Cross-internet matchmaking (LAN / same deployment only)
- Voice chat or video
- Team-based games (all players are individual competitors)
- Mobile push notifications for game invites
- Bot players / AI opponents

---

# 4. User Flow

## 4.1 Menu structure

A new top-level menu item **Multiplayer** appears in the sidebar navigation,
available to all authenticated users.

```
┌──────────────────────────────────────────────────────────────────────┐
│  p-menubar (existing sidebar)                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  📊  Start Quiz                                               │  │
│  │  📜  History                                                  │  │
│  │  👤  Profile                                                  │  │
│  │  ─────────────────────────────────────────────────────────     │  │
│  │  🎮  Multiplayer  ◄─── NEW MENU ITEM                         │  │
│  │      ├── 🔍  Join Game                                       │  │
│  │      ├── ➕  Create Game                                     │  │
│  │      └── 📋  History                                         │  │
│  │  ─────────────────────────────────────────────────────────     │  │
│  │  ⚙️  Admin (if admin)                                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Menubar` (primeng/menubar) — existing sidebar, add new `MenuItem` group
> - `MenuItem` with `items` sub-array for the Multiplayer submenu entries
> - PrimeIcons: `pi-users` (Multiplayer), `pi-search` (Join), `pi-plus` (Create), `pi-history` (History)

### MultiplayerMenuComponent — landing page

Clicking the **Multiplayer** menu item navigates to `/multiplayer`, which
shows a three-button landing page:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  p-card  header: "Multiplayer"  subheader: "Real-time competitive quizzes"  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CSS Grid (3 columns, gap: 1.5rem)                                           │
│                                                                              │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐  │
│  │ p-card (clickable)   │ │ p-card (clickable)   │ │ p-card (clickable)   │  │
│  │ styleClass=          │ │ styleClass=          │ │ styleClass=          │  │
│  │ "surface-card        │ │ "surface-card        │ │ "surface-card        │  │
│  │  hover:surface-hover │ │  hover:surface-hover │ │  hover:surface-hover │  │
│  │  cursor-pointer"     │ │  cursor-pointer"     │ │  cursor-pointer"     │  │
│  │                      │ │                      │ │                      │  │
│  │   ┌──────────────┐   │ │   ┌──────────────┐   │ │   ┌──────────────┐   │  │
│  │   │  pi-search   │   │ │   │  pi-plus     │   │ │   │  pi-history  │   │  │
│  │   │  (3rem icon) │   │ │   │  (3rem icon) │   │ │   │  (3rem icon) │   │  │
│  │   └──────────────┘   │ │   └──────────────┘   │ │   └──────────────┘   │  │
│  │                      │ │                      │ │                      │  │
│  │   Join Game          │ │   Create Game        │ │   History            │  │
│  │                      │ │                      │ │                      │  │
│  │   span.text-sm       │ │   span.text-sm       │ │   span.text-sm       │  │
│  │   "Find and join     │ │   "Host a new        │ │   "View previous     │  │
│  │    an open game"     │ │    multiplayer game"  │ │    game results"     │  │
│  │                      │ │                      │ │                      │  │
│  └──────────────────────┘ └──────────────────────┘ └──────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Card` (primeng/card) — outer container with header/subheader
> - `Card` (primeng/card) ×3 — clickable action cards with hover effect, each containing icon + title + description
> - PrimeIcons (3rem): `pi-search` (Join), `pi-plus` (Create), `pi-history` (History)
> - CSS Grid `grid-template-columns: repeat(3, 1fr)` — responsive layout (stacks on mobile)
> - `routerLink` on each card for navigation to `/multiplayer/join`, `/multiplayer/create`, `/multiplayer/history`

## 4.2 Create Game (host flow)

The host configures the game using the same quiz parameter controls as the
single-player Start page, plus multiplayer-specific settings.

### Configuration form

| Field | Type | Options | Default |
|---|---|---|---|
| **Quiz Type** | Dropdown | All active quiz types | First available |
| **Difficulty** | Dropdown | Easy / Medium / Hard | Medium |
| **Learned Timetables** | Multi-select | 112 (if applicable to quiz type) | All |
| **Number of Questions** | Radio group | 5 (Quick) / 10 (Normal) / 20 (Marathon) | 10 |
| **Wrong Answer Penalty** | Radio group | 5 sec / 10 sec / 20 sec | 10 sec |
| **Min Players** | Number input | 25 | 2 |
| **Max Players** | Number input | 2–5 (≥ min) | 5 |

### Screen mockup

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  p-card                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  header: "Create Multiplayer Game"                    🎮 MULTIPLAYER  │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                       │   │
│  │  ┌─── Quiz Configuration ──────────────────────────────────────────┐  │   │
│  │  │                                                                 │  │   │
│  │  │  Quiz Type          ┌──────────────────────────────┐            │  │   │
│  │  │  p-dropdown         │ Multiplication           ▼  │            │  │   │
│  │  │                     └──────────────────────────────┘            │  │   │
│  │  │                                                                 │  │   │
│  │  │  Difficulty          ┌──────────────────────────────┐           │  │   │
│  │  │  p-dropdown          │ Medium                   ▼  │           │  │   │
│  │  │                      └──────────────────────────────┘           │  │   │
│  │  │                                                                 │  │   │
│  │  │  Learned Timetables  ┌──────────────────────────────┐           │  │   │
│  │  │  p-multiSelect       │ 1, 2, 3, 4, 5 ... +7 more  │           │  │   │
│  │  │                      └──────────────────────────────┘           │  │   │
│  │  └─────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  │  ┌─── Game Settings ──────────────────────────────────────────────┐   │   │
│  │  │                                                                │   │   │
│  │  │  Questions   p-selectButton                                    │   │   │
│  │  │  ┌─────────┬──────────┬─────────────┐                          │   │   │
│  │  │  │ 5 Quick │ 10 Normal│ 20 Marathon  │                         │   │   │
│  │  │  └─────────┴──────────┴─────────────┘                          │   │   │
│  │  │                                                                │   │   │
│  │  │  Penalty     p-selectButton                                    │   │   │
│  │  │  ┌─────────┬──────────┬─────────────┐                          │   │   │
│  │  │  │  5 sec  │  10 sec  │   20 sec    │                          │   │   │
│  │  │  └─────────┴──────────┴─────────────┘                          │   │   │
│  │  │                                                                │   │   │
│  │  │  Players     p-inputNumber (min)    p-inputNumber (max)        │   │   │
│  │  │              ┌──────┐               ┌──────┐                   │   │   │
│  │  │  Min:        │  2   │    Max:       │  5   │                   │   │   │
│  │  │              └──────┘               └──────┘                   │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │  ┌─── Question Preview ───────────────────────────────────────────┐   │   │
│  │  │  p-card (nested, light background)                             │   │   │
│  │  │                                                                │   │   │
│  │  │   Example 1:   7 × 8 = ?          p-tag severity="info"        │   │   │
│  │  │   Example 2:   12 × 6 = ?         p-tag severity="info"        │   │   │
│  │  │   Example 3:   9 × 11 = ?         p-tag severity="info"        │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │  p-button severity="success" icon="pi pi-play"                 │   │   │
│  │  │  ┌──────────────────────────────────────────────────────┐      │   │   │
│  │  │  │           🎮  Start Dedicated Game                   │      │   │   │
│  │  │  └──────────────────────────────────────────────────────┘      │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Card` (primeng/card) — outer container with header "Create Multiplayer Game"
> - `Dropdown` (primeng/dropdown) — Quiz Type selector, Difficulty selector
> - `MultiSelect` (primeng/multiselect) — Learned Timetables (1–12 chips)
> - `SelectButton` (primeng/selectbutton) — Questions count (5/10/20), Penalty (5s/10s/20s)
> - `InputNumber` (primeng/inputnumber) — Min/Max players with min/max constraints
> - `Card` (nested) — Question Preview panel with light surface background
> - `Tag` (primeng/tag) — example question labels with `severity="info"`
> - `Button` (primeng/button) — "Start Dedicated Game" with `severity="success"`, `icon="pi pi-play"`
> - `Toast` (primeng/toast) — success/error feedback
> - `ProgressSpinner` (primeng/progressspinner) — loading state during game creation

Below the configuration, a **preview panel** shows 2–3 example questions for
the selected quiz type and difficulty — identical to the single-player Start
page preview.

**[Start Dedicated Game]** button creates the game and transitions the host to
the Lobby Dashboard.

> **Important:** The host does NOT play. They are the dedicated server operator.
> This is a deliberate design choice — it encourages teachers and parents to
> host games for students, and it keeps the host role focused on managing the
> experience.

## 4.3 Lobby Dashboard (pre-game)

After creating or joining a game, all participants see the Lobby.

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  p-toolbar                                                                                   │
│  Multiplayer Lobby — Multiplication Quiz (Medium)                                            │
│  Questions: 10  ·  Penalty: 10 sec  ·  Game Code: MATH-7X2                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  CSS flex (2 columns: 60% players / 40% chat)                                                │
│                                                                                              │
│  ┌─── Players ──────────────────────────────────┐  ┌─── Chat ──────────────────────────────┐ │
│  │                                               │  │                                       │ │
│  │  p-table [value]="players"                    │  │  div.chat-messages (scrollable)        │ │
│  │                                               │  │                                       │ │
│  │  ┌───────┬────┬──────────┬─────────┐          │  │  ┌─────────────────────────────────┐  │ │
│  │  │ Ready │ #  │ Name     │ Role    │          │  │  │  Attila: let's go!              │  │ │
│  │  ├───────┼────┼──────────┼─────────┤          │  │  │  Csinszka: ready! 💪            │  │ │
│  │  │  🟢✔  │  1 │ Attila   │ Student │          │  │  │  Host: waiting for Bernát...    │  │ │
│  │  ├───────┼────┼──────────┼─────────┤          │  │  │  Hajni: just joined!            │  │ │
│  │  │  🟢✔  │  2 │ Csinszka │ Student │          │  │  │                                 │  │ │
│  │  ├───────┼────┼──────────┼─────────┤          │  │  │                                 │  │ │
│  │  │  🔴✖  │  3 │ Bernát   │ Student │          │  │  └─────────────────────────────────┘  │ │
│  │  ├───────┼────┼──────────┼─────────┤          │  │                                       │ │
│  │  │  🟢✔  │  4 │ Hajni    │ Parent  │          │  │  p-inputGroup                         │ │
│  │  ├───────┼────┼──────────┼─────────┤          │  │  ┌───────────────────────┬───────────┐│ │
│  │  │       │  5 │ (open)   │  ———    │          │  │  │ p-inputText           │ p-button  ││ │
│  │  │       │    │ p-tag    │         │          │  │  │ placeholder="Type a   │ "Send"    ││ │
│  │  │       │    │ "Waiting"│         │          │  │  │ message..."           │ pi-send   ││ │
│  │  └───────┴────┴──────────┴─────────┘          │  │  └───────────────────────┴───────────┘│ │
│  │                                               │  │                                       │ │
│  │  Ready column legend:                         │  └───────────────────────────────────────┘ │
│  │  🟢✔ = green circle, white checkmark (ready)  │                                           │
│  │  🔴✖ = red circle, white cross (not ready)    │                                           │
│  │                                               │                                           │
│  └───────────────────────────────────────────────┘                                           │
│                                                                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Actions                                                                                     │
│                                                                                              │
│  PLAYER VIEW:                                                                                │
│  ┌──────────────────────────────────────────┐                                                │
│  │  p-inputSwitch [(ngModel)]="isReady"     │                                                │
│  │  label: "I am ready!"                    │                                                │
│  │  (toggles 🟢✔ / 🔴✖ in player table)     │                                                │
│  └──────────────────────────────────────────┘                                                │
│                                                                                              │
│  HOST VIEW:                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐     │
│  │  p-button severity="success" icon="pi pi-play"  [disabled]="!allReadyAndMinMet"     │     │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐      │     │
│  │  │  🎮  Start Game                                                           │      │     │
│  │  └────────────────────────────────────────────────────────────────────────────┘      │     │
│  │  span.text-sm.text-secondary: "Disabled until all players are ready"                │     │
│  └──────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  footer                                                                                      │
│  ┌───────────────────────────────────────┐                                                   │
│  │  p-button severity="danger"          │                                                   │
│  │  icon="pi pi-sign-out"               │                                                   │
│  │  🚪 Leave Game                       │                                                   │
│  └───────────────────────────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Toolbar` (primeng/toolbar) — header bar with game name, quiz config summary, game code
> - `Table` (primeng/table) — player list with Ready, #, Name, Role columns
> - Custom CSS icons in Ready column:
>   - **Ready:** green circle (`background: #22C55E; border-radius: 50%`) with white `pi-check` icon
>   - **Not ready:** red circle (`background: #EF4444; border-radius: 50%`) with white `pi-times` icon
> - `Tag` (primeng/tag) — "Waiting" placeholder for open slots (`severity="secondary"`)
> - `InputSwitch` (primeng/inputswitch) — player's ready toggle (bound to WebSocket `player_ready` message)
> - `InputGroup` (primeng/inputgroup) — chat message input + send button
> - `InputText` (primeng/inputtext) — chat text field
> - `Button` (primeng/button) — "Start Game" (`severity="success"`, `icon="pi pi-play"`, `[disabled]`), "Send" (`icon="pi pi-send"`), "Leave Game" (`severity="danger"`, `icon="pi pi-sign-out"`)
> - `ConfirmDialog` (primeng/confirmdialog) — confirmation before leaving the game

### Ready check rules

- Each player toggles **"I am ready!"** via `p-inputSwitch` — visible to everyone in real-time as 🟢✔ / 🔴✖ icons
- The host sees the **[Start Game]** button, which is disabled until:
  - At least `min_players` have joined
  - All joined players show 🟢✔ (ready)
- If a player toggles back to not ready (🔴✖), [Start Game] disables again
- If a player leaves, their slot opens and shows "Waiting" tag

### Chat

- All participants (host + players) can send messages
- Messages are real-time via WebSocket
- Chat persists into the post-game review and game history
- Messages are plain text, max 200 characters
- No profanity filter in v4.0 (revisit if needed)

## 4.4 Game start — countdown

When the host clicks **[Start Game]**:

1. All players' "ready" toggles lock
2. A full-screen animated countdown appears on every participant's screen:
   **10 → 9 → 8 → ... → 3 → 2 → 1 → GO!**
3. The countdown is synchronized via WebSocket (server sends each tick)
4. At "GO!" — players transition to the quiz view, host transitions to the
   live dashboard

### Countdown overlay mockup

```
┌────────────────────────────────────────────────────────────────────┐
│  div.countdown-overlay (position: fixed, z-index: 9999)       │
│  background: rgba(0, 0, 0, 0.85)                              │
│                                                                │
│                                                                │
│                                                                │
│                                                                │
│               ┌──────────────────────────┐                 │
│               │                          │                 │
│               │     span.countdown       │                 │
│               │     font-size: 12rem      │                 │
│               │     color: #FFFFFF         │                 │
│               │     animation: pulse       │                 │
│               │                          │                 │
│               │           7              │                 │
│               │                          │                 │
│               └──────────────────────────┘                 │
│                                                                │
│               ┌──────────────────────────┐                 │
│               │  p-progressBar             │                 │
│               │  [value]="progress"        │                 │
│               │  [showValue]="false"       │                 │
│               │  ████████████░░░░░░░░░░░░  │                 │
│               └──────────────────────────┘                 │
│                                                                │
│               span.subtitle                                    │
│               "Get ready..."                                    │
│                                                                │
└────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `ProgressBar` (primeng/progressbar) — shrinking bar under the countdown number
> - Custom CSS animation (`@keyframes pulse`) for the countdown number scale bounce
> - No PrimeNG dialog — pure CSS overlay for maximum visual control
> - Angular `@if` / `@switch` for countdown states (number, "GO!", transition)

## 4.5 Player game experience

During the game, each player sees a view similar to the single-player quiz
but with additional multiplayer elements:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  p-card  header: "Multiplayer Quiz"              p-tag "MULTIPLAYER"  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  span.question-counter                                                    │
│  "Question 4 of 10"                                                       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  p-card (nested, styleClass="surface-100")                            │  │
│  │                                                                      │  │
│  │                         7 × 8 = ?                                    │  │
│  │                    (KaTeX rendered via KatexPipe)                     │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  p-inputGroup (centered)                                                  │
│  ┌────────────────────────────────────┬─────────────────┐                  │
│  │  p-inputText / p-inputNumber     │  p-button        │                  │
│  │  autofocus, size="lg"             │  icon="pi pi-send"│                  │
│  │  placeholder="Your answer"        │  "Submit"        │                  │
│  └────────────────────────────────────┴─────────────────┘                  │
│                                                                          │
│  ┌─── Timer Bar ───────────────────────────────────────────────────┐  │
│  │  p-toolbar (dense)                                                │  │
│  │                                                                  │  │
│  │  ┌───────────────┐  ┌──────────────────┐  ┌─────────────────┐  │  │
│  │  │ ⏱ Time       │  │ ⏱ Penalty       │  │ ⏱ Total         │  │  │
│  │  │   00:32      │  │   +10s          │  │   00:42         │  │  │
│  │  │  p-tag info  │  │  p-tag danger   │  │  p-tag success  │  │  │
│  │  └───────────────┘  └──────────────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Progress (question indicators)                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐  │  │
│  │  │ ✅ │ │ ✅ │ │ ❌ │ │ ■  │ │ □  │ │ □  │ │ □  │ │ □  │ │ □  │ │ □  │  │  │
│  │  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘  │  │
│  │   1     2     3    [4]    5     6     7     8     9    10   │  │
│  │  p-tag  p-tag p-tag p-tag                                      │  │
│  │  success success danger  (current, outlined, pulsing)           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Card` (primeng/card) — outer quiz container with header, nested card for question display
> - `Tag` (primeng/tag) — "MULTIPLAYER" badge (`severity="warn"`), timer values (info/danger/success), progress indicators per question
> - `InputGroup` (primeng/inputgroup) — wraps answer input + submit button
> - `InputText` (primeng/inputtext) or `InputNumber` (primeng/inputnumber) — answer field (type depends on quiz type)
> - `Button` (primeng/button) — "Submit" with `icon="pi pi-send"`
> - `Toolbar` (primeng/toolbar) — timer bar layout (Time | Penalty | Total)
> - `KatexPipe` (custom) — renders math expressions in the question card
> - CSS `@keyframes` — red flash animation on penalty, pulse on current question indicator

### Key differences from single-player

| Aspect | Single-player | Multiplayer |
|---|---|---|
| Timer | Not displayed (tracked server-side) | Prominently displayed  elapsed time + penalty |
| Penalty | None | Wrong answer adds penalty seconds to total time |
| Competitor info | N/A | **Not shown during play** (no distraction) |
| Question set | Generated per session | Same questions for all players (identical seed) |
| Completion | Finishes at own pace | Finishes at own pace (no waiting for others) |

### Penalty system

When a player submits a **wrong answer**:

1. The penalty time (5/10/20 seconds) is added to their cumulative penalty
2. The penalty counter updates visually with a red flash animation
3. The player proceeds to the next question immediately (no retry)
4. The wrong answer is recorded with the penalty attached

**Fair penalty calibration:**

| Penalty | Best for | Average response time context |
|---|---|---|
| 5 sec | Easy difficulty | Average correct answer ~35 sec |
| 10 sec | Medium difficulty | Average correct answer ~510 sec |
| 20 sec | Hard difficulty | Average correct answer ~1020 sec |

The penalty is designed to cost roughly 12 question-lengths of time, making
accuracy as important as speed without being so punishing that one mistake
eliminates a player.

### Same questions for all players

All players receive the **exact same questions in the same order**. The
question set is generated once at game creation (using the existing
`generate_questions()` service) and stored in the database. Each player's
answers are tracked independently.

## 4.6 Host live dashboard

The host sees a real-time scoreboard that updates as players answer questions:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  p-toolbar                                                                                   │
│  MULTIPLAYER LIVE DASHBOARD                                          ⏱ Elapsed: 01:24       │
│  Multiplication Quiz (Medium)  ·  10 Questions  ·  Penalty: 10 sec  ·  Game Code: MATH-7X2  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  p-table [frozenColumns]="['pos','name']" scrollDirection="horizontal"                       │
│                                                                                              │
│  ┌─────┬──────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬────┬────┬────┐
│  │ Pos │ Name     │  Q1     │  Q2     │  Q3     │  Q4     │  Q5     │  Q6     │ Q7 │ Q8 │...│
│  │     │ (Total)  │         │         │         │         │         │         │    │    │   │
│  ├─────┼──────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────┼────┼────┤
│  │     │          │  🟢✔    │  🟢✔    │  🟢✔    │  🟢✔    │  🟢✔    │  🟢✔    │    │    │   │
│  │  1  │ Csinszka │  00:03  │  00:06  │  00:11  │  00:18  │  00:25  │  00:35  │    │    │   │
│  │     │ (00:48)  │         │         │         │         │         │         │    │    │   │
│  ├─────┼──────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────┼────┼────┤
│  │     │          │  🟢✔    │  🟢✔    │  🔴✖    │  🟢✔    │  🟢✔    │         │    │    │   │
│  │  2  │ Hajni    │  00:04  │  00:09  │  00:18  │  00:30  │  00:42  │         │    │    │   │
│  │     │ (01:02)  │         │         │  +10s   │         │         │         │    │    │   │
│  ├─────┼──────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────┼────┼────┤
│  │     │          │  🟢✔    │  🔴✖    │  🟢✔    │  🟢✔    │         │         │    │    │   │
│  │  3  │ Attila   │  00:05  │  00:12  │  00:25  │  00:39  │         │         │    │    │   │
│  │     │ (01:09)  │         │  +10s   │         │         │         │         │    │    │   │
│  ├─────┼──────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────┼────┼────┤
│  │     │          │  🟢✔    │  🟢✔    │  🔴✖    │         │         │         │    │    │   │
│  │  4  │ Bernát   │  00:08  │  00:20  │  00:35  │         │         │         │    │    │   │
│  │     │ (01:15)  │         │         │  +10s   │         │         │         │    │    │   │
│  └─────┴──────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴────┴────┴────┘
│                                                                                              │
│  Cell contents legend:                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐     │
│  │  🟢✔  = green circle, white checkmark icon    (correct answer)                      │     │
│  │  🔴✖  = red circle, white cross icon           (wrong answer)                       │     │
│  │  00:XX = cumulative lap time (p-tag severity="info")                                 │     │
│  │  +10s  = penalty time added (p-tag severity="danger", red text)                      │     │
│  │  empty = question not yet answered                                                   │     │
│  └──────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Chat                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐     │
│  │  Host: Good luck everyone!                                                           │     │
│  │  Attila: thanks!                                                                     │     │
│  │  Csinszka: 💪                                                                        │     │
│  └──────────────────────────────────────────────────────────────────────────────────────┘     │
│  p-inputGroup                                                                                │
│  ┌──────────────────────────────────────────────────────────────────┬───────────────────┐     │
│  │  p-inputText  placeholder="Type a message..."                   │  p-button "Send"  │     │
│  └──────────────────────────────────────────────────────────────────┴───────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Toolbar` (primeng/toolbar) — game info header bar (title, quiz type, questions, penalty, elapsed timer, game code)
> - `Table` (primeng/table) — main scoreboard with `[frozenColumns]` for Pos + Name, horizontal scroll for 20-question games, `scrollDirection="horizontal"`
> - `Tag` (primeng/tag) — lap times (`severity="info"`), penalties (`severity="danger"`), player total time
> - Custom CSS icons in each cell:
>   - **Correct:** green circle (`background: #22C55E; border-radius: 50%`) with white `pi-check` icon inside
>   - **Wrong:** red circle (`background: #EF4444; border-radius: 50%`) with white `pi-times` icon inside
>   - Both rendered as `<span class="answer-icon correct/wrong"><i class="pi pi-check/pi-times"></i></span>`
> - `InputGroup` (primeng/inputgroup) — chat message input + send button
> - `InputText` (primeng/inputtext) — chat text field
> - `Button` (primeng/button) — "Send" chat button with `icon="pi pi-send"`

### Dashboard behavior

- **Position** — automatically sorted by: (1) most questions completed,
  (2) lowest total time (elapsed + penalty) as tiebreaker
- **Correct answer** — 🟢✔ green circle with white checkmark icon (`pi-check`,
  reminiscent of the OpenMath logo "eye" motif)
- **Wrong answer** — 🔴✖ red circle with white cross icon (`pi-times`)
- **Lap time** — displayed below each answer indicator (cumulative time at
  that question) as `p-tag severity="info"`
- **Penalty indicator** — red text `+05s` / `+10s` / `+20s` shown below the
  wrong answer's lap time as `p-tag severity="danger"`
- **Player total time** — shown in parentheses below player name, updates in
  real-time
- **Questions should fit on one screen** — 5/10/20 columns are all feasible
  in a horizontal table layout. For 20 questions on smaller screens, the table
  scrolls horizontally with the position and name columns frozen (`[frozenColumns]`)

### Host controls during game

The host can:
- Send chat messages (encouragement, commentary)
- See all real-time progress
- **Cannot** interfere with the game (no pause, no kick  game runs to
  completion once started)

## 4.7 Game completion

The game ends when **all players have answered all questions**.

When the last player finishes:

1. All participants return to the Lobby view
2. The **Live Dashboard table** is revealed to all players — everyone can now
   see positions, lap times, penalties, and final results
3. The chat remains active — players can discuss the results
4. A **podium animation** highlights the top 3 finishers (🥇 🥈 🥉)
5. The host sees an **[End Game]** button

### Post-game results mockup

```
┌────────────────────────────────────────────────────────────────────────────┐
│  p-card  header: "Game Complete!"                                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Podium (CSS animation: scale + fade-in, staggered)                       │
│                                                                          │
│                    ┌──────────────┐                                    │
│                    │  🥇 1st       │                                    │
│                    │  Csinszka     │                                    │
│                    │  00:48        │                                    │
│                    │  10/10  100%  │                                    │
│          ┌─────────┴──────────────┴─────────┐                      │
│          │  🥈 2nd                      │                      │
│          │  Hajni            01:02      │                      │
│          │  8/10   80%                  │                      │
│  ┌───────┴─────────────────────────────┴──────────┐            │
│  │  🥉 3rd                                        │            │
│  │  Attila                        01:09           │            │
│  │  9/10   90%                                    │            │
│  └────────────────────────────────────────────────┘            │
│                                                                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Full results table (same as Host Dashboard §4.6)                          │
│  p-table with all columns: Pos, Name, Total, Q1..Q10                      │
│  • 1st place row: styleClass="bg-yellow-100" (gold highlight)              │
│  • Current user row: styleClass="font-bold surface-100"                    │
│                                                                          │
│  HOST / TEACHER / ADMIN:                                                   │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  p-checkbox  label="Show actual answers (not just ✅/❌)"            │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                          │
├────────────────────────────────────────────────────────────────────────────┤
│  Chat panel + p-inputGroup (same as lobby §4.3)                             │
├────────────────────────────────────────────────────────────────────────────┤
│  footer (HOST ONLY)                                                        │
│  ┌───────────────────────────────────────┐                                   │
│  │  p-button severity="danger"          │                                   │
│  │  icon="pi pi-stop-circle"             │                                   │
│  │  🛑 End Game                          │                                   │
│  └───────────────────────────────────────┘                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Card` (primeng/card) — "Game Complete!" container
> - Custom CSS podium layout with staggered `@keyframes` animation (scale-in, gold/silver/bronze colors)
> - `Table` (primeng/table) — full results table (reused from Host Dashboard, now visible to all)
> - `Checkbox` (primeng/checkbox) — "Show actual answers" toggle for teachers/admins
> - `Button` (primeng/button) — "End Game" with `severity="danger"`, `icon="pi pi-stop-circle"` (host only)
> - `ConfirmDialog` (primeng/confirmdialog) — confirmation before ending the game
> - `Tag` (primeng/tag) — position badges with medal emoji and time/accuracy stats
> - Chat panel reuses lobby chat components

### Final results table (revealed to all)

The same dashboard table from section 4.6, but now visible to all players
with these additions:

- **Winner highlighted** — gold background (`styleClass="bg-yellow-100"`)
- **Personal stats** — each player sees their own row highlighted
- **Teachers/admins** — can toggle a `p-checkbox` **"Show actual answers"** to
  see the actual values submitted (not just ✅/❌)

When the host clicks **[End Game]**:
- The lobby closes
- All participants return to the Multiplayer menu
- The game is saved to history

## 4.8 Join Game

The Join Game page shows a list of available (waiting) games on the network.

```
┌────────────────────────────────────────────────────────────────────────┐
│  p-card  header: "Find Games"                                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  p-inputGroup  (Join by code)                                            │
│  ┌────────────────────────────────────────┬────────────────────────┐   │
│  │ p-inputText                            │ p-button                 │   │
│  │ placeholder="Enter game code MATH-..."  │ icon="pi pi-sign-in"     │   │
│  │                                          │ label="Join"             │   │
│  └────────────────────────────────────────┴────────────────────────┘   │
│                                                                        │
│  p-divider                                                               │
│  ─────────────────  OR browse available games  ─────────────────  │
│                                                                        │
│  p-table [value]="availableGames" selectionMode="single"                  │
│  [globalFilterFields]="['gameCode','quizTypeName']"                       │
│                                                                        │
│  ┌──────────┬──────────────────────┬───────┬────┬──────────┬─────────┐  │
│  │ Code     │ Quiz Type            │ Diff  │ Qs │ Players  │ Action  │  │
│  ├──────────┼──────────────────────┼───────┼────┼──────────┼─────────┤  │
│  │ MATH-7X2 │ Multiplication       │ Med   │ 10 │ 3/5      │ [Join]  │  │
│  │          │ p-tag info           │ p-tag │    │ p-tag    │ p-btn   │  │
│  │          │                      │ warn  │    │ success  │         │  │
│  ├──────────┼──────────────────────┼───────┼────┼──────────┼─────────┤  │
│  │ MATH-A3K │ Addition & Subtract  │ Easy  │  5 │ 1/3      │ [Join]  │  │
│  ├──────────┼──────────────────────┼───────┼────┼──────────┼─────────┤  │
│  │ MATH-P9Q │ Division             │ Hard  │ 20 │ 2/2 FULL │  ───   │  │
│  │          │                      │ p-tag │    │ p-tag    │ (dis-   │  │
│  │          │                      │ danger│    │ danger   │  abled)  │  │
│  └──────────┴──────────────────────┴───────┴────┴──────────┴─────────┘  │
│                                                                        │
│  p-toolbar (footer)                                                      │
│  ┌────────────────────────┬─────────────────────────────────────┐   │
│  │ p-button icon="pi       │                                     │   │
│  │ pi-refresh"              │  span: "3 games available"           │   │
│  │ label="Refresh"          │  (auto-refreshes every 5 seconds)    │   │
│  └────────────────────────┴─────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Card` (primeng/card) — outer container with header "Find Games"
> - `InputGroup` (primeng/inputgroup) — game code entry field + join button
> - `InputText` (primeng/inputtext) — code entry with placeholder and uppercase transform
> - `Table` (primeng/table) — available games list with `selectionMode="single"`, `[globalFilterFields]` for search, sortable columns
> - `Tag` (primeng/tag) — quiz type (`info`), difficulty (`warn`/`danger`), player count (`success`/`danger` for full)
> - `Button` (primeng/button) — per-row "Join" (`icon="pi pi-sign-in"`), "Refresh" (`icon="pi pi-refresh"`), disabled for full games
> - `Divider` (primeng/divider) — visual separator between code entry and game list
> - `Toolbar` (primeng/toolbar) — footer with refresh button + game count
> - `Toast` (primeng/toast) — error feedback ("Game is full", "Game not found")

- Games in "waiting" (lobby) state are listed
- Full games are shown but not joinable (join button disabled, player tag = `danger`)
- Games already in progress are not shown
- A player can also join by typing the game code directly
- Clicking a game row or entering a code transitions to the Lobby
- Auto-refresh every 5 seconds via `setInterval` (with manual refresh button)

## 4.9 History

The History page shows completed multiplayer games.

### Visibility rules

| Role | Can see |
|---|---|
| **Admin** | All multiplayer games |
| **Teacher** | Games they hosted + games their assigned students played in |
| **Parent** | Games they hosted + games their assigned children played in |
| **Student** | Games they hosted or played in |

### History list mockup

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  p-card  header: "Multiplayer History"                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  p-table [value]="games" [paginator]="true" [rows]="10"                    │
│  sortField="createdAt" sortOrder="-1"                                      │
│                                                                          │
│  ┌────────────┬──────────┬────────────────┬─────────┬──────────────────┐  │
│  │ Date       │ Code     │ Quiz Type      │ Players │ Winner            │  │
│  │ (sortable) │          │ (p-tag info)   │         │ (p-tag success)   │  │
│  ├────────────┼──────────┼────────────────┼─────────┼──────────────────┤  │
│  │ 2026-03-13 │ MATH-7X2 │ Multiplication │    4    │ 🥇 Csinszka 00:48 │  │
│  ├────────────┼──────────┼────────────────┼─────────┼──────────────────┤  │
│  │ 2026-03-12 │ MATH-A3K │ Addition       │    3    │ 🥇 Attila   00:31 │  │
│  ├────────────┼──────────┼────────────────┼─────────┼──────────────────┤  │
│  │ 2026-03-10 │ MATH-P9Q │ Division       │    2    │ 🥇 Bernát   01:12 │  │
│  └────────────┴──────────┴────────────────┴─────────┴──────────────────┘  │
│                                                                          │
│  p-paginator [rows]="10" [rowsPerPageOptions]="[5, 10, 25]"               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ◀  1  2  3  ▶       Showing 1–10 of 23  |  Rows per page: [10 ▼] │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

> **PrimeNG components:**
> - `Card` (primeng/card) — outer container with header "Multiplayer History"
> - `Table` (primeng/table) — paginated game list with `[paginator]`, `[sortField]`, sortable date column, row click navigates to detail
> - `Tag` (primeng/tag) — quiz type name (`info`), winner name + time (`success`)
> - Built-in paginator from p-table with `[rowsPerPageOptions]`
> - `Tooltip` (primeng/tooltip) — hover on game code to see more details

### History detail (click into a game)

Shows the same view as the post-game reveal (§4.7):
- Full results table with positions, lap times, penalties (reused `HostDashboardComponent` in read-only mode)
- Chat transcript (scrollable, read-only)
- Teachers/admins can toggle `p-checkbox` "Show actual answers"

---

# 5. WebSocket Architecture

## 5.1 Why WebSocket

The multiplayer feature requires real-time bidirectional communication:

| Interaction | HTTP polling viable? | WebSocket needed? |
|---|---|---|
| Lobby player join/leave | Slow, wasteful |  Instant updates |
| Ready check toggle | Slow |  Instant |
| Chat messages | Possible but laggy |  Instant |
| Countdown sync |  Too slow for 1-sec ticks |  Required |
| Answer submission + dashboard update | Slow, race conditions |  Required |
| Position reordering |  |  Required |

## 5.2 FastAPI WebSocket implementation

FastAPI has built-in WebSocket support via Starlette.

```python
# python-api/app/routers/multiplayer_ws.py
from fastapi import WebSocket, WebSocketDisconnect
from app.services.multiplayer import GameManager

manager = GameManager()

@router.websocket("/ws/game/{game_code}")
async def game_websocket(websocket: WebSocket, game_code: str):
    """Single WebSocket endpoint per game. All messages routed by type."""
    user = await authenticate_websocket(websocket)  # JWT from query param
    await manager.connect(game_code, user, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(game_code, user, data)
    except WebSocketDisconnect:
        await manager.disconnect(game_code, user)
```

## 5.3 Message protocol

All WebSocket messages follow a consistent JSON envelope:

```json
{
  "type": "message_type",
  "payload": { ... },
  "timestamp": "2026-03-13T14:30:00Z"
}
```

### Client  Server messages

| Type | Payload | When |
|---|---|---|
| `player_ready` | `{ ready: true/false }` | Player toggles ready in lobby |
| `chat_message` | `{ text: "..." }` | Any participant sends chat |
| `submit_answer` | `{ question_id: int, value: "..." }` | Player submits answer during game |
| `start_game` | `{}` | Host starts the game (after all ready) |
| `end_game` | `{}` | Host ends the game (post-results) |

### Server  Client messages (broadcast to all in game)

| Type | Payload | When |
|---|---|---|
| `player_joined` | `{ player: { id, name, role } }` | Someone joins lobby |
| `player_left` | `{ player_id: int }` | Someone leaves lobby |
| `player_ready_changed` | `{ player_id: int, ready: bool }` | Ready toggle |
| `chat_broadcast` | `{ sender: str, text: str, time: str }` | Chat message |
| `countdown_tick` | `{ value: int }` | 10, 9, 8, ... 1, 0 |
| `game_started` | `{ questions: [...] }` | Game begins  includes questions |
| `answer_update` | `{ player_id, question_pos, is_correct, lap_time, penalty, total_time }` | Player answered (host dashboard) |
| `position_update` | `{ positions: [{ player_id, pos, total_time, completed }] }` | Recalculated after each answer |
| `game_completed` | `{ results: [...] }` | All players finished |
| `game_ended` | `{}` | Host ended the game  return to menu |

### Message routing

| Message | Sent to |
|---|---|
| `player_joined/left/ready_changed` | All participants |
| `chat_broadcast` | All participants |
| `countdown_tick` | All participants |
| `game_started` | All participants (questions in payload) |
| `answer_update` | Host only (players should not see others' progress) |
| `position_update` | Host only |
| `game_completed` | All participants (full results revealed) |

## 5.4 Angular WebSocket service

```typescript
// angular-app/src/app/core/services/multiplayer-ws.service.ts
@Injectable({ providedIn: 'root' })
export class MultiplayerWsService {
  private socket$ = signal<WebSocket | null>(null);
  private messages$ = new Subject<GameMessage>();

  connect(gameCode: string, token: string): void {
    const ws = new WebSocket(
      `${environment.wsUrl}/ws/game/${gameCode}?token=${token}`
    );
    ws.onmessage = (event) => {
      this.messages$.next(JSON.parse(event.data));
    };
    this.socket$.set(ws);
  }

  send(type: string, payload: any): void {
    this.socket$()?.send(JSON.stringify({ type, payload }));
  }

  onMessage(type: string): Observable<any> {
    return this.messages$.pipe(
      filter(msg => msg.type === type),
      map(msg => msg.payload)
    );
  }

  disconnect(): void {
    this.socket$()?.close();
    this.socket$.set(null);
  }
}
```

## 5.5 Authentication

WebSocket connections authenticate via JWT token passed as a query parameter:

```
ws://host/ws/game/MATH-7X2?token=eyJhbGciOiJIUzI1NiIs...
```

The server validates the JWT on connection. Invalid or expired tokens result
in immediate WebSocket close with code 4001.

---

# 6. Database Schema

## 6.1 New tables

### `multiplayer_games`

```sql
CREATE TABLE multiplayer_games (
    id              SERIAL PRIMARY KEY,
    game_code       VARCHAR(10) NOT NULL UNIQUE,
    host_user_id    INTEGER NOT NULL REFERENCES users(id),
    quiz_type_id    INTEGER NOT NULL REFERENCES quiz_types(id),
    difficulty      VARCHAR(10) NOT NULL DEFAULT 'medium',
    total_questions INTEGER NOT NULL DEFAULT 10,
    penalty_seconds INTEGER NOT NULL DEFAULT 10,
    min_players     INTEGER NOT NULL DEFAULT 2,
    max_players     INTEGER NOT NULL DEFAULT 5,
    status          VARCHAR(20) NOT NULL DEFAULT 'waiting',
        -- waiting  countdown  playing  completed  ended
    learned_timetables JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ
);

CREATE INDEX idx_mp_games_status ON multiplayer_games(status);
CREATE INDEX idx_mp_games_host ON multiplayer_games(host_user_id);
CREATE INDEX idx_mp_games_code ON multiplayer_games(game_code);
```

### `multiplayer_questions`

```sql
-- Shared question set for all players in a game
CREATE TABLE multiplayer_questions (
    id              SERIAL PRIMARY KEY,
    game_id         INTEGER NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,
    quiz_type_id    INTEGER NOT NULL REFERENCES quiz_types(id),
    a               INTEGER,
    b               INTEGER,
    c               INTEGER,
    d               INTEGER,
    correct         TEXT NOT NULL,
    prompt          JSONB,
    UNIQUE(game_id, position)
);
```

### `multiplayer_players`

```sql
CREATE TABLE multiplayer_players (
    id              SERIAL PRIMARY KEY,
    game_id         INTEGER NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    slot_number     INTEGER NOT NULL,
    is_ready        BOOLEAN NOT NULL DEFAULT FALSE,
    total_time_ms   INTEGER,           -- final elapsed + penalty in milliseconds
    penalty_time_ms INTEGER DEFAULT 0, -- cumulative penalty in milliseconds
    correct_count   INTEGER DEFAULT 0,
    wrong_count     INTEGER DEFAULT 0,
    final_position  INTEGER,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    UNIQUE(game_id, user_id),
    UNIQUE(game_id, slot_number)
);

CREATE INDEX idx_mp_players_game ON multiplayer_players(game_id);
CREATE INDEX idx_mp_players_user ON multiplayer_players(user_id);
```

### `multiplayer_answers`

```sql
CREATE TABLE multiplayer_answers (
    id              SERIAL PRIMARY KEY,
    game_id         INTEGER NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
    player_id       INTEGER NOT NULL REFERENCES multiplayer_players(id) ON DELETE CASCADE,
    question_id     INTEGER NOT NULL REFERENCES multiplayer_questions(id) ON DELETE CASCADE,
    value           TEXT,
    is_correct      BOOLEAN NOT NULL,
    lap_time_ms     INTEGER NOT NULL,  -- cumulative time at this answer
    penalty_ms      INTEGER DEFAULT 0, -- penalty added for this answer (0 if correct)
    answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, question_id)
);

CREATE INDEX idx_mp_answers_game ON multiplayer_answers(game_id);
CREATE INDEX idx_mp_answers_player ON multiplayer_answers(player_id);
```

### `multiplayer_chat_messages`

```sql
CREATE TABLE multiplayer_chat_messages (
    id              SERIAL PRIMARY KEY,
    game_id         INTEGER NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    message         VARCHAR(200) NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mp_chat_game ON multiplayer_chat_messages(game_id);
```

## 6.2 Game state machine

```
              create
     WAITING  players join/leave, ready toggle
                
                 host clicks [Start Game] (all ready, min players met)
                
            COUNTDOWN  10-second countdown ticks
                
                 countdown reaches 0
                
             PLAYING  players answer questions, host sees dashboard
                
                 all players finish all questions
                
            COMPLETED  results revealed, chat continues
                
                 host clicks [End Game]
                
              ENDED  game archived, viewable in history
```

## 6.3 Game code generation

Game codes are 8-character alphanumeric strings with a `MATH-` prefix for
readability: `MATH-7X2`, `MATH-A3K`, `MATH-P9Q`.

```python
import random, string

def generate_game_code() -> str:
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"MATH-{suffix}"
```

Codes are unique (enforced by database constraint). Regenerate on collision.

---

# 7. API Endpoints (REST)

WebSocket handles all real-time communication. REST endpoints handle CRUD
operations and data retrieval.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/multiplayer/games` | Any | Create a new game (host) |
| `GET` | `/api/multiplayer/games` | Any | List available games (status=waiting) |
| `GET` | `/api/multiplayer/games/{code}` | Any | Get game details |
| `POST` | `/api/multiplayer/games/{code}/join` | Any | Join a game (REST fallback) |
| `DELETE` | `/api/multiplayer/games/{code}/leave` | Any | Leave a game |
| `GET` | `/api/multiplayer/history` | Any | List games user participated in / hosted |
| `GET` | `/api/multiplayer/history/{code}` | Any | Game detail with results, answers, chat |

Admin-only:

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/multiplayer/admin/games` | Admin | List all games (any status) |
| `DELETE` | `/api/multiplayer/admin/games/{code}` | Admin | Delete a game |

---

# 8. Frontend Components

## 8.1 New Angular routes

| Path | Component | Guard |
|---|---|---|
| `/multiplayer` | MultiplayerMenuComponent | authGuard |
| `/multiplayer/create` | CreateGameComponent | authGuard |
| `/multiplayer/join` | JoinGameComponent | authGuard |
| `/multiplayer/lobby/:code` | LobbyComponent | authGuard |
| `/multiplayer/play/:code` | MultiplayerQuizComponent | authGuard |
| `/multiplayer/dashboard/:code` | HostDashboardComponent | authGuard |
| `/multiplayer/history` | MultiplayerHistoryListComponent | authGuard |
| `/multiplayer/history/:code` | MultiplayerHistoryDetailComponent | authGuard |

## 8.2 Component breakdown

### `MultiplayerMenuComponent`

Three-button menu styled after the Unreal Tournament server browser aesthetic
(dark panel, bold typography):

- **Join Game**  navigates to `/multiplayer/join`
- **Create Game**  navigates to `/multiplayer/create`
- **History**  navigates to `/multiplayer/history`

### `CreateGameComponent`

Form with quiz configuration (reuse quiz type dropdown, difficulty selector,
timetable multi-select from StartComponent). Additional fields for penalty,
min/max players, question count. Preview panel shows example questions.
Submit calls `POST /api/multiplayer/games`  navigates to lobby.

### `JoinGameComponent`

PrimeNG DataTable listing available games. Direct code entry field.
Clicking a row or entering a code calls `POST /api/multiplayer/games/{code}/join`
 navigates to lobby.

### `LobbyComponent`

Split-panel layout: player list (left) + chat (right). Ready toggle button.
Uses `MultiplayerWsService` for real-time updates. Displays countdown overlay
when game starts.

### `MultiplayerQuizComponent`

Fork of the existing `QuizComponent` with multiplayer additions:
- Visible timer (elapsed + penalty)
- Penalty flash animation on wrong answers
- Same question rendering (KaTeX, prompt JSONB) as single-player
- Answer submission via WebSocket instead of REST
- No history navigation during game

### `HostDashboardComponent`

Full-width table with position auto-sorting, / indicators, lap times,
penalty markers. Chat panel at bottom. Uses `MultiplayerWsService` for
real-time `answer_update` and `position_update` messages.

### `MultiplayerHistoryListComponent`

PrimeNG DataTable with date, game code, quiz type, player count, winner.
Filtered by user's participation (or all games for admin).

### `MultiplayerHistoryDetailComponent`

Read-only version of the Host Dashboard with full results table + chat
transcript. Teachers/admins see a "Show actual answers" toggle.

## 8.3 Shared components to reuse from single-player

| Component / Service | Reused in multiplayer |
|---|---|
| Quiz type dropdown | CreateGameComponent |
| Difficulty selector | CreateGameComponent |
| Timetable multi-select | CreateGameComponent |
| Question preview panel | CreateGameComponent |
| KaTeX rendering (KatexPipe) | MultiplayerQuizComponent |
| Question display layout | MultiplayerQuizComponent |
| Answer input controls | MultiplayerQuizComponent |
| PrimeNG Toast notifications | All components |
| Auth service / guards | All components |
| Transloco i18n | All components (new keys for multiplayer) |

---

# 9. Localization

All new UI strings must be added in both **English** and **Hungarian**.

### Key examples

| Key | English | Hungarian |
|---|---|---|
| `multiplayer.menu.title` | Multiplayer | Többjátékos |
| `multiplayer.menu.join` | Join Game | Csatlakozás |
| `multiplayer.menu.create` | Create Game | Játék létrehozása |
| `multiplayer.menu.history` | History | Előzmények |
| `multiplayer.lobby.ready` | I am ready! | Készen állok! |
| `multiplayer.lobby.waiting` | Waiting for players... | Várakozás a játékosokra... |
| `multiplayer.lobby.start` | Start Game | Játék indítása |
| `multiplayer.lobby.end` | End Game | Játék befejezése |
| `multiplayer.lobby.leave` | Leave Game | Kilépés |
| `multiplayer.game.penalty` | Penalty | Büntetés |
| `multiplayer.game.totalTime` | Your Time | Az idő |
| `multiplayer.game.elapsed` | Time | Idő |
| `multiplayer.results.winner` | Winner! | Győztes! |
| `multiplayer.results.position` | Position | Helyezés |
| `multiplayer.history.title` | Multiplayer History | Többjátékos előzmények |
| `multiplayer.create.penaltyHelp` | Penalty time added for wrong answers | Rossz válaszért járó büntetésidő |
| `multiplayer.join.gameCode` | Enter game code | Játékkód megadása |
| `multiplayer.join.find` | Find Games | Játékok keresése |

---

# 10. Badge Integration

New multiplayer-specific badges to earn:

| Badge code | Name (EN) | Criteria |
|---|---|---|
| `mp_first_win` | First Victory | Win your first multiplayer game |
| `mp_5_wins` | Champion | Win 5 multiplayer games |
| `mp_perfect_game` | Flawless | Win a multiplayer game with 100% accuracy (no penalties) |
| `mp_10_games` | Veteran | Play in 10 multiplayer games |
| `mp_speed_demon` | Speed Demon | Win a game with all answers under 3 seconds each |
| `mp_host_10` | Game Master | Host 10 multiplayer games |

Badge evaluation runs when a game transitions to `completed` status, checking
all players' results.

---

# 11. Notification Integration

| Event | Notification to | Message |
|---|---|---|
| Game invitation (future) | Invited player | "You've been invited to join MATH-7X2" |
| Game completed  winner | Winner | " You won the multiplayer game MATH-7X2!" |
| Game completed  participant | All players | "Multiplayer game MATH-7X2 completed. You placed #3" |
| Student played multiplayer | Assigned teacher | "Attila played a multiplayer quiz (2nd place, 85%)" |

---

# 12. Implementation Phases

| Phase | What | Effort | Priority |
|---|---|---|---|
| **Phase 1** | Database migration: 5 new tables + game state columns | 0.5 day | High |
| **Phase 2** | REST API: game CRUD, join/leave, history endpoints | 1 day | High |
| **Phase 3** | WebSocket infrastructure: connection manager, auth, message routing | 12 days | High |
| **Phase 4** | Game engine: question generation, answer validation, scoring, state machine | 12 days | High |
| **Phase 5** | Angular: Multiplayer menu + Create Game + Join Game | 1 day | High |
| **Phase 6** | Angular: Lobby (player list, ready check, chat, countdown) | 12 days | High |
| **Phase 7** | Angular: Player quiz view (timer, penalty, answer submission) | 12 days | High |
| **Phase 8** | Angular: Host live dashboard (real-time table, position sorting) | 12 days | High |
| **Phase 9** | Angular: Post-game results reveal + History views | 1 day | Medium |
| **Phase 10** | Localization: all new i18n keys in EN + HU | 0.5 day | Medium |
| **Phase 11** | Badges: 6 new multiplayer badges + evaluation logic | 0.5 day | Medium |
| **Phase 12** | Notifications: game completion notifications | 0.5 day | Low |
| **Phase 13** | Testing: WebSocket integration tests, multi-client scenarios | 12 days | Medium |

**Total estimated effort:** 1016 days

---

# 13. Technical Considerations

## 13.1 Scalability

- **In-memory game state**: Active games are managed by a `GameManager`
  singleton in the FastAPI process. Each game holds its WebSocket connections
  and transient state (positions, timers).
- **Single-process limitation**: With one Uvicorn worker, all WebSocket
  connections are in the same process. This is fine for the home-lab scale
  (25 concurrent games). For multi-worker deployment (Kubernetes), a Redis
  pub/sub layer would be needed to synchronize game state across workers.
- **Connection limits**: 5 players + 1 host = 6 WebSocket connections per
  game. At 10 concurrent games = 60 connections. Well within single-process
  capacity.

## 13.2 Disconnection handling

| Scenario | Behavior |
|---|---|
| Player disconnects in lobby | Slot opens, player removed, others notified |
| Player disconnects during game | Player's remaining questions marked as unanswered (max penalty). Game continues for other players |
| Player reconnects during game | Resume from the next unanswered question. Timer continues from disconnect |
| Host disconnects in lobby | Game cancelled, all players notified and returned to menu |
| Host disconnects during game | Game continues autonomously. Results are saved. Players see results when they finish |
| Host disconnects post-game | Players can still view results. Game auto-ends after 10 minutes |

## 13.3 Timer synchronization

- The server is the authoritative time source
- Each player's elapsed time is tracked server-side from the moment the
  server sends `game_started`
- Answer timestamps are recorded server-side on receipt
- Client-side timer display is a local approximation, synchronized on each
  `answer_update` acknowledgment
- Clock drift tolerance: 500ms (acceptable for educational gaming)

## 13.4 Cheating prevention

| Vector | Mitigation |
|---|---|
| Submitting answers too fast | Server validates minimum 500ms between answers |
| Submitting after game ends | Server rejects answers for completed games |
| Multiple answer submissions | Database UNIQUE constraint on (player_id, question_id) |
| Inspecting WebSocket for answers | Correct answers are NOT sent to players until game completion |
| Manipulating timer | Server-side authoritative timing |

---

# 14. What This Does NOT Cover

- **Tournament mode**  multi-round elimination brackets (future v5.0+)
- **Spectator mode**  watch live without playing (future)
- **Team mode**  collaborative answering (future)
- **Cross-deployment games**  games between different OpenMath instances
- **Mobile app**  responsive web only (no native app)
- **Game invitations**  direct invite links or push notifications (future)
- **Leaderboard**  global multiplayer rankings across all games (future)
- **Replay system**  animated playback of a completed game (future)
