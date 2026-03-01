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

    def build_border(fill_char):
        label_segment = fill_char * (cell_width + 2)
        body_segments = [fill_char * (cell_width + 2) for _ in range(cols)]
        return "+" + label_segment + "++" + "+".join(body_segments) + "+"

    def format_row(cells):
        label_cell = cells[0]
        body_cells = cells[1:]
        return "| " + label_cell + " || " + " | ".join(body_cells) + " |"

    horizontal_border = build_border("-")
    header_border = build_border("=")

    top_row = ["x".rjust(cell_width)] + [header.rjust(cell_width) for header in headers]
    print(horizontal_border)
    print(format_row(top_row))
    print(header_border)

    for label, row in zip(row_labels, table):
        row_str = [label.rjust(cell_width)] + [str(cell).rjust(cell_width) for cell in row]
        print(format_row(row_str))
        print(horizontal_border)