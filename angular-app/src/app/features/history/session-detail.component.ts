import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { SessionDetail } from '../../models/session.model';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [CommonModule, CardModule, TableModule, TagModule, DurationPipe, LocalDatePipe, TranslocoModule],
  template: `
    <ng-container *transloco="let t">
    @if (loading()) {
      <p class="text-500">{{ t('session.loading') }}</p>
    } @else if (!detail()) {
      <p class="text-500">{{ t('session.notFound') }}</p>
    } @else {
      <h2>{{ t('session.detail') }}</h2>

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

      <!-- Questions table -->
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
    </ng-container>
  `,
})
export class SessionDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  detail = signal<SessionDetail | null>(null);
  reviews = signal<any[]>([]);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('sessionId') || '';
    this.api.getSession(id).subscribe({
      next: (d: any) => {
        this.detail.set(d);
        if (d.reviews) {
          this.reviews.set(d.reviews);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
}
