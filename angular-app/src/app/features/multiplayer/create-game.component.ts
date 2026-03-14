import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageModule } from 'primeng/message';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApiService, QuizTypesResponse } from '../../core/services/api.service';
import { MultiplayerService } from '../../core/services/multiplayer.service';
import { QuizType } from '../../models/quiz-type.model';

@Component({
  selector: 'app-create-game',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, DropdownModule,
    SelectButtonModule, InputNumberModule, ButtonModule,
    MultiSelectModule, MessageModule, TranslocoModule,
  ],
  template: `
    <ng-container *transloco="let t">
      <div class="flex justify-content-center">
        <p-card [header]="t('multiplayer.create.title')" [style]="{ 'max-width': '600px', width: '100%' }">
          <div class="flex flex-column gap-3">

            <div class="flex flex-column gap-1">
              <label class="font-semibold">{{ t('quiz.quizType') }}</label>
              <p-dropdown
                [options]="quizTypeOptions()"
                [(ngModel)]="quizTypeCode"
                optionLabel="label"
                optionValue="value"
                [placeholder]="t('quiz.selectQuizType')"
              ></p-dropdown>
            </div>

            <div class="flex flex-column gap-1">
              <label class="font-semibold">{{ t('quiz.difficulty') }}</label>
              <p-dropdown
                [options]="difficultyOptions"
                [(ngModel)]="difficulty"
                optionLabel="label"
                optionValue="value"
              ></p-dropdown>
            </div>

            @if (showTimetables()) {
              <div class="flex flex-column gap-1">
                <label class="font-semibold">{{ t('quiz.learnedTimetables') }}</label>
                <p-multiSelect
                  [options]="timetableOptions"
                  [(ngModel)]="learnedTimetables"
                  [placeholder]="t('quiz.selectTimetables')"
                  optionLabel="label"
                  optionValue="value"
                  [showToggleAll]="true"
                ></p-multiSelect>
              </div>
            }

            <div class="flex flex-column gap-1">
              <label class="font-semibold">{{ t('multiplayer.create.questions') }}</label>
              <p-selectButton
                [options]="questionOptions"
                [(ngModel)]="totalQuestions"
                optionLabel="label"
                optionValue="value"
              ></p-selectButton>
            </div>

            <div class="flex flex-column gap-1">
              <label class="font-semibold">{{ t('multiplayer.create.penalty') }}</label>
              <p-selectButton
                [options]="penaltyOptions"
                [(ngModel)]="penaltySeconds"
                optionLabel="label"
                optionValue="value"
              ></p-selectButton>
              <span class="text-sm text-600">{{ t('multiplayer.create.penaltyHelp') }}</span>
            </div>

            <div class="flex gap-3">
              <div class="flex flex-column gap-1 flex-1">
                <label class="font-semibold">{{ t('multiplayer.create.minPlayers') }}</label>
                <p-inputNumber [(ngModel)]="minPlayers" [min]="2" [max]="25" [showButtons]="true"></p-inputNumber>
              </div>
              <div class="flex flex-column gap-1 flex-1">
                <label class="font-semibold">{{ t('multiplayer.create.maxPlayers') }}</label>
                <p-inputNumber [(ngModel)]="maxPlayers" [min]="2" [max]="25" [showButtons]="true"></p-inputNumber>
              </div>
            </div>

            @if (error()) {
              <p-message severity="error" [text]="error()!"></p-message>
            }

            <div class="flex gap-2">
              <p-button
                [label]="t('multiplayer.create.createGame')"
                icon="pi pi-plus"
                (onClick)="create()"
                [loading]="creating()"
                [disabled]="!quizTypeCode"
              ></p-button>
              <p-button
                [label]="t('common.cancel')"
                icon="pi pi-arrow-left"
                severity="secondary"
                [text]="true"
                (onClick)="cancel()"
              ></p-button>
            </div>
          </div>
        </p-card>
      </div>
    </ng-container>
  `,
})
export class CreateGameComponent implements OnInit {
  private api = inject(ApiService);
  private mpService = inject(MultiplayerService);
  private router = inject(Router);
  private t = inject(TranslocoService);

  quizTypes = signal<QuizType[]>([]);
  quizTypeCode = '';
  difficulty = 'medium';
  totalQuestions = 10;
  penaltySeconds = 10;
  minPlayers = 2;
  maxPlayers = 5;
  learnedTimetables: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  creating = signal(false);
  error = signal<string | null>(null);

  difficultyOptions = [
    { label: 'Easy', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
  ];

  questionOptions = [
    { label: '5 Quick', value: 5 },
    { label: '10 Normal', value: 10 },
    { label: '20 Marathon', value: 20 },
  ];

  penaltyOptions = [
    { label: '5 sec', value: 5 },
    { label: '10 sec', value: 10 },
    { label: '20 sec', value: 20 },
  ];

  timetableOptions = Array.from({ length: 10 }, (_, i) => ({
    label: `${i + 1}`,
    value: i + 1,
  }));

  quizTypeOptions = computed(() =>
    this.quizTypes().filter((qt) => qt.is_active).map((qt) => ({
      label: qt.description || qt.code,
      value: qt.code,
    }))
  );

  showTimetables = computed(() => {
    const code = this.quizTypeCode;
    return code.includes('multiplication') || code.includes('times_table');
  });

  ngOnInit() {
    this.api.getQuizTypes().subscribe({
      next: (r: QuizTypesResponse) => this.quizTypes.set(r.types),
    });
  }

  create() {
    if (this.maxPlayers < this.minPlayers) {
      this.error.set('Max players must be >= min players');
      return;
    }
    this.creating.set(true);
    this.error.set(null);

    this.mpService.createGame({
      quizTypeCode: this.quizTypeCode,
      difficulty: this.difficulty,
      totalQuestions: this.totalQuestions,
      penaltySeconds: this.penaltySeconds,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      learnedTimetables: this.showTimetables() ? this.learnedTimetables : undefined,
    }).subscribe({
      next: (res) => {
        this.creating.set(false);
        this.router.navigate(['/multiplayer/lobby', res.gameCode]);
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(err.error?.detail || 'Failed to create game');
      },
    });
  }

  cancel() {
    this.router.navigate(['/multiplayer']);
  }
}
