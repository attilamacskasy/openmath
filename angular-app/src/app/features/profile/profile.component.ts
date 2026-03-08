import { Component, inject, OnInit, signal, computed } from '@angular/core';
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
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LocaleService } from '../../core/services/locale.service';
import { LocalDatePipe } from '../../shared/pipes/local-date.pipe';
import {
  UserProfile,
  PerformanceBucket,
} from '../../models/user.model';
import { MeResponse } from '../../models/auth.model';
import { Badge, UserBadge, TimetableMastery } from '../../models/badge.model';

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
    ProgressBarModule,
    TooltipModule,
    TranslocoModule,
    LocalDatePipe,
  ],
  providers: [MessageService],
  template: `
    <ng-container *transloco="let t">
    <p-toast></p-toast>

    @if (loading()) {
      <p class="text-500">{{ t('common.loading') }}</p>
    } @else if (profile()) {
      <!-- Badges section (v2.7) — top of profile -->
      <p-card [header]="t('badge.title')" styleClass="mb-3">
        @if (allBadges().length === 0) {
          <p class="text-500">{{ t('common.loading') }}</p>
        } @else {
          <div class="grid">
            @for (badge of allBadges(); track badge.code) {
              <div class="col-6 md:col-3">
                <div class="surface-100 border-round p-3 text-center h-full"
                     [class.opacity-40]="!isBadgeEarned(badge.code)">
                  <i [class]="badge.icon + ' text-3xl mb-2'"
                     [class.text-yellow-500]="isBadgeEarned(badge.code)"
                     [class.text-400]="!isBadgeEarned(badge.code)"></i>
                  <div class="font-semibold text-sm mt-1">{{ getBadgeName(badge) }}</div>
                  <div class="text-xs text-500 mt-1">{{ getBadgeDescription(badge) }}</div>
                  @if (isBadgeEarned(badge.code)) {
                    <div class="text-xs text-green-600 mt-2">
                      <i class="pi pi-check-circle mr-1"></i>
                      {{ t('badge.earnedOn') }} {{ getEarnedDate(badge.code) | localDate:'mediumDate' }}
                    </div>
                  } @else {
                    <div class="text-xs text-400 mt-2">
                      <i class="pi pi-lock mr-1"></i>{{ t('badge.locked') }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>
          @if (earnedBadges().length === 0) {
            <p class="text-500 text-sm mt-2">{{ t('badge.noBadges') }}</p>
          }
        }
      </p-card>

      <!-- Timetable mastery (v2.7) -->
      @if (masteryData().length > 0) {
        <p-card [header]="t('mastery.title')" styleClass="mb-3">
          <div class="grid">
            @for (m of masteryData(); track m.table) {
              <div class="col-12 md:col-6">
                <div class="flex align-items-center gap-2 mb-2">
                  <span class="font-semibold" style="min-width: 60px">{{ m.table }} {{ t('mastery.table') }}</span>
                  <p-progressBar
                    [value]="m.accuracy"
                    [showValue]="true"
                    [style]="{ height: '20px', flex: '1' }"
                    [color]="m.accuracy >= 90 ? '#4caf50' : m.accuracy >= 60 ? '#ff9800' : '#f44336'"
                  ></p-progressBar>
                  @if (m.mastered) {
                    <i class="pi pi-check-circle text-green-500" [pTooltip]="t('mastery.mastered')"></i>
                  }
                  <span class="text-xs text-500">({{ m.attempts }} {{ t('mastery.attempts') }})</span>
                </div>
              </div>
            }
          </div>
        </p-card>
      }

      <div class="grid">
        <!-- Edit form -->
        <div class="col-12 md:col-6">
          <p-card [header]="t('profile.editProfile')">
            <div class="flex flex-column gap-3">
              <div class="flex flex-column gap-1">
                <label class="font-semibold">{{ t('auth.email') }}</label>
                <input pInputText [value]="meData()?.email || ''" class="w-full" [disabled]="true" />
              </div>
              <div class="flex flex-column gap-1">
                <label class="font-semibold">{{ t('profile.authProvider') }}</label>
                <div class="flex align-items-center gap-2 py-2">
                  <p-tag
                    [value]="providerTagLabel"
                    [severity]="providerTagSeverity"
                  ></p-tag>
                </div>
              </div>
              <div class="flex flex-column gap-1">
                <label class="font-semibold">{{ t('auth.name') }}</label>
                <input pInputText [(ngModel)]="name" class="w-full" />
              </div>
              <div class="flex gap-3">
                <div class="flex flex-column gap-1 flex-1">
                  <label class="font-semibold">{{ t('auth.birthday') }}</label>
                  <p-calendar
                    [(ngModel)]="birthday"
                    [showIcon]="true"
                    [dateFormat]="localeService.getCalendarDateFormat()"
                    [maxDate]="maxDate"
                    [placeholder]="t('profile.selectDate')"
                    styleClass="w-full"
                  ></p-calendar>
                </div>
                <div class="flex flex-column gap-1 flex-1">
                  <label class="font-semibold">{{ t('profile.age') }}</label>
                  <input pInputText [value]="computedAge" class="w-full" [disabled]="true" />
                </div>
              </div>
              <div class="flex flex-column gap-1">
                <label class="font-semibold">{{ t('auth.gender') }}</label>
                <p-dropdown
                  [options]="genderOptions"
                  [(ngModel)]="gender"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="\u2014"
                  [showClear]="true"
                ></p-dropdown>
              </div>
              <div class="flex flex-column gap-1">
                <label class="font-semibold">{{ t('profile.language') }}</label>
                <p-dropdown
                  [options]="localeOptions"
                  [(ngModel)]="locale"
                  optionLabel="label"
                  optionValue="value"
                ></p-dropdown>
              </div>
              <div class="flex flex-column gap-1">
                <label class="font-semibold">{{ t('auth.timetablesLearned') }}</label>
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
                [label]="t('common.save')"
                icon="pi pi-save"
                (onClick)="save()"
                [disabled]="saving() || !name.trim() || learnedTimetables.length === 0"
                [loading]="saving()"
              ></p-button>
            </div>
          </p-card>
        </div>

        <!-- Performance stats (table) -->
        <div class="col-12 md:col-6">
          <p-card [header]="t('profile.performance')">
            @if (profile()!.stats) {
              <p-table [value]="performanceRows()" styleClass="p-datatable-sm p-datatable-striped">
                <ng-template pTemplate="header">
                  <tr>
                    <th>{{ t('quiz.quizType') }}</th>
                    <th style="width: 70px; text-align: right">{{ t('profile.sessions') }}</th>
                    <th style="width: 70px; text-align: right">{{ t('profile.completed') }}</th>
                    <th style="width: 70px; text-align: right">{{ t('profile.questions') }}</th>
                    <th style="width: 60px; text-align: right">{{ t('profile.correct') }}</th>
                    <th style="width: 60px; text-align: right">{{ t('profile.wrong') }}</th>
                    <th style="width: 60px; text-align: right">{{ t('profile.avgScore') }}</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-row>
                  <tr [class.font-bold]="row.isOverall">
                    <td>{{ row.label }}</td>
                    <td class="text-right">{{ row.sessions }}</td>
                    <td class="text-right">{{ row.completed_sessions }}</td>
                    <td class="text-right">{{ row.total_questions }}</td>
                    <td class="text-right text-green-600">{{ row.correct_answers }}</td>
                    <td class="text-right text-red-600">{{ row.wrong_answers }}</td>
                    <td class="text-right">{{ row.average_score_percent }}%</td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr><td colspan="7" class="text-center text-500">{{ t('common.noResults') }}</td></tr>
                </ng-template>
              </p-table>
            }
          </p-card>
        </div>
      </div>

      <!-- Associations card (v2.5) -->
      @if (associations().length > 0) {
        <div class="col-12">
          <p-card [header]="t('profile.associations')">
            <p-table [value]="associations()" styleClass="p-datatable-sm">
              <ng-template pTemplate="header">
                <tr>
                  <th>{{ t('profile.relationship') }}</th>
                  <th>{{ t('auth.name') }}</th>
                  <th>{{ t('auth.email') }}</th>
                  <th>{{ t('profile.since') }}</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-a>
                <tr>
                  <td>
                    <p-tag
                      [value]="a.relationship === 'teacher' ? t('role.teacher') : t('role.parent')"
                      [severity]="a.relationship === 'teacher' ? 'warning' : 'secondary'"
                    ></p-tag>
                  </td>
                  <td>{{ a.related_name }}</td>
                  <td>{{ a.related_email }}</td>
                  <td>{{ a.associated_at | localDate:'mediumDate' }}</td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr><td colspan="4" class="text-center text-500">{{ t('profile.noAssociations') }}</td></tr>
              </ng-template>
            </p-table>
          </p-card>
        </div>
      }
    }
    </ng-container>
  `,
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private messageService = inject(MessageService);
  private translocoService = inject(TranslocoService);
  localeService = inject(LocaleService);

  loading = signal(true);
  saving = signal(false);
  profile = signal<UserProfile | null>(null);
  meData = signal<MeResponse | null>(null);
  associations = signal<any[]>([]);
  allBadges = signal<Badge[]>([]);
  earnedBadges = signal<UserBadge[]>([]);
  masteryData = signal<TimetableMastery[]>([]);

  performanceRows = computed(() => {
    const p = this.profile();
    if (!p?.stats) return [];
    const t = (key: string) => this.translocoService.translate(key);
    const overall = p.stats.overall;
    const rows: any[] = [
      {
        label: t('profile.overall'),
        isOverall: true,
        sessions: overall.sessions,
        completed_sessions: overall.completed_sessions,
        total_questions: overall.total_questions,
        correct_answers: overall.correct_answers,
        wrong_answers: overall.wrong_answers,
        average_score_percent: overall.average_score_percent,
      },
    ];
    for (const b of p.stats.by_quiz_type) {
      rows.push({
        label: b.quiz_type_description,
        isOverall: false,
        sessions: b.sessions,
        completed_sessions: b.completed_sessions,
        total_questions: b.total_questions,
        correct_answers: b.correct_answers,
        wrong_answers: b.wrong_answers,
        average_score_percent: b.average_score_percent,
      });
    }
    return rows;
  });

  name = '';
  birthday: Date | null = null;
  gender: string | null = null;
  locale = 'en';
  learnedTimetables: number[] = [];
  maxDate = new Date();

  timetableRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  localeOptions = [
    { label: 'English', value: 'en' },
    { label: 'Magyar', value: 'hu' },
  ];

  get genderOptions() {
    const t = (key: string) => this.translocoService.translate(key);
    return [
      { label: t('gender.female'), value: 'female' },
      { label: t('gender.male'), value: 'male' },
      { label: t('gender.other'), value: 'other' },
      { label: t('gender.preferNotToSay'), value: 'prefer_not_say' },
    ];
  }

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
            this.locale = me.locale || 'en';
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

        // Load badges (v2.7)
        this.api.getBadges().subscribe({
          next: (b) => this.allBadges.set(b),
          error: () => {},
        });
        this.api.getMyBadges().subscribe({
          next: (b) => this.earnedBadges.set(b),
          error: () => {},
        });

        // Load mastery (v2.7)
        this.api.getUserMastery(user.id).subscribe({
          next: (m) => this.masteryData.set(m),
          error: () => {},
        });
      },
      error: () => this.loading.set(false),
    });
  }

  isBadgeEarned(code: string): boolean {
    return this.earnedBadges().some(b => b.badge.code === code);
  }

  getBadgeName(badge: Badge): string {
    return this.localeService.getLocale() === 'hu' ? badge.name_hu : badge.name_en;
  }

  getBadgeDescription(badge: Badge): string {
    return this.localeService.getLocale() === 'hu' ? badge.description_hu : badge.description_en;
  }

  getEarnedDate(code: string): string {
    const ub = this.earnedBadges().find(b => b.badge.code === code);
    return ub?.awarded_at || '';
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
        locale: this.locale,
        learned_timetables: this.learnedTimetables,
        birthday: birthdayStr,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.localeService.setLocale(this.locale as 'en' | 'hu');
          this.messageService.add({
            severity: 'success',
            summary: this.translocoService.translate('profile.saved'),
            detail: this.translocoService.translate('profile.profileUpdated'),
          });
          this.loadProfile();
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: this.translocoService.translate('common.error'),
            detail: this.translocoService.translate('profile.updateFailed'),
          });
        },
      });
  }
}
