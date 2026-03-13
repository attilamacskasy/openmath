import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { CalendarModule } from 'primeng/calendar';
import { MultiSelectModule } from 'primeng/multiselect';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../core/services/api.service';
import { LocaleService } from '../../core/services/locale.service';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
  roles: string[];
  auth_provider: string;
  birthday: string | null;
  age: number | null;
  gender: string | null;
  learned_timetables: number[];
  created_at: string;
}

@Component({
  selector: 'app-user-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
    DropdownModule,
    CheckboxModule,
    CalendarModule,
    MultiSelectModule,
    ConfirmDialogModule,
    TooltipModule,
    ToastModule,
    TranslocoModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <ng-container *transloco="let t">
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <div class="flex justify-content-between align-items-center mb-3">
      <h2 class="m-0">{{ t('admin.userAdmin') }}</h2>
      <p-button
        [label]="t('admin.newUser')"
        icon="pi pi-plus"
        (onClick)="openCreateDialog()"
      ></p-button>
    </div>

    @if (loading()) {
      <p class="text-500">{{ t('common.loading') }}</p>
    } @else {
      <p-table
        [value]="users()"
        [rows]="20"
        [paginator]="users().length > 20"
        [globalFilterFields]="['name', 'email']"
        [rowHover]="true"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="name">{{ t('admin.name') }} <p-sortIcon field="name"></p-sortIcon></th>
            <th pSortableColumn="email">{{ t('admin.email') }} <p-sortIcon field="email"></p-sortIcon></th>
            <th>{{ t('admin.age') }}</th>
            <th>{{ t('admin.roles') }}</th>
            <th>{{ t('admin.provider') }}</th>
            <th>{{ t('admin.actions') }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-s>
          <tr>
            <td>{{ s.name }}</td>
            <td>{{ s.email || '—' }}</td>
            <td>{{ calculateAge(s.birthday) ?? s.age ?? '—' }}</td>
            <td>
              <div class="flex gap-1 flex-wrap">
                @for (r of s.roles; track r) {
                  <p-tag
                    [value]="r"
                    [severity]="r === 'admin' ? 'warning' : r === 'teacher' ? 'success' : r === 'parent' ? 'secondary' : 'info'"
                  ></p-tag>
                }
                @if (!s.roles?.length) {
                  <span class="text-500">—</span>
                }
              </div>
            </td>
            <td>{{ s.auth_provider || '—' }}</td>
            <td>
              <div class="flex gap-1">
                <p-button
                  icon="pi pi-pencil"
                  [rounded]="true"
                  [text]="true"
                  size="small"
                  (onClick)="editUser(s)"
                ></p-button>
                @if (s.auth_provider !== 'google') {
                  <p-button
                    icon="pi pi-key"
                    [rounded]="true"
                    [text]="true"
                    size="small"
                    severity="warning"
                    [pTooltip]="t('admin.resetPassword')"
                    (onClick)="openResetPasswordDialog(s)"
                  ></p-button>
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="6" class="text-center text-500">{{ t('admin.noUsers') }}</td></tr>
        </ng-template>
      </p-table>
    }

    <!-- Create / Edit Dialog -->
    <p-dialog
      [(visible)]="dialogVisible"
      [header]="editingUser ? t('admin.editUser') : t('admin.createUser')"
      [modal]="true"
      [style]="{ width: '450px' }"
    >
      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('admin.name') }} *</label>
          <input pInputText [(ngModel)]="dialogName" class="w-full" />
        </div>
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('admin.email') }} *</label>
          <input pInputText [(ngModel)]="dialogEmail" class="w-full" type="email"
            [disabled]="editingUser !== null && editingUser.auth_provider === 'google'" />
          @if (editingUser?.auth_provider === 'google') {
            <small class="text-500">{{ t('admin.googleEmailNote') }}</small>
          }
        </div>
        @if (!editingUser) {
          <div class="flex flex-column gap-1">
            <label class="font-semibold">{{ t('admin.password') }}</label>
            <p-password
              [(ngModel)]="dialogPassword"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
          </div>
        }
        <div class="flex gap-3">
          <div class="flex flex-column gap-1 flex-1">
            <label class="font-semibold">{{ t('profile.birthday') }}</label>
            <p-calendar
              [(ngModel)]="dialogBirthday"
              [showIcon]="true"
              [dateFormat]="localeService.getCalendarDateFormat()"
              [maxDate]="maxDate"
              [placeholder]="t('profile.dateFormat')"
              styleClass="w-full"
            ></p-calendar>
            @if (dialogBirthdayTooYoung) {
              <small class="text-red-500">{{ t('auth.mustBeAtLeast4') }}</small>
            }
          </div>
          <div class="flex flex-column gap-1 flex-1">
            <label class="font-semibold">{{ t('profile.gender') }}</label>
            <p-dropdown
              [options]="genderOptions"
              [(ngModel)]="dialogGender"
              optionLabel="label"
              optionValue="value"
              placeholder="—"
              [showClear]="true"
            ></p-dropdown>
          </div>
        </div>
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('admin.roles') }}</label>
          <p-multiSelect
            [options]="roleOptions"
            [(ngModel)]="dialogRoles"
            optionLabel="label"
            optionValue="value"
            [placeholder]="t('admin.selectRoles')"
            display="chip"
            styleClass="w-full"
          ></p-multiSelect>
        </div>
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('profile.timetables') }}</label>
          <div class="flex flex-wrap gap-2">
            @for (n of timetableRange; track n) {
              <div class="flex align-items-center gap-1">
                <p-checkbox
                  [inputId]="'satt-' + n"
                  [value]="n"
                  [(ngModel)]="dialogTimetables"
                ></p-checkbox>
                <label [for]="'satt-' + n" class="text-sm">{{ n }}</label>
              </div>
            }
          </div>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <p-button [label]="t('common.cancel')" severity="secondary" (onClick)="dialogVisible = false"></p-button>
        <p-button
          [label]="editingUser ? t('common.save') : t('common.create')"
          icon="pi pi-check"
          (onClick)="saveUser()"
          [loading]="dialogSaving()"
          [disabled]="dialogBirthdayTooYoung"
        ></p-button>
      </ng-template>
    </p-dialog>

    <!-- Reset Password Dialog -->
    <p-dialog
      [(visible)]="resetPwVisible"
      [header]="t('admin.resetPassword')"
      [modal]="true"
      [style]="{ width: '350px' }"
    >
      <p class="mb-3">{{ t('admin.setNewPasswordFor') }} <strong>{{ resetPwUserName }}</strong></p>
      <p-password
        [(ngModel)]="newPassword"
        [feedback]="false"
        [toggleMask]="true"
        styleClass="w-full"
        inputStyleClass="w-full"
        [placeholder]="t('admin.newPasswordPlaceholder')"
      ></p-password>
      <ng-template pTemplate="footer">
        <p-button [label]="t('common.cancel')" severity="secondary" (onClick)="resetPwVisible = false"></p-button>
        <p-button
          [label]="t('admin.resetPassword')"
          icon="pi pi-key"
          severity="warning"
          (onClick)="resetPassword()"
          [disabled]="newPassword.length < 6"
        ></p-button>
      </ng-template>
    </p-dialog>
    </ng-container>
  `,
})
export class UserAdminComponent implements OnInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);
  private translocoService = inject(TranslocoService);
  localeService = inject(LocaleService);

  loading = signal(true);
  users = signal<UserRow[]>([]);
  dialogVisible = false;
  dialogSaving = signal(false);
  editingUser: UserRow | null = null;

  dialogName = '';
  dialogEmail = '';
  dialogPassword = '';
  dialogBirthday: Date | null = null;
  dialogGender: string | null = null;
  dialogRole = 'student';
  dialogRoles: string[] = ['student'];
  dialogTimetables: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  resetPwVisible = false;
  resetPwUserId = '';
  resetPwUserName = '';
  newPassword = '';

  maxDate = new Date();
  minAgeDate = new Date(new Date().getFullYear() - 4, new Date().getMonth(), new Date().getDate());
  timetableRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  get genderOptions() {
    return [
      { label: this.translocoService.translate('gender.female'), value: 'female' },
      { label: this.translocoService.translate('gender.male'), value: 'male' },
      { label: this.translocoService.translate('gender.other'), value: 'other' },
      { label: this.translocoService.translate('gender.preferNotToSay'), value: 'prefer_not_say' },
    ];
  }
  get roleOptions() {
    return [
      { label: this.translocoService.translate('role.student'), value: 'student' },
      { label: this.translocoService.translate('role.teacher'), value: 'teacher' },
      { label: this.translocoService.translate('role.parent'), value: 'parent' },
      { label: this.translocoService.translate('role.admin'), value: 'admin' },
    ];
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.api.getUsers().subscribe({
      next: (users) => {
        this.users.set(users as any);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get dialogBirthdayTooYoung(): boolean {
    if (!this.dialogBirthday) return false;
    return this.dialogBirthday > this.minAgeDate;
  }

  calculateAge(birthday: string | null): number | null {
    if (!birthday) return null;
    const birth = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  openCreateDialog() {
    this.editingUser = null;
    this.dialogName = '';
    this.dialogEmail = '';
    this.dialogPassword = '';
    this.dialogBirthday = null;
    this.dialogGender = null;
    this.dialogRole = 'student';
    this.dialogRoles = ['student'];
    this.dialogTimetables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    this.dialogVisible = true;
  }

  editUser(s: UserRow) {
    this.editingUser = s;
    this.dialogName = s.name;
    this.dialogEmail = s.email || '';
    this.dialogPassword = '';
    this.dialogBirthday = s.birthday ? new Date(s.birthday) : null;
    this.dialogGender = s.gender;
    this.dialogRole = s.role;
    this.dialogRoles = [...(s.roles || [])];
    this.dialogTimetables = [...(s.learned_timetables || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])];
    this.dialogVisible = true;
  }

  saveUser() {
    this.dialogSaving.set(true);
    if (this.editingUser) {
      // Edit existing
      const age = this.dialogBirthday ? this.calculateAge(this.dialogBirthday.toISOString()) : null;
      let birthdayStr: string | null = null;
      if (this.dialogBirthday) {
        const d = this.dialogBirthday;
        birthdayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      this.api
        .updateUser(this.editingUser.id, {
          name: this.dialogName.trim(),
          age,
          gender: this.dialogGender || null,
          learned_timetables: this.dialogTimetables,
          birthday: birthdayStr,
          email: this.dialogEmail.trim() || null,
        })
        .subscribe({
          next: () => {
            // Also update roles via the roles endpoint
            this.api.setUserRoles(this.editingUser!.id, this.dialogRoles).subscribe({
              next: () => {
                this.dialogSaving.set(false);
                this.dialogVisible = false;
                this.messageService.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('admin.userUpdated') });
                this.loadUsers();
              },
              error: () => {
                this.dialogSaving.set(false);
                this.dialogVisible = false;
                this.messageService.add({ severity: 'warn', summary: this.translocoService.translate('common.warning'), detail: this.translocoService.translate('admin.roleUpdateFailed') });
                this.loadUsers();
              },
            });
          },
          error: () => {
            this.dialogSaving.set(false);
            this.messageService.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('admin.updateFailed') });
          },
        });
    } else {
      // Create new
      let birthdayStr: string | undefined;
      if (this.dialogBirthday) {
        const d = this.dialogBirthday;
        birthdayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      this.api
        .createUser({
          name: this.dialogName.trim(),
          email: this.dialogEmail.trim(),
          password: this.dialogPassword,
          birthday: birthdayStr || null,
          gender: this.dialogGender,
          role: this.dialogRoles[0] || 'student',
          learnedTimetables: this.dialogTimetables,
        })
        .subscribe({
          next: (created: any) => {
            // If multiple roles selected, update roles after creation
            if (this.dialogRoles.length > 1 && created?.id) {
              this.api.setUserRoles(created.id, this.dialogRoles).subscribe({
                next: () => {
                  this.dialogSaving.set(false);
                  this.dialogVisible = false;
                  this.messageService.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('admin.userCreated') });
                  this.loadUsers();
                },
                error: () => {
                  this.dialogSaving.set(false);
                  this.dialogVisible = false;
                  this.messageService.add({ severity: 'warn', summary: this.translocoService.translate('common.warning'), detail: this.translocoService.translate('admin.rolesPartialFailed') });
                  this.loadUsers();
                },
              });
            } else {
              this.dialogSaving.set(false);
              this.dialogVisible = false;
              this.messageService.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('admin.userCreated') });
              this.loadUsers();
            }
          },
          error: (err) => {
            this.dialogSaving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: this.translocoService.translate('common.error'),
              detail: err.error?.detail || this.translocoService.translate('admin.updateFailed'),
            });
          },
        });
    }
  }

  openResetPasswordDialog(s: UserRow) {
    this.resetPwUserId = s.id;
    this.resetPwUserName = s.name;
    this.newPassword = '';
    this.resetPwVisible = true;
  }

  resetPassword() {
    this.api.resetUserPassword(this.resetPwUserId, this.newPassword).subscribe({
      next: () => {
        this.resetPwVisible = false;
        this.messageService.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('admin.passwordReset') });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('admin.passwordResetFailed') });
      },
    });
  }
}
