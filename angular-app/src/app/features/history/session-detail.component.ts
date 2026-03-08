import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { SessionDetail } from '../../models/session.model';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ExamPaperViewComponent, ExamPaperQuestion } from '../../shared/components/exam-paper-view.component';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, TableModule, TagModule, ButtonModule, ToastModule, SelectButtonModule, CheckboxModule, DurationPipe, LocalDatePipe, TranslocoModule, ExamPaperViewComponent],
  providers: [MessageService],
  template: `
    <ng-container *transloco="let t">
    @if (loading()) {
      <p class="text-500">{{ t('session.loading') }}</p>
    } @else if (!detail()) {
      <p class="text-500">{{ t('session.notFound') }}</p>
    } @else {
      <div class="flex align-items-center justify-content-between mb-2">
        <h2 class="m-0">{{ t('session.detail') }}</h2>
        <p-button
          [label]="t('session.exportPdf')"
          icon="pi pi-file-pdf"
          severity="info"
          [outlined]="true"
          size="small"
          (onClick)="exportPdf()"
          [loading]="exporting()"
        ></p-button>
      </div>

      <!-- Summary -->
      <p-card styleClass="mb-3">
        <div class="grid">
          <div class="col-6 md:col-3">
            <div class="text-500 text-sm">{{ t('session.user') }}</div>
            <div class="font-semibold">{{ detail()!.session.userName || '—' }}</div>
          </div>
          <div class="col-6 md:col-3">
            <div class="text-500 text-sm">{{ t('session.difficulty') }}</div>
            <div class="font-semibold capitalize">{{ t('difficulty.' + detail()!.session.difficulty) }}</div>
          </div>
          <div class="col-6 md:col-3">
            <div class="text-500 text-sm">{{ t('session.score') }}</div>
            <div class="font-semibold">
              {{ detail()!.session.correct_count }}/{{ detail()!.session.total_questions }}
              ({{ detail()!.session.score_percent }}%)
            </div>
          </div>
          <div class="col-6 md:col-3">
            <div class="text-500 text-sm">{{ t('session.duration') }}</div>
            <div class="font-semibold">
              {{ detail()!.session.started_at | duration : detail()!.session.finished_at }}
            </div>
          </div>
        </div>
      </p-card>

      <!-- View toggle + KaTeX checkbox -->
      <div class="flex align-items-center gap-3 mb-3">
        <p-selectButton
          [options]="viewOptions"
          [(ngModel)]="viewMode"
          optionLabel="label"
          optionValue="value"
        ></p-selectButton>
        <div class="flex align-items-center gap-2">
          <p-checkbox
            [(ngModel)]="katexEnabled"
            [binary]="true"
            inputId="katexToggle"
          ></p-checkbox>
          <label for="katexToggle">{{ t('examPaper.enableKatex') }}</label>
        </div>
      </div>

      @if (viewMode === 'exam') {
        <!-- Exam Paper View -->
        <app-exam-paper-view
          [questions]="examPaperQuestions()"
          [katexEnabled]="katexEnabled"
          [startedAt]="detail()!.session.started_at"
          [finishedAt]="detail()!.session.finished_at"
          [reviews]="reviews()"
        ></app-exam-paper-view>
      } @else {
        <!-- Table View (existing) -->
        <p-table [value]="detail()!.questions" styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 60px">#</th>
              <th>{{ t('session.question') }}</th>
              <th style="width: 100px">{{ t('session.correct') }}</th>
              <th style="width: 100px">{{ t('session.answer') }}</th>
              <th style="width: 100px">{{ t('session.status') }}</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-q>
            <tr>
              <td>{{ q.position }}</td>
              <td>
                @if (q.prompt?.render_html) {
                  <span [innerHTML]="q.prompt.render_html"></span>
                } @else {
                  {{ questionText(q) }}
                }
              </td>
              <td class="font-semibold">{{ q.correct }}</td>
              <td>{{ answerText(q) }}</td>
              <td>
                @if (!q.answer) {
                  <p-tag value="—" severity="info"></p-tag>
                } @else if (q.answer.is_correct) {
                  <p-tag [value]="t('quiz.correct')" severity="success"></p-tag>
                } @else {
                  <p-tag [value]="t('quiz.wrong')" severity="danger"></p-tag>
                }
              </td>
            </tr>
          </ng-template>
        </p-table>

        <!-- Reviews panel -->
        @if (reviews().length > 0) {
          <h3 class="mt-4 mb-2">{{ t('session.reviews') }}</h3>
          @for (rev of reviews(); track rev.id) {
            <div class="surface-100 border-round p-3 mb-2">
              <div class="flex justify-content-between">
                <span class="font-semibold">
                  {{ rev.reviewer_role === 'teacher' ? t('session.teacherReview') : t('session.parentSignoff') }}
                  — {{ rev.reviewer_name }}
                </span>
                <p-tag
                  [value]="rev.status === 'signed' ? t('session.signed') : t('session.reviewed')"
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
    }
    </ng-container>
  `,
})
export class SessionDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private transloco = inject(TranslocoService);

  loading = signal(true);
  exporting = signal(false);
  detail = signal<SessionDetail | null>(null);
  reviews = signal<any[]>([]);

  viewMode = 'exam';
  katexEnabled = false;
  viewOptions = [
    { label: '📝 Exam Paper', value: 'exam' },
    { label: '📊 Table', value: 'table' },
  ];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('sessionId') || '';
    this.api.getSession(id).subscribe({
      next: (d: any) => {
        this.detail.set(d);
        if (d.reviews) {
          this.reviews.set(d.reviews);
        }
        // Default KaTeX enabled based on quiz type render_mode
        this.katexEnabled = d.session?.renderMode === 'katex';
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  examPaperQuestions(): ExamPaperQuestion[] {
    const d = this.detail();
    if (!d) return [];
    return d.questions.map(q => ({
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
    if (q.answer.response?.parsed?.value !== undefined)
      return String(q.answer.response.parsed.value);
    if (q.answer.value !== undefined) return String(q.answer.value);
    return '—';
  }

  answerValue(q: any): number | string {
    if (q.answer?.response?.parsed?.value !== undefined)
      return q.answer.response.parsed.value;
    if (q.answer?.value !== undefined) return q.answer.value;
    return '—';
  }

  exportPdf(): void {
    const d = this.detail();
    if (!d) return;
    this.exporting.set(true);
    this.api.exportSessionPdf(d.session.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_${d.session.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.transloco.translate('session.exportFailed'),
        });
        this.exporting.set(false);
      },
    });
  }
}
