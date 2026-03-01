# openmath

`openmath` is a learning-focused project for building fun, practical math tools for kids, starting with multiplication practice.

## Purpose

- Build a simple, child-friendly multiplication practice experience.
- Use spec-driven development to keep implementation clear and repeatable.
- Compare modern full-stack approaches on the same product idea over time.

## Current Scope (Implemented)

Right now, this repository actively contains the Python console implementation:

- `python-app/` — multiplication quiz for grade 2 practice.

The Python app supports:

- Difficulty selection: `low`, `medium`, `hard`
- 10-question quiz flow
- Integer input validation (`Please type a number.` on invalid input)
- Correct/wrong tracking and final percentage score

## Planned Scope (Not Yet Implemented Here)

This repo is also designed to host two web full-stack implementations of the same quiz domain:

- `nuxt-app/` — Nuxt 4 + Nitro + Drizzle + PostgreSQL
- `react-laravel/` — React frontend + Laravel backend + PostgreSQL

These web stacks are planned to share a single PostgreSQL database and canonical SQL migrations so behavior and stored quiz data can be compared across implementations.

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
