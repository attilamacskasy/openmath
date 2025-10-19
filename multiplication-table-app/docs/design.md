# Design Overview

## Architecture
- `src/main.py` handles input validation and orchestrates table generation and rendering.
- `src/utils.py` exposes `generate_multiplication_table` for producing numeric grids and `display_table` for ASCII formatting.

## Data Flow
1. Gather validated dimensions from the user.
2. Build a nested list where each row contains the multiplication products for a given multiplicand.
3. Determine cell width based on the widest value and format the table with a dedicated label column and header row.
4. Print the table using distinct borders to emphasize operand headers vs. result body.

## Formatting Strategy
- Use shared width calculations to right-align all cells.
- Employ double-character separators (`++`, `||`, `=`) between operand labels and results for clearer grouping.
- Emit horizontal borders after every row to preserve alignment in terminals that lack box-drawing characters.
