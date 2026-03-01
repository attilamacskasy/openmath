# openmath

`openmath` is a learning-focused project for building fun, practical math tools for kids, starting with multiplication practice.

## Purpose

- Build a simple, child-friendly multiplication practice experience.
- Use spec-driven development to keep implementation clear and repeatable.
- Compare modern full-stack approaches on the same product idea over time.

## Release Status

- **Nuxt release:** `v1.0` (working)
- **Current primary web app:** `nuxt-app/` (Nuxt 4 + Nitro + Drizzle + PostgreSQL)
- **Python console app:** still available in `python-app/`

## Current Scope (Implemented)

This repository now contains two working implementations:

- `python-app/` — multiplication quiz for grade 2 practice (console)
- `nuxt-app/` — full-stack multiplication practice app with PostgreSQL persistence

### Python app supports

- Difficulty selection: `low`, `medium`, `hard`
- 10-question quiz flow
- Integer input validation (`Please type a number.` on invalid input)
- Correct/wrong tracking and final percentage score

### Nuxt app supports

- Start quiz with difficulty and question count
- Student handling:
	- select an **existing student** from dropdown
	- choose **Add new student** and create a new one
- Quiz flow with answer validation and scoring
- History list and session detail pages
- Database statistics admin page

## Planned Scope (Not Yet Implemented Here)

This repo is also designed to host two web full-stack implementations of the same quiz domain:

- `react-laravel/` — React frontend + Laravel backend + PostgreSQL

These web stacks are planned to share a single PostgreSQL database and canonical SQL migrations so behavior and stored quiz data can be compared across implementations.

## What’s New (Nuxt v1.0)

Based on recent product updates, the Nuxt app now includes:

1. **Global navigation updates**
	- Added menu entry for **Database Statistics**.

2. **Database Statistics page**
	- Shows record counts for `students`, `quiz_sessions`, `questions`, `answers`.
	- Each table is clickable to view table rows.
	- Added **Refresh** button for counts and currently selected table.

3. **Danger Zone (admin action)**
	- Added reset flow to delete all data from schema tables.
	- Requires explicit confirmation text: `DELETE ALL DATA`.

4. **Student name persistence fix**
	- Fixed input binding so `studentName` is correctly sent and saved.

5. **Student selection UX on start page**
	- Added dropdown of existing students.
	- Added option to create and submit a new student.

6. **History improvements**
	- Added `Student` column in Quiz History.
	- Added `Questions` column between `Difficulty` and `Score`.

7. **Session detail improvements**
	- Added student name display on history session detail page.

## Repository Documentation

### Python app docs

- `python-app/README.md`
- `python-app/AI_INSTRUCTIONS.md`
- `python-app/docs/requirements.md`
- `python-app/docs/design.md`
- `python-app/docs/tasks.md`

### Cross-project specs

- `multiplication_practice_spec.md` — Python console app spec
- `multiplication_practice_nuxt4_drizzle_reka_spec.md` — Nuxt full-stack spec + Reka UI spec
- `multiplication_practice_react_laravel_chakra_spec.md` — React + Laravel + Chakra UI spec
- `multiproject_repo_spec.md` — monorepo strategy and shared DB guidance
- `win11_dev_assistant_nuxt4_spec.md` — Win11 visibility-first assistant spec for Nuxt workflows

## Nuxt Quick Start

From repository root:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath\nuxt-app"
pnpm install
pnpm dev
```

Then open the Nuxt URL shown in terminal (typically `http://localhost:3000`).

## Dev Assistant (Win11)

Use the root script `dev.ps1` to run visible, prompt-driven dev workflows.

### Common modes

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1
.\dev.ps1 doctor
.\dev.ps1 validate-nuxt
.\dev.ps1 build-nuxt
.\dev.ps1 up-nuxt
```

For non-interactive diagnostics (auto-run confirmations):

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1 doctor -AutoApprove
```

### Logs and run artifacts

Each run writes to:

- `.dev-assistant/logs/<timestamp>/run.log`
- `.dev-assistant/logs/<timestamp>/errors.log`
- `.dev-assistant/logs/<timestamp>/summary.json`

## Quick Start (Python App)

Use Python 3 from the repository root:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath\python-app"
python src/main.py
```

## Why this structure?

The goal is to keep one educational domain (multiplication practice) while comparing developer experience and architecture trade-offs across:

- simple local console app (Python)
- Vue-oriented full-stack (Nuxt)
- React + Laravel split-stack full-stack

This keeps product behavior comparable while letting us evaluate implementation speed, maintainability, and stack fit.
