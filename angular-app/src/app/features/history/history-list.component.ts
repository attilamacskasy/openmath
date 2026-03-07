import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService, QuizTypesResponse } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SessionListItem } from '../../models/session.model';
import { QuizType } from '../../models/quiz-type.model';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TableModule,
    CardModule,
    TagModule,
    ButtonModule,
    DropdownModule,
    ConfirmDialogModule,
    ToastModule,
    DurationPipe,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <h2>Session History</h2>

    <!-- Quiz Type Filter -->
    <div class="mb-3">
      <p-dropdown
        [options]="quizTypeFilterOptions()"
        [(ngModel)]="selectedQuizTypeCode"
        optionLabel="label"
        optionValue="value"
        [style]="{ 'min-width': '300px' }"
      ></p-dropdown>
    </div>

    @if (loading()) {
      <p class="text-500">Loading...</p>
    } @else if (filteredSessions().length === 0) {
      <p class="text-500">No sessions found.</p>
    } @else {
      <p-table
        [value]="filteredSessions()"
        [rows]="20"
        [paginator]="filteredSessions().length > 20"
        [sortField]="'started_at'"
        [sortOrder]="-1"
        styleClass="p-datatable-sm p-datatable-striped"
      >
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="quiz_type_description">Quiz Type <p-sortIcon field="quiz_type_description"></p-sortIcon></th>
            <th>Student</th>
            <th>Difficulty</th>
            <th>Questions</th>
            <th>Time</th>
            <th>Avg/Q</th>
            <th pSortableColumn="score_percent">Score <p-sortIcon field="score_percent"></p-sortIcon></th>
            <th pSortableColumn="started_at">Started <p-sortIcon field="started_at"></p-sortIcon></th>
            <th>Finished</th>
            @if (auth.isAdmin()) {
              <th></th>
            }
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-s>
          <tr>
            <td>{{ s.quiz_type_description || s.quiz_type_code || '—' }}</td>
            <td>{{ s.student_name || '—' }}</td>
            <td>
              <a [routerLink]="['/history', s.id]" class="text-primary no-underline">
                {{ s.difficulty }}
              </a>
            </td>
            <td>{{ s.total_questions }}</td>
            <td>{{ s.started_at | duration : s.finished_at }}</td>
            <td>{{ avgPerQuestion(s) }}</td>
            <td>
              <p-tag
                [value]="s.score_percent + '%'"
                [severity]="scoreSeverity(s.score_percent)"
              ></p-tag>
            </td>
            <td>{{ s.started_at | date : 'short' }}</td>
            <td>
              @if (s.finished_at) {
                {{ s.finished_at | date : 'short' }}
              } @else {
                <a [routerLink]="['/quiz', s.id]" class="text-orange-500 no-underline font-semibold">
                  In progress
                </a>
              }
            </td>
            @if (auth.isAdmin()) {
              <td>
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  [rounded]="true"
                  size="small"
                  (onClick)="confirmDelete(s)"
                ></p-button>
              </td>
            }
          </tr>
        </ng-template>
      </p-table>
    }
  `,
})
export class HistoryListComponent implements OnInit {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  private confirm = inject(ConfirmationService);
  private messageService = inject(MessageService);

  loading = signal(true);
  allSessions = signal<SessionListItem[]>([]);
  quizTypes = signal<QuizType[]>([]);
  selectedQuizTypeCode = '';

  filteredSessions = computed(() => {
    const sessions = this.allSessions();
    if (!this.selectedQuizTypeCode) return sessions;
    return sessions.filter((s) => s.quiz_type_code === this.selectedQuizTypeCode);
  });

  quizTypeFilterOptions = computed(() => {
    const types = this.quizTypes();
    const options = [{ label: 'All Quiz Types', value: '' }];
    for (const qt of types) {
      options.push({ label: qt.description, value: qt.code });
    }
    return options;
  });

  ngOnInit() {
    this.api.getQuizTypes().subscribe((resp: QuizTypesResponse) => {
      this.quizTypes.set(resp.types);
      this.loadSessions();
    });
  }

  loadSessions() {
    this.api.getSessions().subscribe((sessions) => {
      this.allSessions.set(sessions);
      this.loading.set(false);
    });
  }

  confirmDelete(s: SessionListItem) {
    this.confirm.confirm({
      message: 'Delete this session? This will permanently remove the session, all its questions, and all answers.',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deleteSession(s.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Session deleted' });
            this.loadSessions();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete session' });
          },
        });
      },
    });
  }

  avgPerQuestion(s: SessionListItem): string {
    if (!s.started_at) return '—';
    const end = s.finished_at ? new Date(s.finished_at).getTime() : Date.now();
    const secs = Math.max(0, (end - new Date(s.started_at).getTime()) / 1000);
    const avg = s.total_questions > 0 ? secs / s.total_questions : 0;
    return avg > 0 ? `${avg.toFixed(1)}s` : '—';
  }

  scoreSeverity(percent: number): 'success' | 'info' | 'warning' | 'danger' {
    if (percent >= 80) return 'success';
    if (percent >= 60) return 'info';
    if (percent >= 40) return 'warning';
    return 'danger';
  }
}
