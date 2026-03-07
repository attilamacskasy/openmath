import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ListboxModule } from 'primeng/listbox';
import { BadgeModule } from 'primeng/badge';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    DialogModule,
    InputTextareaModule,
    ListboxModule,
    BadgeModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    <h2 class="mt-0 mb-3">My Students</h2>

    @if (loading()) {
      <p class="text-500">Loading...</p>
    } @else {
      <div class="flex gap-3" style="min-height: 60vh">
        <!-- Left: Student list -->
        <div style="width: 280px; flex-shrink: 0">
          <p-card header="Students">
            @if (students().length === 0) {
              <p class="text-500 text-sm">No students assigned.</p>
            } @else {
              <p-listbox
                [options]="students()"
                [(ngModel)]="selectedStudent"
                optionLabel="name"
                (onChange)="onStudentSelect($event.value)"
                [style]="{ width: '100%' }"
              >
                <ng-template let-item pTemplate="item">
                  <div class="flex align-items-center justify-content-between w-full">
                    <span>{{ item.name }}</span>
                    @if (calculateAge(item.birthday) !== null) {
                      <p-badge [value]="calculateAge(item.birthday)!.toString()" severity="info"></p-badge>
                    }
                  </div>
                </ng-template>
              </p-listbox>
            }
          </p-card>
        </div>

        <!-- Right: Session history -->
        <div class="flex-1">
          @if (!selectedStudent) {
            <p-card>
              <p class="text-500">Select a student to view their quiz sessions.</p>
            </p-card>
          } @else {
            <p-card [header]="selectedStudent.name + '\\'s Sessions'">
              @if (sessionsLoading()) {
                <p class="text-500">Loading sessions...</p>
              } @else {
                <p-table
                  [value]="sessions()"
                  [rows]="15"
                  [paginator]="sessions().length > 15"
                  styleClass="p-datatable-sm"
                >
                  <ng-template pTemplate="header">
                    <tr>
                      <th>Quiz Type</th>
                      <th>Difficulty</th>
                      <th style="width: 80px">Score</th>
                      <th>Date</th>
                      <th style="width: 100px">Review</th>
                      <th style="width: 100px">Actions</th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-s>
                    <tr>
                      <td>{{ s.quiz_type_description || s.quiz_type_code }}</td>
                      <td>{{ s.difficulty }}</td>
                      <td>
                        @if (s.score_percent !== null && s.score_percent !== undefined) {
                          {{ s.score_percent }}%
                        } @else {
                          —
                        }
                      </td>
                      <td>{{ s.started_at | date:'short' }}</td>
                      <td>
                        @switch (s.review_status) {
                          @case ('reviewed') {
                            <p-tag value="Reviewed" severity="info"></p-tag>
                          }
                          @case ('signed') {
                            <p-tag value="Signed" severity="success"></p-tag>
                          }
                          @default {
                            <p-tag value="Pending" severity="secondary"></p-tag>
                          }
                        }
                      </td>
                      <td>
                        <p-button
                          icon="pi pi-eye"
                          [rounded]="true"
                          [text]="true"
                          size="small"
                          pTooltip="Review"
                          (onClick)="openReviewDialog(s)"
                        ></p-button>
                      </td>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="emptymessage">
                    <tr><td colspan="6" class="text-center text-500">No sessions found.</td></tr>
                  </ng-template>
                </p-table>
              }
            </p-card>
          }
        </div>
      </div>
    }

    <!-- Review Dialog -->
    <p-dialog
      [(visible)]="reviewDialogVisible"
      header="Review Session"
      [modal]="true"
      [style]="{ width: '600px' }"
    >
      @if (reviewSession) {
        <div class="mb-3">
          <strong>Quiz:</strong> {{ reviewSession.quiz_type_description || reviewSession.quiz_type_code }}<br>
          <strong>Score:</strong> {{ reviewSession.score_percent }}%<br>
          <strong>Date:</strong> {{ reviewSession.started_at | date:'short' }}
        </div>

        @if (reviewDetail()) {
          <h4 class="mt-0 mb-2">Questions</h4>
          <p-table [value]="reviewDetail()!.questions" styleClass="p-datatable-sm mb-3">
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 40px">#</th>
                <th>Question</th>
                <th style="width: 80px">Correct</th>
                <th style="width: 80px">Answer</th>
                <th style="width: 80px">Status</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-q>
              <tr>
                <td>{{ q.position }}</td>
                <td>
                  @if (q.prompt?.render_html) {
                    <span [innerHTML]="q.prompt.render_html"></span>
                  } @else {
                    {{ q.prompt?.render || questionText(q) }}
                  }
                </td>
                <td class="font-semibold">{{ q.correct }}</td>
                <td>{{ answerText(q) }}</td>
                <td>
                  @if (!q.answer) {
                    <p-tag value="—" severity="info"></p-tag>
                  } @else if (q.answer.is_correct) {
                    <p-tag value="✔" severity="success"></p-tag>
                  } @else {
                    <p-tag value="✘" severity="danger"></p-tag>
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>

          <!-- Existing reviews -->
          @for (rev of reviewDetail()!.reviews || []; track rev.id) {
            <div class="surface-100 border-round p-3 mb-2">
              <div class="flex justify-content-between">
                <span class="font-semibold">
                  {{ rev.reviewer_role === 'teacher' ? 'Teacher review' : 'Parent sign-off' }}
                  — {{ rev.reviewer_name }}
                </span>
                <p-tag
                  [value]="rev.status"
                  [severity]="rev.status === 'signed' ? 'success' : 'info'"
                ></p-tag>
              </div>
              @if (rev.comment) {
                <p class="mt-2 mb-1">{{ rev.comment }}</p>
              }
              <span class="text-xs text-500">{{ (rev.updated_at || rev.created_at) | date:'short' }}</span>
            </div>
          }
        }

        <div class="flex flex-column gap-2 mt-3">
          <label class="font-semibold">Your Comment</label>
          <textarea
            pInputTextarea
            [(ngModel)]="reviewComment"
            rows="3"
            class="w-full"
            placeholder="Add your review comment..."
          ></textarea>
        </div>
      }

      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="reviewDialogVisible = false"></p-button>
        <p-button
          label="Mark as Reviewed"
          icon="pi pi-check"
          (onClick)="submitReview()"
          [loading]="reviewSubmitting()"
        ></p-button>
      </ng-template>
    </p-dialog>
  `,
})
export class TeacherDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);

  loading = signal(true);
  students = signal<any[]>([]);
  selectedStudent: any = null;
  sessionsLoading = signal(false);
  sessions = signal<any[]>([]);

  reviewDialogVisible = false;
  reviewSession: any = null;
  reviewDetail = signal<any>(null);
  reviewComment = '';
  reviewSubmitting = signal(false);

  ngOnInit() {
    this.api.getTeacherStudents().subscribe({
      next: (s) => { this.students.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  calculateAge(birthday: string | null): number | null {
    if (!birthday) return null;
    const birth = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  onStudentSelect(student: any) {
    if (!student) return;
    this.sessionsLoading.set(true);
    this.api.getTeacherStudentSessions(student.id).subscribe({
      next: (s) => { this.sessions.set(s); this.sessionsLoading.set(false); },
      error: () => this.sessionsLoading.set(false),
    });
  }

  openReviewDialog(session: any) {
    this.reviewSession = session;
    this.reviewComment = '';
    this.reviewDetail.set(null);
    this.reviewDialogVisible = true;

    this.api.getTeacherSession(session.id).subscribe({
      next: (d) => this.reviewDetail.set(d),
    });
  }

  questionText(q: any): string {
    if (q.prompt?.render) return q.prompt.render;
    if (q.c != null) return `(${q.a} × ${q.b}) + (${q.c} × ${q.d})`;
    return `${q.a} × ${q.b}`;
  }

  answerText(q: any): string {
    if (!q.answer) return '—';
    if (q.answer.response?.parsed?.value !== undefined) return String(q.answer.response.parsed.value);
    if (q.answer.value !== undefined) return String(q.answer.value);
    return '—';
  }

  submitReview() {
    if (!this.reviewSession) return;
    this.reviewSubmitting.set(true);
    this.api.submitTeacherReview(this.reviewSession.id, {
      comment: this.reviewComment || undefined,
      status: 'reviewed',
    }).subscribe({
      next: () => {
        this.reviewSubmitting.set(false);
        this.reviewDialogVisible = false;
        this.messageService.add({ severity: 'success', summary: 'Reviewed', detail: 'Session marked as reviewed' });
        // Refresh session list
        if (this.selectedStudent) this.onStudentSelect(this.selectedStudent);
      },
      error: () => {
        this.reviewSubmitting.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to submit review' });
      },
    });
  }
}
