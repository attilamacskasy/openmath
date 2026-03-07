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
      <div class="flex flex-column gap-4 line-height-3">

        <section>
          <h3>Introduction</h3>
          <p>
            <strong>OpenMath</strong> is an interactive mathematics practice tool for primary
            school students. It provides timed quizzes across a wide range of arithmetic topics
            — from basic addition and multiplication to Roman numerals and unit conversions.
          </p>
        </section>

        <section>
          <h3>Purpose</h3>
          <p>
            OpenMath helps students build fluency and confidence in mental arithmetic through
            repeated, randomized practice. Teachers can monitor progress and provide feedback,
            while parents can review their child's work and sign off on completed sessions.
          </p>
        </section>

        <section>
          <h3>Core Features</h3>
          <ul>
            <li><strong>23 quiz types</strong> covering addition, subtraction, multiplication,
              division, Roman numerals, counting patterns, measurement conversions, and more.</li>
            <li><strong>3 difficulty levels</strong> — Low, Medium, Hard — controlling number
              ranges and complexity.</li>
            <li><strong>Timetable focus</strong> — quizzes adapt to which timetables a student
              has learned (configurable on your Profile).</li>
            <li><strong>Instant feedback</strong> — see whether each answer is correct
              immediately after submitting.</li>
            <li><strong>Session history</strong> — review past quizzes, scores, and individual
              questions.</li>
            <li><strong>Profile management</strong> — update your name, birthday, gender, and
              learned timetables.</li>
          </ul>
        </section>

        <section>
          <h3>Getting Started</h3>
          <ol>
            <li>Register with your email or sign in with Google on the Login page.</li>
            <li>Navigate to <strong>Start</strong> to begin a quiz.</li>
            <li>Choose a quiz type, difficulty level, and number of questions.</li>
            <li>Click <strong>Start Quiz</strong> to begin.</li>
          </ol>
          <p>
            <strong>Authentication:</strong> You can register with email + password (min 6
            characters) or use Google SSO. If you register locally and later sign in with
            Google using the same email, both methods are linked automatically. Your session
            stays active for 30 minutes and refreshes automatically.
          </p>
        </section>

        <section>
          <h3>Taking a Quiz</h3>
          <ul>
            <li>Each question is shown one at a time.</li>
            <li>Type your answer and press <strong>Enter</strong> or click <strong>Submit</strong>.</li>
            <li>You receive immediate feedback after each answer.</li>
            <li>Click <strong>Next</strong> to proceed to the next question.</li>
            <li>After the last question, you are taken to the session results page.</li>
            <li>In-progress sessions can be resumed from the <strong>History</strong> page.</li>
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
            Click a session to view the question-by-question results.
            In-progress sessions can be resumed by clicking the "In progress" link.
          </p>
        </section>

        @if (auth.isTeacher()) {
          <section>
            <h3>Teacher — My Students</h3>
            <p>
              The <strong>My Students</strong> page displays your assigned students in a
              sidebar list. Click a student to view their quiz sessions, scores, and review
              status.
            </p>
            <ul>
              <li><strong>Add a student:</strong> Click "Add Student" and enter the student's
                registered email address. The student must already have an account and the
                student role.</li>
              <li><strong>Remove a student:</strong> Click the remove button (×) next to the
                student's name in the sidebar.</li>
              <li><strong>Review a session:</strong> Click the eye icon on any session row to
                view the full question list, add a comment, and mark it as "Reviewed".</li>
              <li>Students can see your review comments and status on their own session
                history.</li>
            </ul>
          </section>
        }

        @if (auth.isParent()) {
          <section>
            <h3>Parent — My Child</h3>
            <p>
              The <strong>My Child</strong> page shows your child's quiz sessions. If you
              have multiple children assigned, use the dropdown to switch between them.
            </p>
            <ul>
              <li><strong>Add a child:</strong> Click "Add Child" and enter your child's
                registered email address. A student can have at most 2 parents.</li>
              <li><strong>Remove a child:</strong> Click the remove button next to your
                child's name.</li>
              <li><strong>View sessions:</strong> See scores, difficulty, and the teacher's
                review status for each session.</li>
              <li><strong>Sign off:</strong> Click the eye icon to view the session detail,
                read the teacher's review, add an optional comment, and click "Sign Off".</li>
            </ul>
          </section>
        }

        @if (auth.isAdmin()) {
          <section>
            <h3>Admin — User Management</h3>
            <p>
              The <strong>Users</strong> page lets you view all registered users, create
              new user accounts, reset passwords, and manage role assignments. Each user
              can have multiple roles: <em>student</em>, <em>teacher</em>, <em>parent</em>,
              and <em>admin</em>.
            </p>
            <ul>
              <li><strong>Create user:</strong> Provide name, email, password, and select
                one or more roles.</li>
              <li><strong>Edit user:</strong> Update name and roles. Email cannot be changed
                for Google SSO accounts.</li>
              <li><strong>Reset password:</strong> Available for local and dual-auth accounts
                only (not Google-only accounts).</li>
              <li><strong>Teacher-Student assignments:</strong> Navigate to the teacher/parent
                admin pages to manage class assignments.</li>
            </ul>
          </section>

          <section>
            <h3>Admin — Quiz Type Editor</h3>
            <p>
              The <strong>Quiz Types</strong> page lets you manage quiz type definitions.
              Toggle quiz types active/inactive, edit descriptions, preview generated
              questions, and verify rendering.
            </p>
          </section>

          <section>
            <h3>Admin — Database &amp; Statistics</h3>
            <ul>
              <li>The <strong>Admin</strong> page shows database statistics and allows browsing
                raw table data.</li>
              <li>Use "Delete All Data" (with confirmation) to reset all user and session data
                while keeping quiz type definitions.</li>
              <li>Admins can see all users' sessions in <strong>History</strong> and delete
                individual sessions.</li>
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
