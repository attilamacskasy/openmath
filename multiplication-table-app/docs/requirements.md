# Requirements

## Functional
- Prompt the user for row and column counts within the inclusive range 1-12.
- Validate user input and repeat prompts until a valid integer is provided for each dimension.
- Generate a multiplication table matching the requested dimensions.
- Render the table with ASCII borders that visually separate operand headers from computed products.

## Non-Functional
- Execute via `python src/main.py` without additional setup beyond the standard library.
- Keep console output legible on terminals with default monospace fonts and minimal color support.
- Maintain unit-independent formatting so the table scales cleanly for sizes up to 12 × 12.
