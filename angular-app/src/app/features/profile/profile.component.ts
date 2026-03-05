import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { QuizService } from '../../core/services/quiz.service';
import {
  StudentProfile,
  PerformanceBucket,
} from '../../models/student.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    CheckboxModule,
    TableModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>

    @if (!quiz.currentStudent()) {
      <p-card header="Profile">
        <p class="text-500">Select a student from the header dropdown to view their profile.</p>
      </p-card>
    } @else if (loading()) {
      <p class="text-500">Loading profile...</p>
    } @else if (profile()) {
      <div class="grid">
        <!-- Edit form -->
        <div class="col-12 md:col-6">
          <p-card header="Edit Profile">
            <div class="flex flex-column gap-3">
              <div class="flex flex-column gap-1">
                <label class="font-semibold">Name</label>
                <input pInputText [(ngModel)]="name" class="w-full" />
              </div>
              <div class="flex gap-3">
                <div class="flex flex-column gap-1 flex-1">
                  <label class="font-semibold">Age</label>
                  <p-inputNumber
                    [(ngModel)]="age"
                    [min]="4"
                    [max]="120"
                    [showButtons]="true"
                    [useGrouping]="false"
                  ></p-inputNumber>
                </div>
                <div class="flex flex-column gap-1 flex-1">
                  <label class="font-semibold">Gender</label>
                  <p-dropdown
                    [options]="genderOptions"
                    [(ngModel)]="gender"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="—"
                    [showClear]="true"
                  ></p-dropdown>
                </div>
              </div>
              <div class="flex flex-column gap-1">
                <label class="font-semibold">Learned Timetables</label>
                <div class="flex flex-wrap gap-2">
                  @for (n of timetableRange; track n) {
                    <div class="flex align-items-center gap-1">
                      <p-checkbox
                        [inputId]="'ptt-' + n"
                        [value]="n"
                        [(ngModel)]="learnedTimetables"
                      ></p-checkbox>
                      <label [for]="'ptt-' + n" class="text-sm">{{ n }}</label>
                    </div>
                  }
                </div>
              </div>
              <p-button
                label="Save"
                icon="pi pi-save"
                (onClick)="save()"
                [disabled]="saving() || !name.trim() || learnedTimetables.length === 0"
                [loading]="saving()"
              ></p-button>
            </div>
          </p-card>
        </div>

        <!-- Performance stats -->
        <div class="col-12 md:col-6">
          <p-card header="Performance">
            @if (profile()!.stats) {
              <h4 class="mt-0">Overall</h4>
              <ng-container *ngTemplateOutlet="bucketTpl; context: { $implicit: profile()!.stats.overall }"></ng-container>

              @for (bucket of profile()!.stats.by_quiz_type; track bucket.quiz_type_code) {
                <h4>{{ bucket.quiz_type_description }}</h4>
                <ng-container *ngTemplateOutlet="bucketTpl; context: { $implicit: bucket }"></ng-container>
              }
            }
          </p-card>
        </div>
      </div>

      <ng-template #bucketTpl let-b>
        <div class="grid text-sm">
          <div class="col-6">Sessions:</div><div class="col-6 font-semibold">{{ b.sessions }}</div>
          <div class="col-6">Completed:</div><div class="col-6 font-semibold">{{ b.completed_sessions }}</div>
          <div class="col-6">Questions:</div><div class="col-6 font-semibold">{{ b.total_questions }}</div>
          <div class="col-6">Correct:</div><div class="col-6 font-semibold text-green-600">{{ b.correct_answers }}</div>
          <div class="col-6">Wrong:</div><div class="col-6 font-semibold text-red-600">{{ b.wrong_answers }}</div>
          <div class="col-6">Avg Score:</div><div class="col-6 font-semibold">{{ b.average_score_percent }}%</div>
        </div>
      </ng-template>
    }
  `,
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  protected quiz = inject(QuizService);
  private messageService = inject(MessageService);

  loading = signal(true);
  saving = signal(false);
  profile = signal<StudentProfile | null>(null);

  name = '';
  age: number | null = null;
  gender: string | null = null;
  learnedTimetables: number[] = [];

  timetableRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  genderOptions = [
    { label: 'Female', value: 'female' },
    { label: 'Male', value: 'male' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_say' },
  ];

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    const id = this.quiz.currentStudentId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.api.getStudent(id).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.name = p.name;
        this.age = p.age;
        this.gender = p.gender;
        this.learnedTimetables = [...p.learned_timetables];
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save() {
    const id = this.quiz.currentStudentId();
    if (!id) return;
    this.saving.set(true);

    this.api
      .updateStudent(id, {
        name: this.name.trim(),
        age: this.age,
        gender: this.gender,
        learned_timetables: this.learnedTimetables,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.quiz.refreshStudents();
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Profile updated successfully.',
          });
          this.loadProfile();
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update profile.',
          });
        },
      });
  }
}
