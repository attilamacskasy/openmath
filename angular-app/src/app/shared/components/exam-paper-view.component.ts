import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { KatexPipe } from '../../shared/pipes/katex.pipe';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

export interface ExamPaperQuestion {
  position: number;
  expression: string;
  correct: number | string;
  answer?: {
    value: number | string;
    is_correct: boolean;
  };
}

export interface ExamPaperReview {
  id: string;
  reviewer_role: string;
  reviewer_name: string;
  status: string;
  comment?: string;
  updated_at?: string;
  created_at?: string;
}

@Component({
  selector: 'app-exam-paper-view',
  standalone: true,
  imports: [CommonModule, TranslocoModule, KatexPipe, DurationPipe],
  template: `
    <ng-container *transloco="let t">
    <div class="exam-paper">
      @for (q of questions; track q.position) {
        <div class="exam-question">
          <span class="exam-question-number">{{ q.position }}.</span>
          <span class="exam-expression">
            @if (katexEnabled) {
              <span class="katex-inline" [innerHTML]="q.expression | katex:true"></span>
            } @else {
              {{ q.expression }}
            }

            <span class="exam-equals">=</span>

            @if (!q.answer) {
              <!-- Unanswered -->
              <span class="exam-unanswered">&mdash;</span>
            } @else if (q.answer.is_correct) {
              <!-- Correct -->
              @if (katexEnabled && isKatexExpr(String(q.answer.value))) {
                <span class="katex-inline" [innerHTML]="toKatex(String(q.answer.value)) | katex:true"></span>
              } @else {
                <span>{{ q.answer.value }}</span>
              }
              <span class="exam-correct-mark">✓</span>
            } @else {
              <!-- Wrong -->
              <span class="exam-wrong-answer">
                @if (katexEnabled && isKatexExpr(String(q.answer.value))) {
                  <span class="katex-inline" [innerHTML]="toKatex(String(q.answer.value)) | katex:true"></span>
                } @else {
                  {{ q.answer.value }}
                }
              </span>
              <span class="exam-correct-answer">
                @if (katexEnabled && isKatexExpr(String(q.correct))) {
                  <span class="katex-inline" [innerHTML]="toKatex(String(q.correct)) | katex:true"></span>
                } @else {
                  {{ q.correct }}
                }
              </span>
            }
          </span>
        </div>
      }

      <!-- Score Summary -->
      <div class="exam-summary">
        <div class="exam-summary-line">
          <strong>{{ t('examPaper.score') }}:</strong>
          {{ correctCount }} / {{ questions.length }}
          ({{ scorePercent }}%)
        </div>
        @if (startedAt && finishedAt) {
          <div class="exam-summary-line">
            <strong>{{ t('examPaper.time') }}:</strong>
            {{ startedAt | duration : finishedAt }}
          </div>
        }
      </div>

      <!-- Reviews -->
      @if (reviews.length > 0) {
        <div class="exam-reviews">
          @for (rev of reviews; track rev.id) {
            <div class="exam-review-item">
              <strong>
                {{ rev.reviewer_role === 'teacher' ? t('session.teacherReview') : t('session.parentSignoff') }}:
              </strong>
              @if (rev.comment) {
                <em>"{{ rev.comment }}"</em>
              }
            </div>
          }
        </div>
      }
    </div>
    </ng-container>
  `,
  styles: [`
    .exam-paper {
      max-width: 700px;
      padding: 1.5rem;
      font-size: 1.25rem;
      line-height: 2.5;
      font-family: inherit;
    }

    .exam-question {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
      min-height: 2.5em;
    }

    .exam-question-number {
      min-width: 2rem;
      text-align: right;
      color: #333;
    }

    .exam-expression {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .katex-inline {
      display: inline-flex;
      align-items: center;
    }

    .exam-equals {
      margin: 0 0.25rem;
    }

    .exam-correct-mark {
      color: #e53935;
      font-size: 1.4rem;
      margin-left: 0.5rem;
    }

    .exam-wrong-answer {
      position: relative;
      color: #999;
    }

    .exam-wrong-answer::after {
      content: '';
      position: absolute;
      left: -2px;
      right: -2px;
      top: 50%;
      border-bottom: 2px solid #e53935;
    }

    .exam-correct-answer {
      color: #e53935;
      font-weight: 600;
      margin-left: 0.5rem;
    }

    .exam-unanswered {
      color: #999;
    }

    .exam-summary {
      border-top: 2px solid #ccc;
      margin-top: 1rem;
      padding-top: 0.75rem;
      font-size: 1.1rem;
      line-height: 2;
    }

    .exam-summary-line {
      margin-bottom: 0.25rem;
    }

    .exam-reviews {
      border-top: 1px solid #ddd;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      font-size: 1rem;
      line-height: 1.8;
    }

    .exam-review-item {
      margin-bottom: 0.5rem;
    }
  `],
})
export class ExamPaperViewComponent {
  @Input() questions: ExamPaperQuestion[] = [];
  @Input() katexEnabled = false;
  @Input() startedAt: string | null = null;
  @Input() finishedAt: string | null = null;
  @Input() reviews: ExamPaperReview[] = [];

  // Helper to convert to string in template
  String = String;

  get correctCount(): number {
    return this.questions.filter(q => q.answer?.is_correct).length;
  }

  get scorePercent(): number {
    return this.questions.length > 0
      ? Math.round((this.correctCount / this.questions.length) * 100)
      : 0;
  }

  /** Check whether a value should be rendered via KaTeX. */
  isKatexExpr(value: string): boolean {
    if (value.includes('\\frac') || value.includes('\\times') || value.includes('\\')) {
      return true;
    }
    // Detect plain fractions like "1/2", "7/2"
    return /^\d+\/\d+$/.test(value.trim());
  }

  /** Convert plain fractions (e.g. "1/2") to KaTeX \frac{}{} notation. */
  toKatex(value: string): string {
    // Already contains KaTeX markup — return as-is
    if (value.includes('\\')) return value;
    // Plain fraction like "3/4"
    const m = value.trim().match(/^(\d+)\/(\d+)$/);
    if (m) return `\\frac{${m[1]}}{${m[2]}}`;
    return value;
  }
}
