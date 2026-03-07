import {
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ApiService } from '../../core/services/api.service';
import { QuizService } from '../../core/services/quiz.service';
import { QuestionOut } from '../../models/session.model';

interface FeedbackState {
  show: boolean;
  isCorrect: boolean;
  correctValue: number;
}

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputNumberModule,
    ProgressBarModule,
    SelectButtonModule,
  ],
  template: `
    <div class="flex justify-content-center">
      <div style="max-width: 700px; width: 100%">
        @if (loading()) {
          <p class="text-center text-500">Loading quiz...</p>
        } @else if (!currentQuestion()) {
          <p class="text-center text-500">No questions available.</p>
        } @else {
          <!-- Progress -->
          <div class="mb-3">
            <div class="flex justify-content-between mb-1">
              <span class="text-sm text-500">
                Question {{ answeredCount() + 1 }} of {{ totalQuestions() }}
              </span>
              <span class="text-sm text-500">
                Score: {{ sessionCorrect() }}/{{ answeredCount() }}
              </span>
            </div>
            <p-progressBar
              [value]="progressPercent()"
              [showValue]="false"
              [style]="{ height: '8px' }"
            ></p-progressBar>
          </div>

          <!-- Feedback from previous question -->
          @if (feedback().show) {
            <div
              class="mb-3 p-3 border-round text-center text-lg font-semibold"
              [class.bg-green-100]="feedback().isCorrect"
              [class.text-green-800]="feedback().isCorrect"
              [class.bg-red-100]="!feedback().isCorrect"
              [class.text-red-800]="!feedback().isCorrect"
            >
              @if (feedback().isCorrect) {
                Correct! &#10003;
              } @else {
                Wrong — correct answer is {{ feedback().correctValue }}
              }
            </div>
          }

          <!-- Question card -->
          <p-card>
            <ng-template pTemplate="header">
              <h2 class="text-center m-0 p-3">
                {{ currentQuestion()!.prompt.render }}
              </h2>
            </ng-template>

            <ng-template pTemplate="content">
              @switch (currentQuestion()!.prompt.answer.type) {
                @case ('int') {
                  <div class="flex justify-content-center">
                    <p-inputNumber
                      #answerInput
                      [(ngModel)]="intAnswer"
                      [showButtons]="false"
                      [useGrouping]="false"
                      [autofocus]="true"
                      (keydown.enter)="submitAnswer()"
                      placeholder="Your answer"
                      [style]="{ 'font-size': '1.5rem', width: '200px' }"
                      [inputStyle]="{ 'text-align': 'center', 'font-size': '1.5rem' }"
                    ></p-inputNumber>
                  </div>
                }
                @case ('choice') {
                  <div class="flex justify-content-center">
                    <p-selectButton
                      [options]="currentQuestion()!.prompt.answer.options || []"
                      [(ngModel)]="choiceAnswer"
                    ></p-selectButton>
                  </div>
                }
              }
            </ng-template>

            <ng-template pTemplate="footer">
              <div class="flex justify-content-center">
                <p-button
                  label="Submit"
                  icon="pi pi-check"
                  (onClick)="submitAnswer()"
                  [disabled]="!hasAnswer() || submitting()"
                ></p-button>
              </div>
            </ng-template>
          </p-card>
        }
      </div>
    </div>
  `,
})
export class QuizComponent implements OnInit, AfterViewChecked {
  private api = inject(ApiService);
  private quiz = inject(QuizService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('answerInput') answerInputRef?: ElementRef;

  loading = signal(true);
  submitting = signal(false);
  questions = signal<QuestionOut[]>([]);
  currentIndex = signal(0);
  answeredCount = signal(0);
  sessionCorrect = signal(0);
  sessionWrong = signal(0);
  sessionId = '';
  needsFocus = false;

  intAnswer: number | null = null;
  choiceAnswer = '';

  feedback = signal<FeedbackState>({ show: false, isCorrect: false, correctValue: 0 });

  currentQuestion = () => {
    const qs = this.questions();
    const idx = this.currentIndex();
    return idx < qs.length ? qs[idx] : null;
  };

  totalQuestions = () => this.questions().length;
  progressPercent = () => {
    const total = this.totalQuestions();
    return total > 0 ? Math.round((this.answeredCount() / total) * 100) : 0;
  };

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') || '';
    const active = this.quiz.activeQuiz();

    if (active && active.sessionId === this.sessionId) {
      this.questions.set(active.questions);
      this.loading.set(false);
      this.needsFocus = true;
    } else {
      this.api.getSession(this.sessionId).subscribe({
        next: (detail) => {
          const unanswered = detail.questions.filter((q) => !q.answer);
          const answered = detail.questions.length - unanswered.length;
          const correct = detail.questions.filter(
            (q) => q.answer?.is_correct
          ).length;

          this.questions.set(
            unanswered.map((q) => ({
              id: q.id,
              position: q.position,
              prompt: q.prompt || {
                template: { kind: 'axb', a: q.a, b: q.b },
                answer: { type: 'int' },
                render: q.c != null
                  ? `(${q.a} × ${q.b}) + (${q.c} × ${q.d})`
                  : `${q.a} × ${q.b}`,
              },
            }))
          );
          this.answeredCount.set(answered);
          this.sessionCorrect.set(correct);
          this.sessionWrong.set(answered - correct);
          this.loading.set(false);
          this.needsFocus = true;
        },
        error: () => {
          this.loading.set(false);
        },
      });
    }
  }

  ngAfterViewChecked() {
    if (this.needsFocus) {
      this.focusInput();
      this.needsFocus = false;
    }
  }

  hasAnswer(): boolean {
    const q = this.currentQuestion();
    if (!q) return false;
    if (q.prompt.answer.type === 'int') return this.intAnswer !== null;
    if (q.prompt.answer.type === 'choice') return this.choiceAnswer !== '';
    return false;
  }

  submitAnswer() {
    if (!this.hasAnswer() || this.submitting()) return;
    const q = this.currentQuestion();
    if (!q) return;

    this.submitting.set(true);
    const answerType = q.prompt.answer.type;
    let rawValue: string;
    let parsed: Record<string, any>;

    if (answerType === 'int') {
      rawValue = String(this.intAnswer);
      parsed = { type: 'int', value: this.intAnswer };
    } else {
      rawValue = this.choiceAnswer;
      parsed = { type: 'choice', value: this.choiceAnswer };
    }

    this.api
      .submitAnswer({
        questionId: q.id,
        response: { raw: rawValue, parsed },
        value: answerType === 'int' ? this.intAnswer! : undefined,
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.sessionCorrect.set(res.session.correct);
          this.sessionWrong.set(res.session.wrong);
          this.answeredCount.set(res.session.correct + res.session.wrong);
          this.advanceWithFeedback(res.isCorrect, res.correctValue);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }

  private advanceWithFeedback(isCorrect: boolean, correctValue: number) {
    this.intAnswer = null;
    this.choiceAnswer = '';

    const nextIdx = this.currentIndex() + 1;
    if (nextIdx >= this.questions().length) {
      this.quiz.setActiveQuiz(null);
      this.router.navigate(['/history', this.sessionId]);
      return;
    }

    this.feedback.set({ show: true, isCorrect, correctValue });
    this.currentIndex.set(nextIdx);
    this.needsFocus = true;
  }

  private focusInput() {
    setTimeout(() => {
      const ref = this.answerInputRef as any;
      const el = ref?.nativeElement ?? ref?.el?.nativeElement;
      if (el) {
        const input = el.querySelector?.('input') || el;
        input?.focus?.();
        return;
      }
      const fallback = document.querySelector<HTMLInputElement>('p-inputNumber input');
      fallback?.focus();
    }, 100);
  }
}
