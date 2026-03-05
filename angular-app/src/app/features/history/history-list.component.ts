import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { QuizService } from '../../core/services/quiz.service';
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
    CheckboxModule,
    TagModule,
    DurationPipe,
  ],
  template: `
    <h2>Session History</h2>

    <div class="flex align-items-center gap-2 mb-3">
      <p-checkbox
        [(ngModel)]="myResultsOnly"
        [binary]="true"
        inputId="myResults"
        (onChange)="filterSessions()"
      ></p-checkbox>
      <label for="myResults">Show only my results</label>
    </div>

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
  private quiz = inject(QuizService);

  loading = signal(true);
  allSessions = signal<SessionListItem[]>([]);
  quizTypes = signal<QuizType[]>([]);
  grouped = signal<GroupedSessions[]>([]);
  myResultsOnly = true;

  ngOnInit() {
    this.api.getQuizTypes().subscribe((types) => {
      this.quizTypes.set(types);
      this.api.getSessions().subscribe((sessions) => {
        this.allSessions.set(sessions);
        this.filterSessions();
        this.loading.set(false);
      });
    });
  }

  filterSessions() {
    const studentId = this.quiz.currentStudentId();
    let sessions = this.allSessions();
    if (this.myResultsOnly && studentId) {
      sessions = sessions.filter((s) => s.student_id === studentId);
    }

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
