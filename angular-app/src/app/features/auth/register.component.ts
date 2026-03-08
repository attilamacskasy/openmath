import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { CalendarModule } from 'primeng/calendar';
import { MessageModule } from 'primeng/message';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';
import { LocaleService } from '../../core/services/locale.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    DropdownModule,
    CheckboxModule,
    CalendarModule,
    MessageModule,
    TranslocoModule,
  ],
  template: `
    <ng-container *transloco="let t">
    <div class="flex justify-content-center align-items-center" style="min-height: 80vh">
      <p-card [style]="{ width: '450px' }">
        <ng-template pTemplate="header">
          <div class="text-center pt-4">
            <div class="flex align-items-center justify-content-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="40" height="40">
                <defs>
                  <linearGradient id="om-grad-r" x1="80" y1="60" x2="430" y2="460" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stop-color="#2D9CDB" />
                    <stop offset="1" stop-color="#27AE60" />
                  </linearGradient>
                </defs>
                <circle cx="256" cy="256" r="210" fill="url(#om-grad-r)" />
                <circle cx="256" cy="256" r="210" fill="none" stroke="#0B1B2B" stroke-opacity=".15" stroke-width="14" />
                <g stroke="#fff" stroke-width="24" stroke-linecap="round">
                  <line x1="176" y1="190" x2="220" y2="234" />
                  <line x1="220" y1="190" x2="176" y2="234" />
                </g>
                <g stroke="#fff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none">
                  <path d="M300 220 L325 245 L360 200" />
                </g>
                <path d="M176 300 Q256 380 336 300" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round" />
              </svg>
              <h2 class="m-0">OpenMath</h2>
            </div>
          </div>
        </ng-template>

        <h3 class="text-center mt-0">{{ t('auth.createAccount') }}</h3>

        @if (errorMessage()) {
          <p-message severity="error" [text]="errorMessage()" styleClass="w-full mb-3"></p-message>
        }

        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-1">
            <label for="name" class="font-semibold">{{ t('auth.name') }} *</label>
            <input
              id="name"
              type="text"
              pInputText
              [(ngModel)]="name"
              [placeholder]="t('auth.namePlaceholder')"
              class="w-full"
            />
          </div>

          <div class="flex flex-column gap-1">
            <label for="reg-email" class="font-semibold">{{ t('auth.email') }} *</label>
            <input
              id="reg-email"
              type="email"
              pInputText
              [(ngModel)]="email"
              placeholder="your@email.com"
              class="w-full"
            />
          </div>

          <div class="flex flex-column gap-1">
            <label for="reg-password" class="font-semibold">{{ t('auth.password') }} *</label>
            <p-password
              id="reg-password"
              [(ngModel)]="password"
              [feedback]="true"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
          </div>

          <div class="flex gap-3">
            <div class="flex flex-column gap-1 flex-1">
              <label for="birthday" class="font-semibold">{{ t('auth.birthday') }}</label>
              <p-calendar
                id="birthday"
                [(ngModel)]="birthday"
                [showIcon]="true"
                [dateFormat]="localeService.getCalendarDateFormat()"
                [maxDate]="maxDate"
                placeholder="YYYY-MM-DD"
                styleClass="w-full"
              ></p-calendar>
            </div>
            <div class="flex flex-column gap-1 flex-1">
              <label for="gender" class="font-semibold">{{ t('auth.gender') }}</label>
              <p-dropdown
                id="gender"
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
            <label for="locale" class="font-semibold">{{ t('auth.language') }}</label>
            <p-dropdown
              id="locale"
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
                    [inputId]="'rtt-' + n"
                    [value]="n"
                    [(ngModel)]="learnedTimetables"
                  ></p-checkbox>
                  <label [for]="'rtt-' + n" class="text-sm">{{ n }}</label>
                </div>
              }
            </div>
          </div>

          <p-button
            [label]="t('auth.register')"
            icon="pi pi-user-plus"
            (onClick)="register()"
            [disabled]="!canRegister() || submitting()"
            [loading]="submitting()"
            styleClass="w-full"
          ></p-button>

          <div class="text-center text-sm">
            {{ t('auth.alreadyHaveAccount') }}
            <a routerLink="/login" class="text-primary no-underline font-semibold">{{ t('auth.signIn') }}</a>
          </div>
        </div>
      </p-card>
    </div>
    </ng-container>
  `,
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private translocoService = inject(TranslocoService);
  localeService = inject(LocaleService);

  name = '';
  email = '';
  password = '';
  birthday: Date | null = null;
  gender: string | null = null;
  locale = 'en';
  learnedTimetables: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  submitting = signal(false);
  errorMessage = signal('');

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

  canRegister(): boolean {
    return !!(
      this.name.trim() &&
      this.email.trim() &&
      this.password.length >= 6 &&
      this.learnedTimetables.length > 0
    );
  }

  register() {
    if (!this.canRegister()) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    let birthdayStr: string | null = null;
    if (this.birthday) {
      const d = this.birthday;
      birthdayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    this.auth
      .register({
        name: this.name.trim(),
        email: this.email.trim(),
        password: this.password,
        birthday: birthdayStr,
        gender: this.gender,
        locale: this.locale,
        learnedTimetables: this.learnedTimetables,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(
            err.error?.detail || this.translocoService.translate('auth.registrationFailed')
          );
        },
      });
  }
}
