import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-user-guide',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <p-card header="User Guide">
      <div class="flex flex-column gap-3 line-height-3">
        <section>
          <h3>Getting Started</h3>
          <ol>
            <li>Register with your email or sign in with Google on the Login page.</li>
            <li>Once logged in, navigate to <strong>Start</strong> to begin a quiz.</li>
            <li>Choose a quiz type, difficulty level, and number of questions.</li>
            <li>Click <strong>Start Quiz</strong> to begin.</li>
          </ol>
        </section>

        <section>
          <h3>Authentication</h3>
          <ul>
            <li><strong>Local login</strong>: Register with your name, email, and a password (min 6 characters).</li>
            <li><strong>Google SSO</strong>: Click "Sign in with Google" on the login page to use your Google account.</li>
            <li>If you register locally and later sign in with Google using the same email, both methods are linked automatically.</li>
            <li>Your session stays active for 30 minutes. If it expires, the app refreshes it automatically.</li>
            <li>Click <strong>Logout</strong> in the header to sign out.</li>
          </ul>
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
          <h3>Your Profile</h3>
          <p>
            On the <strong>Profile</strong> page you can update your name, birthday, gender,
            and which timetables you've learned. Your email and auth provider are shown as
            read-only. Age is computed from your birthday.
          </p>
        </section>

        <section>
          <h3>History</h3>
          <p>
            The <strong>History</strong> page shows your quiz sessions grouped by quiz type.
            Click on a session's difficulty to view the detailed question-by-question results.
            In-progress sessions can be resumed by clicking the "In progress" link.
          </p>
        </section>

        @if (auth.isAdmin()) {
          <section>
            <h3>Admin — Student Management</h3>
            <p>
              The <strong>Students</strong> page lets you view all registered students, create
              new student accounts with email/password, and reset passwords. You can assign
              roles (<em>student</em> or <em>admin</em>) when creating accounts.
            </p>
          </section>

          <section>
            <h3>Admin — Database &amp; Statistics</h3>
            <ul>
              <li>The <strong>Admin</strong> page shows database statistics and allows browsing raw table data.</li>
              <li>Use "Delete All Data" (with confirmation) to reset all student and session data while keeping quiz type definitions.</li>
              <li>Admins can see all students' sessions in <strong>History</strong> and delete individual sessions.</li>
            </ul>
          </section>
        }
      </div>
    </p-card>
  `,
})
export class UserGuideComponent {
  auth = inject(AuthService);
}
