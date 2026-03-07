import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { SessionDetail } from '../../models/session.model';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [CommonModule, CardModule, TableModule, TagModule, DurationPipe],
  template: `
    @if (loading()) {
      <p class="text-500">Loading session...</p>
    } @else if (!detail()) {
      <p class="text-500">Session not found.</p>
    } @else {
      <h2>Session Detail</h2>

      <!-- Summary -->
      <p-card styleClass="mb-3">
        <div class="grid">
          <div class="col-6 md:col-3">
            <div class="text-500 text-sm">User</div>
            <div class="font-semibold">{{ detail()!.session.userName || '—' }}</div>
          </div>
          <div class="col-6 md:col-3">
            <div class="text-500 text-sm">Difficulty</div>
            <div class="font-semibold capitalize">{{ detail()!.session.difficulty }}</div>
          </div>
          <div class="col-6 md:col-3">
            <div class="text-500 text-sm">Score</div>
            <div class="font-semibold">
              {{ detail()!.session.correct_count }}/{{ detail()!.session.total_questions }}
              ({{ detail()!.session.score_percent }}%)
            </div>
          </div>
          <div class="col-6 md:col-3">
            <div class="text-500 text-sm">Duration</div>
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
            <th>Question</th>
            <th style="width: 100px">Correct</th>
            <th style="width: 100px">Answer</th>
            <th style="width: 100px">Status</th>
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
                <p-tag value="Correct" severity="success"></p-tag>
              } @else {
                <p-tag value="Wrong" severity="danger"></p-tag>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>

      <!-- Reviews panel -->
      @if (reviews().length > 0) {
        <h3 class="mt-4 mb-2">Reviews</h3>
        @for (rev of reviews(); track rev.id) {
          <div class="surface-100 border-round p-3 mb-2">
            <div class="flex justify-content-between">
              <span class="font-semibold">
                {{ rev.reviewer_role === 'teacher' ? 'Teacher review' : 'Parent sign-off' }}
                — {{ rev.reviewer_name }}
              </span>
              <p-tag
                [value]="rev.status === 'signed' ? 'Signed' : 'Reviewed'"
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
    }
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
