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

if __name__ == "__main__":
    while True:
        try:
            rows = int(input("Enter the number of rows (1-12): "))
            cols = int(input("Enter the number of columns (1-12): "))
            if 1 <= rows <= 12 and 1 <= cols <= 12:
                break
            else:
                print("Please enter numbers between 1 and 12.")
        except ValueError:
            print("Invalid input. Please enter a valid integer.")

    from utils import generate_multiplication_table, display_table

    multiplication_table = generate_multiplication_table(rows, cols)
    display_table(multiplication_table)