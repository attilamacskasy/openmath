def generate_multiplication_table(rows, cols):
    table = []
    for i in range(1, rows + 1):
        row = []
        for j in range(1, cols + 1):
            row.append(i * j)
        table.append(row)
    return table

def display_table(table):
    for row in table:
        print("\t".join(map(str, row)))