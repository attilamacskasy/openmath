# Multiplication Practice App

This is a Python console app for grade 2 multiplication practice. The app lets the student choose a difficulty (`low`, `medium`, or `hard`), asks 10 multiplication questions, and shows a summary with correct answers, wrong answers, and percentage score.

## Features

- Difficulty menu: `low`, `medium`, `hard`.
- 10-question quiz with random factors in the range `1..10`.
- Difficulty-aware question generation where at least one factor comes from the selected difficulty set.
- Input validation that re-asks the same prompt if the user does not enter an integer.
- Final score summary with `Correct`, `Wrong`, and `Score`.

## Getting Started

### Prerequisites

Make sure you have Python installed on your machine. You can download it from [python.org](https://www.python.org/downloads/).

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd python-app
   ```
3. (Optional) Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

### Running the Application

To run the application, execute:
```
python src/main.py
```

Then choose a difficulty and answer the quiz questions.

## License

This project is open-source and available under the MIT License.