# Design Overview

## Architecture
- `src/main.py` is the executable console application.
- The program uses small functions for menu input, numeric validation, question generation, and quiz orchestration.
- Randomized question generation uses Python's `random` module from the standard library.

## Data Flow
1. Ask the user to choose a difficulty (`low`, `medium`, `hard`).
2. For each of 10 questions, choose one focused factor from the difficulty set and one factor from `1..10`.
3. Ask `What is A x B?` and validate integer input.
4. Check correctness using `A * B` and track counts.
5. Print final summary: total, correct, wrong, and rounded percentage score.

## Validation Strategy
- Difficulty input loops until a valid option is entered.
- Answer input loops until a valid integer is entered.
- Invalid numeric input does not consume a question attempt.
