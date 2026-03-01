# Requirements

## Functional
- Show a start menu where the user selects difficulty: `low`, `medium`, or `hard`.
- Ask 10 multiplication questions in the format `What is A x B?`.
- Generate factors in the range `1..10`.
- Ensure at least one factor belongs to the selected difficulty set:
	- low: `{1, 5, 10}`
	- medium: `{1, 2, 3, 4, 5, 6, 10}`
	- hard: `{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}`
- Validate answers as integers and show `Please type a number.` for invalid input.
- Re-ask on invalid input without advancing the quiz.
- Track correct and wrong answers, then display a final summary with percentage score.

## Non-Functional
- Execute via `python src/main.py` using Python 3 and standard library only.
- Keep output simple and legible in plain text terminals.
- Keep implementation concise, readable, and beginner-friendly.
