# Task Backlog

## Ready
- [ ] Implement PostgreSQL connection and transaction helpers.
- [ ] Add repository layer for users, quiz types, sessions, questions, answers.
- [ ] Implement main menu loop with all parity menu items.
- [ ] Implement Active user selection/clear flow.
- [ ] Implement Start quiz flow with:
	- [ ] quiz type selection
	- [ ] difficulty selection
	- [ ] question count input
	- [ ] new user profile capture when no active user
- [ ] Implement question generator parity for both quiz types.
- [ ] Implement answer submit flow with idempotent insert and session recompute.
- [ ] Implement Resume in-progress sessions flow.
- [ ] Implement History grouped by quiz type with active-user filter toggle.
- [ ] Implement Session detail view with per-question status.
- [ ] Implement Profile edit flow and performance stats rendering.
- [ ] Implement Database statistics and table row browsing.
- [ ] Implement Danger zone reset with exact `DELETE ALL DATA` confirmation.
- [ ] Add duration formatting helpers (`0s`, `Ns`, `mm:ss`, `hh:mm:ss`).
- [ ] Add robust input validation and safe re-prompt loops.
- [ ] Add logging/error display strategy for DB failures.

## In Progress
- [ ] Keep CLI outputs and behaviors aligned with `openmath_python_quiz_spec.md` as source-of-truth spec.

## Done
- [x] Define implementation-faithful Python CLI parity spec for current Nuxt app behavior.
