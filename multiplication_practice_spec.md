# Multiplication Practice (Grade 2) — SPEC (Spec-Driven Development)

## 1) Goal
Build a **Python console** app that quizzes 2nd graders on the multiplication table, counts **correct/incorrect** answers, and shows a **percentage** result at the end.

## 2) Users & Context
- **User:** a 2nd grade student (guided by a teacher/parent if needed).
- **Environment:** terminal/console, keyboard input.

## 3) Core Flow
1. App starts → shows a **menu** to select difficulty: `low`, `medium`, `hard`.
2. App asks a sequence of multiplication questions:  
   **“What is A × B?”**
3. Student types an integer answer.
4. App records whether the answer is correct.
5. After the quiz ends, app prints:
   - total questions
   - correct count
   - incorrect count
   - **score percentage** = correct / total × 100 (rounded to whole number or 1 decimal)

## 4) Difficulty Rules (Question Sources)
Questions are generated from multiplication tables based on difficulty:

- **low:** factors mostly from `{1, 5, 10}`
- **medium:** include `{2, 3, 4, 6}` plus some easy ones
- **hard:** include `{7, 8, 9}` plus all others

Constraints for factors:
- `A` and `B` are integers in `[1..10]`
- At least one of the factors must be from the selected difficulty’s set (so the quiz actually matches the level).

## 5) Quiz Length & Ending
- Default number of questions: **10**.
- Quiz ends after N questions (no timer).

## 6) Input Handling
- Accept answers as text input.
- If input is not a valid integer:
  - show a short message: “Please type a number.”
  - re-ask the **same** question (do not count an attempt until valid integer is entered).

## 7) Output Requirements
- Start menu text (simple, readable).
- Each question printed on its own line.
- Final summary printed clearly, e.g.:
  - `Correct: 7 / 10`
  - `Wrong: 3`
  - `Score: 70%`

## 8) Non-Goals (v1)
- No GUI, no sound, no saving results, no accounts, no advanced analytics.

## 9) Acceptance Criteria (v1)
- Selecting each difficulty changes the pool of asked questions.
- For every question: the app checks correctness using exact multiplication.
- Invalid input is handled without crashing.
- Final score percentage is correct and matches correct/total.

## 10) Implementation Constraints
- **Python 3**, single-file console program.
- Keep code **short, minimal, and easy to read**.
- Use only standard library (e.g., `random`).
