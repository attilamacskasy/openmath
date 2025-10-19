def generate_multiplication_table(rows, cols):
    table = []
    for i in range(1, rows + 1):
        row = []
        for j in range(1, cols + 1):
            row.append(i * j)
        table.append(row)
    return table


def display_table(table):
    if not table:
        print("No data to display.")
        return

    rows = len(table)
    cols = len(table[0]) if rows else 0
    headers = [str(index) for index in range(1, cols + 1)]
    row_labels = [str(index) for index in range(1, rows + 1)]

    max_cell_width = max(len(str(cell)) for row in table for cell in row)
    max_header_width = max(len(label) for label in headers + row_labels)
    cell_width = max(max_cell_width, max_header_width)

    horizontal_border = "+" + "+".join("-" * (cell_width + 2) for _ in range(cols + 1)) + "+"

    top_row = ["".rjust(cell_width)] + [header.rjust(cell_width) for header in headers]
    print(horizontal_border)
    print("| " + " | ".join(top_row) + " |")
    print(horizontal_border)

    for label, row in zip(row_labels, table):
        row_str = [label.rjust(cell_width)] + [str(cell).rjust(cell_width) for cell in row]
        print("| " + " | ".join(row_str) + " |")
        print(horizontal_border)