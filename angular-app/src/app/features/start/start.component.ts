import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ApiService, QuizTypesResponse } from '../../core/services/api.service';
import { QuizService } from '../../core/services/quiz.service';
import { AuthService } from '../../core/services/auth.service';
import { QuizType, PreviewQuestion } from '../../models/quiz-type.model';

interface DropdownGroup {
  label: string;
  value: string;
  items: { label: string; value: string }[];
}

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
    CheckboxModule,
    ProgressSpinnerModule,
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

          <!-- Pre-filters -->
          <div class="flex align-items-center gap-3 flex-wrap">
            @if (hasAge()) {
              <div class="flex align-items-center gap-2">
                <p-checkbox
                  [(ngModel)]="filterByAge"
                  [binary]="true"
                  inputId="age-filter"
                  (onChange)="onFiltersChanged()"
                ></p-checkbox>
                <label for="age-filter" class="text-sm">Show quizzes for my age ({{ userAge() }})</label>
              </div>
            }
            <div class="flex align-items-center gap-2">
              <label class="text-sm font-semibold">Category:</label>
              <p-dropdown
                [options]="categoryOptions()"
                [(ngModel)]="selectedCategory"
                optionLabel="label"
                optionValue="value"
                (onChange)="onFiltersChanged()"
                [style]="{ 'min-width': '160px' }"
              ></p-dropdown>
            </div>
          </div>

          <!-- Quiz Type -->
          <div class="flex flex-column gap-1">
            <label class="font-semibold">Quiz Type</label>
            <p-dropdown
              [options]="groupedQuizTypeOptions()"
              [(ngModel)]="quizTypeCode"
              optionLabel="label"
              optionValue="value"
              optionGroupLabel="label"
              optionGroupChildren="items"
              [group]="true"
              placeholder="Select quiz type"
              (onChange)="onQuizTypeChanged()"
            ></p-dropdown>
          </div>

          <!-- Live Preview -->
          @if (quizTypeCode && previewLoading()) {
            <div class="surface-50 p-3 border-round text-center">
              <i class="pi pi-spin pi-spinner"></i> Loading preview...
            </div>
          }
          @if (previewQuestions().length > 0 && !previewLoading()) {
            <div class="surface-50 p-3 border-round">
              <div class="font-semibold mb-2 text-sm">Example questions:</div>
              @for (p of previewQuestions(); track p.render) {
                <div class="text-sm mb-1">
                  • {{ p.render }} <span class="text-500">= {{ p.correct }}</span>
                </div>
              }
            </div>
          }

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

  allQuizTypes = signal<QuizType[]>([]);
  categories = signal<string[]>([]);
  quizTypeCode = '';
  difficulty = 'medium';
  totalQuestions = 10;
  submitting = signal(false);
  filterByAge = false;
  selectedCategory = '';
  previewQuestions = signal<PreviewQuestion[]>([]);
  previewLoading = signal(false);
  private previewTimeout: any = null;

  difficulties = ['low', 'medium', 'hard'];

  userAge = computed(() => {
    const user = this.auth.currentUser();
    return user?.age ?? null;
  });

  /** Only show the age-filter checkbox for school-aged children (4–18) */
  hasAge = computed(() => {
    const age = this.userAge();
    return age !== null && age >= 4 && age <= 18;
  });

  categoryOptions = computed(() => {
    const cats = this.categories();
    return [{ label: 'All', value: '' }, ...cats.map((c) => ({ label: this.formatCategory(c), value: c }))];
  });

  filteredQuizTypes = computed(() => {
    let types = this.allQuizTypes();
    if (this.selectedCategory) {
      types = types.filter((qt) => qt.category === this.selectedCategory);
    }
    return types;
  });

  groupedQuizTypeOptions = computed(() => {
    const types = this.filteredQuizTypes();
    const groups = new Map<string, { label: string; value: string }[]>();

    for (const qt of types) {
      const cat = qt.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      let label = qt.description;
      if (qt.recommended_age_min != null && qt.recommended_age_max != null) {
        label += `  [${qt.recommended_age_min}–${qt.recommended_age_max}]`;
      }
      groups.get(cat)!.push({ label, value: qt.code });
    }

    const result: DropdownGroup[] = [];
    for (const [cat, items] of groups) {
      result.push({ label: this.formatCategory(cat), value: cat, items });
    }
    return result;
  });

  ngOnInit() {
    // Default age filter: checked only for school-age children (4–18)
    this.filterByAge = this.hasAge();
    this.loadQuizTypes();
  }

  loadQuizTypes() {
    const age = this.filterByAge && this.hasAge() ? this.userAge()! : undefined;
    this.api.getQuizTypes(age).subscribe((resp: QuizTypesResponse) => {
      this.allQuizTypes.set(resp.types);
      this.categories.set(resp.categories);
      // Auto-select first if current selection is no longer available
      const codes = resp.types.map((t) => t.code);
      if (!codes.includes(this.quizTypeCode) && codes.length > 0) {
        this.quizTypeCode = codes[0];
        this.onQuizTypeChanged();
      }
    });
  }

  onFiltersChanged() {
    this.loadQuizTypes();
  }

  onQuizTypeChanged() {
    // Debounce preview
    if (this.previewTimeout) clearTimeout(this.previewTimeout);
    this.previewTimeout = setTimeout(() => this.loadPreview(), 300);
  }

  private loadPreview() {
    if (!this.quizTypeCode) {
      this.previewQuestions.set([]);
      return;
    }
    const qt = this.allQuizTypes().find((t) => t.code === this.quizTypeCode);
    if (!qt || !qt.template_kind) {
      this.previewQuestions.set([]);
      return;
    }
    this.previewLoading.set(true);
    this.api.previewByTemplate(qt.template_kind, qt.answer_type, qt.code).subscribe({
      next: (questions) => {
        this.previewQuestions.set(questions);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewQuestions.set([]);
        this.previewLoading.set(false);
      },
    });
  }

  startQuiz() {
    this.submitting.set(true);
    const user = this.auth.currentUser();
    const qt = this.allQuizTypes().find((t) => t.code === this.quizTypeCode);

    this.api
      .createSession({
        difficulty: this.difficulty,
        totalQuestions: this.totalQuestions,
        quizTypeCode: this.quizTypeCode,
        userId: user?.id || undefined,
      })
      .subscribe({
        next: (res) => {
          this.quiz.setActiveQuiz({
            sessionId: res.sessionId,
            quizTypeCode: res.quizTypeCode,
            quizTypeDescription: res.quizTypeDescription || qt?.description || '',
            quizTypeCategory: res.quizTypeCategory || qt?.category || '',
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

  private formatCategory(cat: string): string {
    const map: Record<string, string> = {
      arithmetic: 'Arithmetic',
      multiplication: 'Multiplication & Division',
      patterns: 'Patterns',
      roman: 'Roman Numerals',
      measurement: 'Measurement',
    };
    return map[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
  }
}
