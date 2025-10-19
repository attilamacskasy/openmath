from utils import generate_multiplication_table, display_table

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

    multiplication_table = generate_multiplication_table(rows, cols)
    display_table(multiplication_table)