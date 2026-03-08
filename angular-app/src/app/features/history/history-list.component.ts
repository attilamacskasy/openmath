import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService, QuizTypesResponse } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SessionListItem } from '../../models/session.model';
import { QuizType } from '../../models/quiz-type.model';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

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
    TooltipModule,
    DurationPipe,
    LocalDatePipe,
    TranslocoModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <ng-container *transloco="let t">
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <h2>{{ viewingUserName() ? viewingUserName() + t('history.userHistory') : t('history.title') }}</h2>

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
      <p class="text-500">{{ t('common.loading') }}</p>
    } @else if (filteredSessions().length === 0) {
      <p class="text-500">{{ t('history.noSessions') }}</p>
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
            <th pSortableColumn="quiz_type_description">{{ t('history.quizType') }} <p-sortIcon field="quiz_type_description"></p-sortIcon></th>
            <th>{{ t('history.user') }}</th>
            <th>{{ t('history.difficulty') }}</th>
            <th>{{ t('history.questionsCol') }}</th>
            <th>{{ t('history.time') }}</th>
            <th>{{ t('history.avgQ') }}</th>
            <th pSortableColumn="score_percent">{{ t('history.score') }} <p-sortIcon field="score_percent"></p-sortIcon></th>
            <th pSortableColumn="started_at">{{ t('history.started') }} <p-sortIcon field="started_at"></p-sortIcon></th>
            <th>{{ t('history.finished') }}</th>
            <th></th>
            @if (auth.isAdmin()) {
              <th></th>
            }
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-s>
          <tr>
            <td>{{ s.quiz_type_description || s.quiz_type_code || '—' }}</td>
            <td>{{ s.user_name || '—' }}</td>
            <td>
              <a [routerLink]="['/history', s.id]" class="text-primary no-underline">
                {{ t('difficulty.' + s.difficulty) }}
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
            <td>{{ s.started_at | localDate : 'short' }}</td>
            <td>
              @if (s.finished_at) {
                {{ s.finished_at | localDate : 'short' }}
              } @else {
                <a [routerLink]="['/quiz', s.id]" class="text-orange-500 no-underline font-semibold">
                  {{ t('history.inProgress') }}
                </a>
              }
            </td>
            <td>
              <p-button
                icon="pi pi-file-pdf"
                severity="info"
                [text]="true"
                [rounded]="true"
                size="small"
                [pTooltip]="t('session.exportPdf')"
                (onClick)="exportPdf(s)"
              ></p-button>
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
    </ng-container>
  `,
})
export class HistoryListComponent implements OnInit {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  private confirm = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translocoService = inject(TranslocoService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  allSessions = signal<SessionListItem[]>([]);
  quizTypes = signal<QuizType[]>([]);
  selectedQuizTypeCode = '';
  viewingUserId = signal<string | null>(null);
  viewingUserName = signal<string | null>(null);

  filteredSessions = computed(() => {
    const sessions = this.allSessions();
    if (!this.selectedQuizTypeCode) return sessions;
    return sessions.filter((s) => s.quiz_type_code === this.selectedQuizTypeCode);
  });

  quizTypeFilterOptions = computed(() => {
    const types = this.quizTypes();
    const allLabel = this.translocoService.translate('history.allQuizTypes');
    const options = [{ label: allLabel, value: '' }];
    for (const qt of types) {
      options.push({ label: qt.description, value: qt.code });
    }
    return options;
  });

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('userId');
    if (userId) {
      this.viewingUserId.set(userId);
      // Fetch user name for display
      this.api.getUser(userId).subscribe({
        next: (u: any) => this.viewingUserName.set(u.name || u.email || 'Student'),
        error: () => this.viewingUserName.set('Student'),
      });
    }
    this.api.getQuizTypes().subscribe((resp: QuizTypesResponse) => {
      this.quizTypes.set(resp.types);
      this.loadSessions();
    });
  }

  loadSessions() {
    const userId = this.viewingUserId();
    const obs = userId ? this.api.getUserSessions(userId) : this.api.getSessions();
    obs.subscribe((sessions) => {
      this.allSessions.set(sessions);
      this.loading.set(false);
    });
  }

  confirmDelete(s: SessionListItem) {
    this.confirm.confirm({
      message: this.translocoService.translate('history.confirmDelete'),
      header: this.translocoService.translate('history.confirmDeleteHeader'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deleteSession(s.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('history.deleted') });
            this.loadSessions();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('history.deleteFailed') });
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

  exportPdf(s: SessionListItem): void {
    this.api.exportSessionPdf(s.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_${s.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translocoService.translate('session.exportFailed'),
        });
      },
    });
  }
}
