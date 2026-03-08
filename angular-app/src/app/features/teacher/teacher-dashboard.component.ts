import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ListboxModule } from 'primeng/listbox';
import { BadgeModule } from 'primeng/badge';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { LocaleService } from '../../core/services/locale.service';
import { ExamPaperViewComponent, ExamPaperQuestion } from '../../shared/components/exam-paper-view.component';

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
    InputTextModule,
    InputTextareaModule,
    ListboxModule,
    BadgeModule,
    DropdownModule,
    TooltipModule,
    ToastModule,
    SelectButtonModule,
    CheckboxModule,
    TranslocoModule,
    LocalDatePipe,
    ExamPaperViewComponent,
  ],
  providers: [MessageService],
  template: `
    <ng-container *transloco="let t">
    <p-toast></p-toast>
    <h2 class="mt-0 mb-3">{{ t('teacher.myStudents') }}</h2>

    @if (loading()) {
      <p class="text-500">{{ t('common.loading') }}</p>
    } @else {
      <div class="flex gap-3" style="min-height: 60vh">
        <!-- Left: Student list -->
        <div style="width: 280px; flex-shrink: 0">
          <p-card [header]="t('teacher.students')">
            <ng-template pTemplate="subtitle">
              <p-button [label]="t('teacher.addStudent')" icon="pi pi-plus" size="small"
                (onClick)="addStudentDialogVisible = true"></p-button>
            </ng-template>
            @if (students().length === 0) {
              <p class="text-500 text-sm">{{ t('teacher.noStudents') }}</p>
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
                    <div class="flex align-items-center gap-1">
                      @if (badgeCounts()[item.id] !== undefined) {
                        <p-badge [value]="'🏆' + badgeCounts()[item.id]" severity="warning"
                          [pTooltip]="t('badge.earnedCount', { count: badgeCounts()[item.id] })"
                        ></p-badge>
                      }
                      @if (calculateAge(item.birthday) !== null) {
                        <p-badge [value]="calculateAge(item.birthday)!.toString()" severity="info"></p-badge>
                      }
                      <p-button icon="pi pi-history" [rounded]="true" [text]="true" size="small"
                        severity="info" [pTooltip]="t('teacher.viewHistory')"
                        (onClick)="viewStudentHistory(item, $event)"></p-button>
                      <p-button icon="pi pi-times" [rounded]="true" [text]="true" size="small"
                        severity="danger" [pTooltip]="t('teacher.removeStudent')"
                        (onClick)="removeStudent(item, $event)"></p-button>
                    </div>
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
              <p class="text-500">{{ t('teacher.selectStudent') }}</p>
            </p-card>
          } @else {
            <p-card [header]="selectedStudent.name + t('teacher.sessions')">
              @if (sessionsLoading()) {
                <p class="text-500">{{ t('common.loading') }}</p>
              } @else {
                <p-table
                  [value]="sessions()"
                  [rows]="15"
                  [paginator]="sessions().length > 15"
                  styleClass="p-datatable-sm"
                >
                  <ng-template pTemplate="header">
                    <tr>
                      <th>{{ t('history.quizType') }}</th>
                      <th>{{ t('history.difficulty') }}</th>
                      <th style="width: 80px">{{ t('history.score') }}</th>
                      <th>{{ t('history.date') }}</th>
                      <th style="width: 100px">{{ t('teacher.review') }}</th>
                      <th style="width: 100px">{{ t('admin.actions') }}</th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-s>
                    <tr>
                      <td>{{ s.quiz_type_description || s.quiz_type_code }}</td>
                      <td>{{ t('difficulty.' + s.difficulty) }}</td>
                      <td>
                        @if (s.score_percent !== null && s.score_percent !== undefined) {
                          {{ s.score_percent }}%
                        } @else {
                          —
                        }
                      </td>
                      <td>{{ s.started_at | localDate:'short' }}</td>
                      <td>
                        @switch (s.review_status) {
                          @case ('reviewed') {
                            <p-tag [value]="t('session.reviewed')" severity="info"></p-tag>
                          }
                          @case ('signed') {
                            <p-tag [value]="t('session.signed')" severity="success"></p-tag>
                          }
                          @default {
                            <p-tag [value]="t('teacher.pending')" severity="secondary"></p-tag>
                          }
                        }
                      </td>
                      <td>
                        <p-button
                          icon="pi pi-eye"
                          [rounded]="true"
                          [text]="true"
                          size="small"
                          [pTooltip]="t('teacher.review')"
                          (onClick)="openReviewDialog(s)"
                        ></p-button>
                      </td>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="emptymessage">
                    <tr><td colspan="6" class="text-center text-500">{{ t('history.noSessions') }}</td></tr>
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
      [header]="t('teacher.reviewSession')"
      [modal]="true"
      [style]="{ width: '600px' }"
    >
      @if (reviewSession) {
        <div class="mb-3">
          <strong>{{ t('history.quizType') }}:</strong> {{ reviewSession.quiz_type_description || reviewSession.quiz_type_code }}<br>
          <strong>{{ t('history.score') }}:</strong> {{ reviewSession.score_percent }}%<br>
          <strong>{{ t('history.date') }}:</strong> {{ reviewSession.started_at | localDate:'short' }}
        </div>

        @if (reviewDetail()) {
          <!-- View toggle + KaTeX checkbox -->
          <div class="flex align-items-center gap-3 mb-2">
            <p-selectButton
              [options]="reviewViewOptions"
              [(ngModel)]="reviewViewMode"
              optionLabel="label"
              optionValue="value"
            ></p-selectButton>
            <div class="flex align-items-center gap-2">
              <p-checkbox
                [(ngModel)]="reviewKatexEnabled"
                [binary]="true"
                inputId="teacherKatexToggle"
              ></p-checkbox>
              <label for="teacherKatexToggle">{{ t('examPaper.enableKatex') }}</label>
            </div>
          </div>

          @if (reviewViewMode === 'exam') {
            <app-exam-paper-view
              [questions]="reviewExamPaperQuestions()"
              [katexEnabled]="reviewKatexEnabled"
              [reviews]="reviewDetail()!.reviews || []"
            ></app-exam-paper-view>
          } @else {
          <h4 class="mt-0 mb-2">Questions</h4>
          <p-table [value]="reviewDetail()!.questions" styleClass="p-datatable-sm mb-3">
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 40px">#</th>
                <th>{{ t('session.question') }}</th>
                <th style="width: 80px">{{ t('session.correct') }}</th>
                <th style="width: 80px">{{ t('session.answer') }}</th>
                <th style="width: 80px">{{ t('session.status') }}</th>
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
                  {{ rev.reviewer_role === 'teacher' ? t('session.teacherReview') : t('session.parentSignoff') }}
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
              <span class="text-xs text-500">{{ (rev.updated_at || rev.created_at) | localDate:'short' }}</span>
            </div>
          }
          }
        }

        <div class="flex flex-column gap-2 mt-3">
          <label class="font-semibold">{{ t('review.quickFeedback') }}</label>
          <p-dropdown
            [options]="reviewTemplates()"
            optionLabel="label"
            optionValue="message"
            [placeholder]="t('review.selectTemplate')"
            [showClear]="true"
            (onChange)="onTemplateSelect($event)"
          ></p-dropdown>
        </div>

        <div class="flex flex-column gap-2 mt-3">
          <label class="font-semibold">{{ t('review.comment') }}</label>
          <textarea
            pInputTextarea
            [(ngModel)]="reviewComment"
            rows="3"
            class="w-full"
            [placeholder]="t('review.addComment')"
          ></textarea>
        </div>
      }

      <ng-template pTemplate="footer">
        <p-button [label]="t('common.cancel')" severity="secondary" (onClick)="reviewDialogVisible = false"></p-button>
        <p-button
          [label]="t('review.submitReview')"
          icon="pi pi-check"
          (onClick)="submitReview()"
          [loading]="reviewSubmitting()"
        ></p-button>
      </ng-template>
    </p-dialog>

    <!-- Add Student Dialog -->
    <p-dialog
      [(visible)]="addStudentDialogVisible"
      [header]="t('teacher.addStudent')"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      <p class="mb-3">{{ t('teacher.addStudentDesc') }}</p>
      <div class="flex flex-column gap-1">
        <label class="font-semibold">{{ t('teacher.studentEmail') }}</label>
        <input pInputText [(ngModel)]="addStudentEmail" class="w-full" type="email"
          [placeholder]="t('teacher.studentEmailPlaceholder')" />
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="t('common.cancel')" severity="secondary"
          (onClick)="addStudentDialogVisible = false"></p-button>
        <p-button [label]="t('teacher.addStudent')" icon="pi pi-plus"
          (onClick)="addStudent()" [disabled]="!addStudentEmail"
          [loading]="addStudentLoading()"></p-button>
      </ng-template>
    </p-dialog>
    </ng-container>
  `,
})
export class TeacherDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private translocoService = inject(TranslocoService);
  localeService = inject(LocaleService);

  loading = signal(true);
  students = signal<any[]>([]);
  badgeCounts = signal<Record<string, number>>({});
  selectedStudent: any = null;
  sessionsLoading = signal(false);
  sessions = signal<any[]>([]);

  reviewDialogVisible = false;
  reviewSession: any = null;
  reviewDetail = signal<any>(null);
  reviewComment = '';
  reviewSubmitting = signal(false);
  reviewTemplates = signal<any[]>([]);

  reviewViewMode = 'exam';
  reviewKatexEnabled = false;
  reviewViewOptions = [
    { label: '📝 Exam Paper', value: 'exam' },
    { label: '📊 Table', value: 'table' },
  ];

  addStudentDialogVisible = false;
  addStudentEmail = '';
  addStudentLoading = signal(false);

  ngOnInit() {
    this.loadStudents();
  }

  private loadStudents() {
    this.loading.set(true);
    this.api.getTeacherStudents().subscribe({
      next: (s) => {
        this.students.set(s);
        this.loading.set(false);
        this.loadBadgeCounts(s);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadBadgeCounts(students: any[]) {
    const counts: Record<string, number> = {};
    for (const s of students) {
      this.api.getUserBadgeCount(s.id).subscribe({
        next: (res: any) => {
          counts[s.id] = res.count ?? 0;
          this.badgeCounts.set({ ...counts });
        },
      });
    }
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
    this.reviewViewMode = 'exam';
    this.reviewDialogVisible = true;

    this.api.getTeacherSession(session.id).subscribe({
      next: (d) => {
        this.reviewDetail.set(d);
        // Default KaTeX based on quiz type render_mode
        this.reviewKatexEnabled = d?.session?.renderMode === 'katex';
      },
    });

    // Load templates based on score
    const locale = this.localeService.getLocale();
    this.api.getReviewTemplates('teacher', session.score_percent, locale).subscribe({
      next: (t) => this.reviewTemplates.set(t),
      error: () => this.reviewTemplates.set([]),
    });
  }

  onTemplateSelect(event: any) {
    if (event.value) {
      this.reviewComment = event.value;
    }
  }

  viewStudentHistory(student: any, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/history/user', student.id]);
  }

  reviewExamPaperQuestions(): ExamPaperQuestion[] {
    const d = this.reviewDetail();
    if (!d) return [];
    return (d.questions || []).map((q: any) => ({
      position: q.position,
      expression: q.prompt?.render || this.questionText(q),
      correct: q.correct,
      answer: q.answer ? {
        value: this.answerValue(q),
        is_correct: q.answer.is_correct,
      } : undefined,
    }));
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

  answerValue(q: any): number | string {
    if (q.answer?.response?.parsed?.value !== undefined) return q.answer.response.parsed.value;
    if (q.answer?.value !== undefined) return q.answer.value;
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
        this.messageService.add({ severity: 'success', summary: this.translocoService.translate('session.reviewed'), detail: this.translocoService.translate('review.reviewSubmitted') });
        // Refresh session list
        if (this.selectedStudent) this.onStudentSelect(this.selectedStudent);
      },
      error: () => {
        this.reviewSubmitting.set(false);
        this.messageService.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('common.error') });
      },
    });
  }

  addStudent() {
    this.addStudentLoading.set(true);
    this.api.addTeacherStudent(this.addStudentEmail).subscribe({
      next: () => {
        this.addStudentLoading.set(false);
        this.addStudentDialogVisible = false;
        this.addStudentEmail = '';
        this.messageService.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('teacher.added') });
        this.loadStudents();
      },
      error: (err: any) => {
        this.addStudentLoading.set(false);
        this.messageService.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: err.error?.detail || this.translocoService.translate('common.error') });
      },
    });
  }

  removeStudent(student: any, event: Event) {
    event.stopPropagation(); // prevent listbox selection
    this.api.removeTeacherStudent(student.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: student.name + ' ' + this.translocoService.translate('teacher.removed') });
        this.loadStudents();
        if (this.selectedStudent?.id === student.id) {
          this.selectedStudent = null;
          this.sessions.set([]);
        }
      },
      error: () => this.messageService.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('common.error') }),
    });
  }
}
