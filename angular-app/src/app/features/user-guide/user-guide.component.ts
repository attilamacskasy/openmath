import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-user-guide',
  standalone: true,
  imports: [CardModule],
  template: `
    <p-card header="User Guide">
      <div class="flex flex-column gap-3 line-height-3">
        <section>
          <h3>Getting Started</h3>
          <ol>
            <li>Select or create a student from the header dropdown or the Start page.</li>
            <li>Choose a quiz type, difficulty level, and number of questions.</li>
            <li>Click <strong>Start Quiz</strong> to begin.</li>
          </ol>
        </section>

        <section>
          <h3>Taking a Quiz</h3>
          <ul>
            <li>Each question is shown one at a time.</li>
            <li>Type your answer and press <strong>Enter</strong> or click <strong>Submit</strong>.</li>
            <li>You will see immediate feedback after each answer.</li>
            <li>Click <strong>Next</strong> to proceed to the next question.</li>
            <li>After the last question, you are taken to the session results page.</li>
          </ul>
        </section>

        <section>
          <h3>Quiz Types</h3>
          <ul>
            <li><strong>Multiplication (1-10)</strong>: Single multiplication, e.g. 7 &times; 9</li>
            <li><strong>Sum of Products (1-10)</strong>: Two multiplications added, e.g. (2 &times; 5) + (3 &times; 4)</li>
          </ul>
        </section>

        <section>
          <h3>Difficulty Levels</h3>
          <ul>
            <li><strong>Low</strong>: Factors from 1, 5, 10</li>
            <li><strong>Medium</strong>: Factors from 1, 2, 3, 4, 5, 6, 10</li>
            <li><strong>Hard</strong>: All factors from 1 to 10</li>
          </ul>
        </section>

        <section>
          <h3>Student Profiles</h3>
          <p>
            Each student has a name, optional age and gender, and a set of "learned timetables"
            that control which multiplication factors appear in quizzes. You can edit these
            on the <strong>Profile</strong> page.
          </p>
        </section>

        <section>
          <h3>History</h3>
          <p>
            The <strong>History</strong> page shows all quiz sessions grouped by quiz type.
            Click on a session's difficulty to view the detailed question-by-question results.
            In-progress sessions can be resumed by clicking the "In progress" link.
          </p>
        </section>

        <section>
          <h3>Admin</h3>
          <p>
            The <strong>Admin</strong> page shows database statistics and allows browsing
            raw table data. Use the "Delete All Data" button (with confirmation) to reset
            all student and session data while keeping quiz type definitions.
          </p>
        </section>
      </div>
    </p-card>
  `,
})
export class UserGuideComponent {}
