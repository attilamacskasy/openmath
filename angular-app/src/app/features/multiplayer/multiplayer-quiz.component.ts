import { Component, DestroyRef, inject, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslocoModule } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { MultiplayerWsService } from '../../core/services/multiplayer-ws.service';
import { MultiplayerQuestion, GameResult } from '../../models/multiplayer.model';
import { KatexPipe } from '../../shared/pipes/katex.pipe';

@Component({
  selector: 'app-multiplayer-quiz',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule,
    InputTextModule, TagModule, ToolbarModule, ToastModule,
    TranslocoModule, KatexPipe,
  ],
  providers: [MessageService],
  template: `
    <ng-container *transloco="let t">
      <p-toast></p-toast>

      <!-- Timer toolbar -->
      <p-toolbar styleClass="mb-3">
        <ng-template pTemplate="start">
          <div class="flex align-items-center gap-3">
            <p-tag severity="info" [value]="'Q ' + (currentIndex() + 1) + '/' + questions().length"></p-tag>
            <p-tag severity="secondary" [value]="t('multiplayer.game.elapsed') + ': ' + formatTime(elapsedMs())"></p-tag>
            @if (penaltyMs() > 0) {
              <p-tag severity="danger" [value]="t('multiplayer.game.penalty') + ': +' + formatTime(penaltyMs())"></p-tag>
            }
            <p-tag severity="warning" [value]="t('multiplayer.game.totalTime') + ': ' + formatTime(elapsedMs() + penaltyMs())"></p-tag>
          </div>
        </ng-template>
      </p-toolbar>

      @if (finished()) {
        <div class="flex justify-content-center">
          <p-card [header]="t('multiplayer.game.waiting')" [style]="{ 'max-width': '600px', width: '100%' }">
            <div class="text-center">
              <i class="pi pi-spin pi-spinner text-4xl mb-3"></i>
              <p>{{ t('multiplayer.game.waitingOthers') }}</p>
              <p class="text-lg font-bold">{{ correctCount() }}/{{ questions().length }} {{ t('multiplayer.game.correct') }}</p>
              <p>{{ t('multiplayer.game.totalTime') }}: {{ formatTime(totalTimeMs()) }}</p>
            </div>
          </p-card>
        </div>
      } @else {
        @if (currentQuestion(); as q) {
        <div class="flex justify-content-center">
          <p-card [style]="{ 'max-width': '600px', width: '100%' }">
            <!-- Question indicators -->
            <div class="flex gap-1 mb-3 flex-wrap">
              @for (qi of questions(); track qi.id; let i = $index) {
                <p-tag
                  [value]="'' + (i + 1)"
                  [severity]="indicatorSeverity(i)"
                  [class.ring-2]="i === currentIndex()"
                  styleClass="w-2rem text-center"
                ></p-tag>
              }
            </div>

            <!-- Question display -->
            <div class="text-center mb-4" [class.penalty-flash]="showPenaltyFlash()">
              <div class="text-4xl font-bold mb-2" [innerHTML]="q.prompt?.render_html || q.prompt?.render || ''"></div>
              @if (q.prompt?.render && q.prompt?.template?.kind === 'basic_fractions') {
                <div class="text-4xl font-bold mb-2" [innerHTML]="q.prompt.render | katex"></div>
              }
            </div>

            <!-- Answer input -->
            <div class="flex justify-content-center gap-2 mb-3">
              <input pInputText [(ngModel)]="answerValue" [placeholder]="t('quiz.yourAnswer')"
                class="text-center text-xl" style="max-width: 200px;"
                (keyup.enter)="submitAnswer()" autofocus />
              <p-button icon="pi pi-check" [label]="t('quiz.submit')"
                (onClick)="submitAnswer()" [disabled]="!answerValue.trim()"></p-button>
            </div>
          </p-card>
        </div>
        }
      }

      <style>
        .penalty-flash {
          animation: penaltyFlash 0.5s ease-in-out;
        }
        @keyframes penaltyFlash {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(239, 68, 68, 0.2); }
        }
      </style>
    </ng-container>
  `,
})
export class MultiplayerQuizComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ws = inject(MultiplayerWsService);
  private messageService = inject(MessageService);
  private destroyRef = inject(DestroyRef);

  gameCode = '';
  questions = signal<MultiplayerQuestion[]>([]);
  currentIndex = signal(0);
  answerValue = '';
  answerResults = signal<Map<number, boolean>>(new Map());
  elapsedMs = signal(0);
  penaltyMs = signal(0);
  totalTimeMs = signal(0);
  correctCount = signal(0);
  finished = signal(false);
  showPenaltyFlash = signal(false);
  private startTime = 0;
  private timerInterval: any;

  currentQuestion = computed(() => {
    const qs = this.questions();
    const idx = this.currentIndex();
    return idx < qs.length ? qs[idx] : null;
  });

  ngOnInit() {
    this.gameCode = this.route.snapshot.paramMap.get('code') || '';

    // Check if game_started already fired before this component mounted
    // (lobby navigates here AFTER receiving game_started, so the event is already gone)
    const cached = this.ws.lastGameStarted();
    if (cached && cached.questions?.length) {
      console.log('[QUIZ] Using cached game_started payload:', cached.questions.length, 'questions');
      this.questions.set(cached.questions);
      this.startTime = Date.now();
      this.startTimer();
    }

    // Also subscribe for future game_started events (in case component mounts before event)
    this.ws.onMessage('game_started').subscribe((p) => {
      if (this.questions().length === 0) {
        console.log('[QUIZ] Received game_started via subscription:', (p.questions || []).length, 'questions');
        this.questions.set(p.questions || []);
        this.startTime = Date.now();
        this.startTimer();
      }
    });

    this.ws.onMessage('answer_result').subscribe((p) => {
      const idx = this.currentIndex();
      this.answerResults.update((m) => {
        const copy = new Map(m);
        copy.set(idx, p.is_correct);
        return copy;
      });

      if (!p.is_correct) {
        this.penaltyMs.set(p.total_time_ms - p.elapsed_ms);
        this.showPenaltyFlash.set(true);
        setTimeout(() => this.showPenaltyFlash.set(false), 500);
      }

      this.totalTimeMs.set(p.total_time_ms);
      if (p.is_correct) this.correctCount.update((c) => c + 1);

      // Move to next question
      if (idx + 1 < this.questions().length) {
        this.currentIndex.set(idx + 1);
        this.answerValue = '';
      } else {
        this.finished.set(true);
        this.stopTimer();
      }
    });

    this.ws.onMessage('game_completed').subscribe((p) => {
      // Navigate to results or lobby for results display
      this.router.navigate(['/multiplayer/lobby', this.gameCode], {
        queryParams: { results: true },
      });
    });

    this.ws.onMessage('game_ended').subscribe(() => {
      this.router.navigate(['/multiplayer']);
    });
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.elapsedMs.set(Date.now() - this.startTime);
    }, 100);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  submitAnswer() {
    const q = this.currentQuestion();
    if (!q || !this.answerValue.trim()) return;

    this.ws.send('submit_answer', {
      question_id: q.id,
      value: this.answerValue.trim(),
    });
  }

  indicatorSeverity(index: number): 'success' | 'danger' | 'warning' | 'info' | 'secondary' {
    const result = this.answerResults().get(index);
    if (result === true) return 'success';
    if (result === false) return 'danger';
    if (index === this.currentIndex()) return 'warning';
    return 'secondary';
  }

  formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  }
}
