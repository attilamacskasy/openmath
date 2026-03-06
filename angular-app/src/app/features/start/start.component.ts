import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CardModule } from 'primeng/card';
import { ApiService } from '../../core/services/api.service';
import { QuizService } from '../../core/services/quiz.service';
import { AuthService } from '../../core/services/auth.service';
import { QuizType } from '../../models/quiz-type.model';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    InputNumberModule,
    ButtonModule,
    RadioButtonModule,
    CardModule,
  ],
  template: `
    <div class="flex justify-content-center">
      <p-card header="Start a Quiz" [style]="{ 'max-width': '600px', width: '100%' }">
        <div class="flex flex-column gap-3">

          <!-- Logged-in student info -->
          @if (auth.currentUser(); as user) {
            <div class="surface-50 p-3 border-round text-sm">
              Playing as <strong>{{ user.name }}</strong> ({{ user.email }})
            </div>
          }

          <!-- Quiz Type -->
          <div class="flex flex-column gap-1">
            <label class="font-semibold">Quiz Type</label>
            <p-dropdown
              [options]="quizTypeOptions()"
              [(ngModel)]="quizTypeCode"
              optionLabel="label"
              optionValue="value"
              placeholder="Select quiz type"
            ></p-dropdown>
          </div>

          <!-- Difficulty -->
          <div class="flex flex-column gap-1">
            <label class="font-semibold">Difficulty</label>
            <div class="flex gap-3">
              @for (d of difficulties; track d) {
                <div class="flex align-items-center gap-1">
                  <p-radioButton
                    [inputId]="'diff-' + d"
                    name="difficulty"
                    [value]="d"
                    [(ngModel)]="difficulty"
                  ></p-radioButton>
                  <label [for]="'diff-' + d" class="capitalize">{{ d }}</label>
                </div>
              }
            </div>
          </div>

          <!-- Total Questions -->
          <div class="flex flex-column gap-1">
            <label class="font-semibold">Number of Questions</label>
            <p-inputNumber
              [(ngModel)]="totalQuestions"
              [min]="1"
              [max]="30"
              [showButtons]="true"
              [useGrouping]="false"
            ></p-inputNumber>
          </div>

          <p-button
            label="Start Quiz"
            icon="pi pi-play"
            (onClick)="startQuiz()"
            [disabled]="submitting()"
            [loading]="submitting()"
          ></p-button>
        </div>
      </p-card>
    </div>
  `,
})
export class StartComponent implements OnInit {
  private api = inject(ApiService);
  private quiz = inject(QuizService);
  private router = inject(Router);
  protected auth = inject(AuthService);

  quizTypes = signal<QuizType[]>([]);
  quizTypeCode = 'multiplication_1_10';
  difficulty = 'medium';
  totalQuestions = 10;
  submitting = signal(false);

  difficulties = ['low', 'medium', 'hard'];

  quizTypeOptions = () =>
    this.quizTypes().map((qt) => ({ label: qt.description, value: qt.code }));

  ngOnInit() {
    this.api.getQuizTypes().subscribe((types) => this.quizTypes.set(types));
  }

  startQuiz() {
    this.submitting.set(true);
    const user = this.auth.currentUser();

    this.api
      .createSession({
        difficulty: this.difficulty,
        totalQuestions: this.totalQuestions,
        quizTypeCode: this.quizTypeCode,
        studentId: user?.id || undefined,
      })
      .subscribe({
        next: (res) => {
          this.quiz.setActiveQuiz({
            sessionId: res.sessionId,
            quizTypeCode: res.quizTypeCode,
            questions: res.questions,
          });
          this.submitting.set(false);
          this.router.navigate(['/quiz', res.sessionId]);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }
}
