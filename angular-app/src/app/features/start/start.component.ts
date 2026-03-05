import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { ApiService } from '../../core/services/api.service';
import { QuizService } from '../../core/services/quiz.service';
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
    CheckboxModule,
    InputTextModule,
    CardModule,
  ],
  template: `
    <div class="flex justify-content-center">
      <p-card header="Start a Quiz" [style]="{ 'max-width': '600px', width: '100%' }">
        <div class="flex flex-column gap-3">

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

          <!-- Student info (show if no current student) -->
          @if (!quiz.currentStudent()) {
            <div class="flex flex-column gap-2 surface-50 p-3 border-round">
              <label class="font-semibold">New Student</label>
              <span class="p-input-icon-left w-full">
                <input
                  type="text"
                  pInputText
                  placeholder="Student name (required)"
                  [(ngModel)]="studentName"
                  class="w-full"
                />
              </span>
              <div class="flex gap-3">
                <div class="flex flex-column gap-1 flex-1">
                  <label class="text-sm">Age (optional)</label>
                  <p-inputNumber
                    [(ngModel)]="studentAge"
                    [min]="4"
                    [max]="120"
                    [showButtons]="true"
                    [useGrouping]="false"
                  ></p-inputNumber>
                </div>
                <div class="flex flex-column gap-1 flex-1">
                  <label class="text-sm">Gender (optional)</label>
                  <p-dropdown
                    [options]="genderOptions"
                    [(ngModel)]="studentGender"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="—"
                    [showClear]="true"
                  ></p-dropdown>
                </div>
              </div>

              <!-- Learned Timetables -->
              <div class="flex flex-column gap-1">
                <label class="text-sm">Learned Timetables</label>
                <div class="flex flex-wrap gap-2">
                  @for (n of timetableRange; track n) {
                    <div class="flex align-items-center gap-1">
                      <p-checkbox
                        [inputId]="'tt-' + n"
                        [value]="n"
                        [(ngModel)]="learnedTimetables"
                      ></p-checkbox>
                      <label [for]="'tt-' + n" class="text-sm">{{ n }}</label>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

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
            [disabled]="!canStart()"
            [loading]="submitting()"
          ></p-button>
        </div>
      </p-card>
    </div>
  `,
})
export class StartComponent implements OnInit {
  private api = inject(ApiService);
  protected quiz = inject(QuizService);
  private router = inject(Router);

  quizTypes = signal<QuizType[]>([]);
  quizTypeCode = 'multiplication_1_10';
  difficulty = 'medium';
  totalQuestions = 10;
  studentName = '';
  studentAge: number | null = null;
  studentGender: string | null = null;
  learnedTimetables: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  submitting = signal(false);

  difficulties = ['low', 'medium', 'hard'];
  timetableRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  genderOptions = [
    { label: 'Female', value: 'female' },
    { label: 'Male', value: 'male' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_say' },
  ];

  quizTypeOptions = () =>
    this.quizTypes().map((qt) => ({ label: qt.description, value: qt.code }));

  ngOnInit() {
    this.api.getQuizTypes().subscribe((types) => this.quizTypes.set(types));
  }

  canStart(): boolean {
    if (this.submitting()) return false;
    if (!this.quiz.currentStudent() && !this.studentName.trim()) return false;
    if (
      !this.quiz.currentStudent() &&
      this.learnedTimetables.length === 0
    )
      return false;
    return true;
  }

  startQuiz() {
    this.submitting.set(true);
    const current = this.quiz.currentStudent();

    this.api
      .createSession({
        difficulty: this.difficulty,
        totalQuestions: this.totalQuestions,
        quizTypeCode: this.quizTypeCode,
        studentId: current?.id || undefined,
        studentName: current ? undefined : this.studentName,
        studentAge: current ? undefined : this.studentAge,
        studentGender: current ? undefined : this.studentGender,
        learnedTimetables: current ? undefined : this.learnedTimetables,
      })
      .subscribe({
        next: (res) => {
          this.quiz.setActiveQuiz({
            sessionId: res.sessionId,
            quizTypeCode: res.quizTypeCode,
            questions: res.questions,
          });
          if (!current) {
            this.quiz.refreshStudents();
          }
          this.submitting.set(false);
          this.router.navigate(['/quiz', res.sessionId]);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }
}
