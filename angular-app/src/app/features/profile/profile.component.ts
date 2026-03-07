import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { CalendarModule } from 'primeng/calendar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import {
  UserProfile,
  PerformanceBucket,
} from '../../models/user.model';
import { MeResponse } from '../../models/auth.model';

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
    CalendarModule,
    TableModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>

    @if (loading()) {
      <p class="text-500">Loading profile...</p>
    } @else if (profile()) {
      <div class="grid">
        <!-- Edit form -->
        <div class="col-12 md:col-6">
          <p-card header="Edit Profile">
            <div class="flex flex-column gap-3">
              <div class="flex flex-column gap-1">
                <label class="font-semibold">Email</label>
                <input pInputText [value]="meData()?.email || ''" class="w-full" [disabled]="true" />
              </div>
              <div class="flex flex-column gap-1">
                <label class="font-semibold">Auth Provider</label>
                <div class="flex align-items-center gap-2 py-2">
                  <p-tag
                    [value]="providerTagLabel"
                    [severity]="providerTagSeverity"
                  ></p-tag>
                </div>
              </div>
              <div class="flex flex-column gap-1">
                <label class="font-semibold">Name</label>
                <input pInputText [(ngModel)]="name" class="w-full" />
              </div>
              <div class="flex gap-3">
                <div class="flex flex-column gap-1 flex-1">
                  <label class="font-semibold">Birthday</label>
                  <p-calendar
                    [(ngModel)]="birthday"
                    [showIcon]="true"
                    dateFormat="yy-mm-dd"
                    [maxDate]="maxDate"
                    placeholder="Select date"
                    styleClass="w-full"
                  ></p-calendar>
                </div>
                <div class="flex flex-column gap-1 flex-1">
                  <label class="font-semibold">Age</label>
                  <input pInputText [value]="computedAge" class="w-full" [disabled]="true" />
                </div>
              </div>
              <div class="flex flex-column gap-1">
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

      <!-- Associations card (v2.5) -->
      @if (associations().length > 0) {
        <div class="col-12">
          <p-card header="My Teachers & Parents">
            <p-table [value]="associations()" styleClass="p-datatable-sm">
              <ng-template pTemplate="header">
                <tr>
                  <th>Relationship</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Since</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-a>
                <tr>
                  <td>
                    <p-tag
                      [value]="a.relationship === 'teacher' ? 'Teacher' : 'Parent'"
                      [severity]="a.relationship === 'teacher' ? 'warning' : 'secondary'"
                    ></p-tag>
                  </td>
                  <td>{{ a.related_name }}</td>
                  <td>{{ a.related_email }}</td>
                  <td>{{ a.associated_at | date:'mediumDate' }}</td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr><td colspan="4" class="text-center text-500">No associations found.</td></tr>
              </ng-template>
            </p-table>
          </p-card>
        </div>
      }
    }
  `,
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private messageService = inject(MessageService);

  loading = signal(true);
  saving = signal(false);
  profile = signal<UserProfile | null>(null);
  meData = signal<MeResponse | null>(null);
  associations = signal<any[]>([]);

  name = '';
  birthday: Date | null = null;
  gender: string | null = null;
  learnedTimetables: number[] = [];
  maxDate = new Date();

  timetableRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  genderOptions = [
    { label: 'Female', value: 'female' },
    { label: 'Male', value: 'male' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_say' },
  ];

  get computedAge(): string {
    if (!this.birthday) return '—';
    const today = new Date();
    let age = today.getFullYear() - this.birthday.getFullYear();
    const m = today.getMonth() - this.birthday.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < this.birthday.getDate())) {
      age--;
    }
    return String(age);
  }

  get providerTagLabel(): string {
    const p = this.auth.currentUser()?.authProvider || 'local';
    return p === 'google' ? 'Google' : p === 'both' ? 'Google + Local' : 'Local';
  }

  get providerTagSeverity(): 'success' | 'secondary' {
    const p = this.auth.currentUser()?.authProvider || 'local';
    return p === 'local' ? 'secondary' : 'success';
  }

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    const user = this.auth.currentUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    // Load /auth/me for email/birthday, then /students/:id for profile+stats
    this.auth.getMe().subscribe({
      next: (me) => {
        this.meData.set(me);
        this.birthday = me.birthday ? new Date(me.birthday) : null;

        this.api.getUser(user.id).subscribe({
          next: (p) => {
            this.profile.set(p);
            this.name = p.name;
            this.gender = p.gender;
            this.learnedTimetables = [...p.learned_timetables];
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });

        // Load associations (v2.5)
        this.api.getUserAssociations(user.id).subscribe({
          next: (a) => this.associations.set(a),
          error: () => {},
        });
      },
      error: () => this.loading.set(false),
    });
  }

  save() {
    const user = this.auth.currentUser();
    if (!user) return;
    this.saving.set(true);

    const age = this.birthday ? Number(this.computedAge) : null;

    let birthdayStr: string | null = null;
    if (this.birthday) {
      const d = this.birthday;
      birthdayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    this.api
      .updateUser(user.id, {
        name: this.name.trim(),
        age,
        gender: this.gender,
        learned_timetables: this.learnedTimetables,
        birthday: birthdayStr,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
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
