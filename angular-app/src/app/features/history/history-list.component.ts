import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SessionListItem } from '../../models/session.model';
import { QuizType } from '../../models/quiz-type.model';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

interface GroupedSessions {
  code: string;
  description: string;
  sessions: SessionListItem[];
}

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
    ConfirmDialogModule,
    ToastModule,
    DurationPipe,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <h2>Session History</h2>

    @if (loading()) {
      <p class="text-500">Loading...</p>
    } @else if (grouped().length === 0) {
      <p class="text-500">No sessions found.</p>
    } @else {
      @for (group of grouped(); track group.code) {
        <p-card [header]="group.description" styleClass="mb-3">
          <p-table [value]="group.sessions" [rows]="20" [paginator]="group.sessions.length > 20" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Student</th>
                <th>Difficulty</th>
                <th>Questions</th>
                <th>Time</th>
                <th>Avg/Q</th>
                <th>Score</th>
                <th>Started</th>
                <th>Finished</th>
                @if (auth.isAdmin()) {
                  <th></th>
                }
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-s>
              <tr>
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
        </p-card>
      }
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
  grouped = signal<GroupedSessions[]>([]);

  ngOnInit() {
    this.api.getQuizTypes().subscribe((types) => {
      this.quizTypes.set(types);
      this.loadSessions();
    });
  }

  loadSessions() {
    // API already filters: students see own, admins see all
    this.api.getSessions().subscribe((sessions) => {
      this.allSessions.set(sessions);
      this.buildGroups(sessions);
      this.loading.set(false);
    });
  }

  private buildGroups(sessions: SessionListItem[]) {
    const types = this.quizTypes();
    const map = new Map<string, GroupedSessions>();

    for (const s of sessions) {
      const code = s.quiz_type_code || 'unknown';
      if (!map.has(code)) {
        const qt = types.find((t) => t.code === code);
        map.set(code, {
          code,
          description: qt?.description || code,
          sessions: [],
        });
      }
      map.get(code)!.sessions.push(s);
    }

    this.grouped.set(Array.from(map.values()).sort((a, b) => a.description.localeCompare(b.description)));
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
