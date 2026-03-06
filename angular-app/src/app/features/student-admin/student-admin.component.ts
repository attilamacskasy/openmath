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
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';

interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
  auth_provider: string;
  birthday: string | null;
  age: number | null;
  gender: string | null;
  learned_timetables: number[];
  created_at: string;
}

@Component({
  selector: 'app-student-admin',
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
    ConfirmDialogModule,
    ToastModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <div class="flex justify-content-between align-items-center mb-3">
      <h2 class="m-0">Student Administration</h2>
      <p-button
        label="New Student"
        icon="pi pi-plus"
        (onClick)="openCreateDialog()"
      ></p-button>
    </div>

    @if (loading()) {
      <p class="text-500">Loading...</p>
    } @else {
      <p-table
        [value]="students()"
        [rows]="20"
        [paginator]="students().length > 20"
        [globalFilterFields]="['name', 'email', 'role']"
        [rowHover]="true"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="name">Name <p-sortIcon field="name"></p-sortIcon></th>
            <th pSortableColumn="email">Email <p-sortIcon field="email"></p-sortIcon></th>
            <th>Age</th>
            <th pSortableColumn="role">Role <p-sortIcon field="role"></p-sortIcon></th>
            <th>Provider</th>
            <th>Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-s>
          <tr>
            <td>{{ s.name }}</td>
            <td>{{ s.email || '—' }}</td>
            <td>{{ calculateAge(s.birthday) ?? s.age ?? '—' }}</td>
            <td>
              <p-tag
                [value]="s.role"
                [severity]="s.role === 'admin' ? 'warning' : 'info'"
              ></p-tag>
            </td>
            <td>{{ s.auth_provider || '—' }}</td>
            <td>
              <div class="flex gap-1">
                <p-button
                  icon="pi pi-pencil"
                  [rounded]="true"
                  [text]="true"
                  size="small"
                  (onClick)="editStudent(s)"
                ></p-button>
                <p-button
                  icon="pi pi-key"
                  [rounded]="true"
                  [text]="true"
                  size="small"
                  severity="warning"
                  pTooltip="Reset password"
                  (onClick)="openResetPasswordDialog(s)"
                ></p-button>
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="6" class="text-center text-500">No students found.</td></tr>
        </ng-template>
      </p-table>
    }

    <!-- Create / Edit Dialog -->
    <p-dialog
      [(visible)]="dialogVisible"
      [header]="editingStudent ? 'Edit Student' : 'Create Student'"
      [modal]="true"
      [style]="{ width: '450px' }"
    >
      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-1">
          <label class="font-semibold">Name *</label>
          <input pInputText [(ngModel)]="dialogName" class="w-full" />
        </div>
        <div class="flex flex-column gap-1">
          <label class="font-semibold">Email *</label>
          <input pInputText [(ngModel)]="dialogEmail" class="w-full" type="email" />
        </div>
        @if (!editingStudent) {
          <div class="flex flex-column gap-1">
            <label class="font-semibold">Password * (min 6)</label>
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
            <label class="font-semibold">Birthday</label>
            <p-calendar
              [(ngModel)]="dialogBirthday"
              [showIcon]="true"
              dateFormat="yy-mm-dd"
              [maxDate]="maxDate"
              placeholder="YYYY-MM-DD"
              styleClass="w-full"
            ></p-calendar>
          </div>
          <div class="flex flex-column gap-1 flex-1">
            <label class="font-semibold">Gender</label>
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
          <label class="font-semibold">Role</label>
          <p-dropdown
            [options]="roleOptions"
            [(ngModel)]="dialogRole"
            optionLabel="label"
            optionValue="value"
          ></p-dropdown>
        </div>
        <div class="flex flex-column gap-1">
          <label class="font-semibold">Timetables</label>
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
        <p-button label="Cancel" severity="secondary" (onClick)="dialogVisible = false"></p-button>
        <p-button
          [label]="editingStudent ? 'Save' : 'Create'"
          icon="pi pi-check"
          (onClick)="saveStudent()"
          [loading]="dialogSaving()"
        ></p-button>
      </ng-template>
    </p-dialog>

    <!-- Reset Password Dialog -->
    <p-dialog
      [(visible)]="resetPwVisible"
      header="Reset Password"
      [modal]="true"
      [style]="{ width: '350px' }"
    >
      <p class="mb-3">Set a new password for <strong>{{ resetPwStudentName }}</strong></p>
      <p-password
        [(ngModel)]="newPassword"
        [feedback]="false"
        [toggleMask]="true"
        styleClass="w-full"
        inputStyleClass="w-full"
        placeholder="New password (min 6)"
      ></p-password>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="resetPwVisible = false"></p-button>
        <p-button
          label="Reset Password"
          icon="pi pi-key"
          severity="warning"
          (onClick)="resetPassword()"
          [disabled]="newPassword.length < 6"
        ></p-button>
      </ng-template>
    </p-dialog>
  `,
})
export class StudentAdminComponent implements OnInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);

  loading = signal(true);
  students = signal<StudentRow[]>([]);
  dialogVisible = false;
  dialogSaving = signal(false);
  editingStudent: StudentRow | null = null;

  dialogName = '';
  dialogEmail = '';
  dialogPassword = '';
  dialogBirthday: Date | null = null;
  dialogGender: string | null = null;
  dialogRole = 'student';
  dialogTimetables: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  resetPwVisible = false;
  resetPwStudentId = '';
  resetPwStudentName = '';
  newPassword = '';

  maxDate = new Date();
  timetableRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  genderOptions = [
    { label: 'Female', value: 'female' },
    { label: 'Male', value: 'male' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_say' },
  ];
  roleOptions = [
    { label: 'Student', value: 'student' },
    { label: 'Admin', value: 'admin' },
  ];

  ngOnInit() {
    this.loadStudents();
  }

  loadStudents() {
    this.loading.set(true);
    this.api.getStudents().subscribe({
      next: (students) => {
        this.students.set(students as any);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
    this.editingStudent = null;
    this.dialogName = '';
    this.dialogEmail = '';
    this.dialogPassword = '';
    this.dialogBirthday = null;
    this.dialogGender = null;
    this.dialogRole = 'student';
    this.dialogTimetables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    this.dialogVisible = true;
  }

  editStudent(s: StudentRow) {
    this.editingStudent = s;
    this.dialogName = s.name;
    this.dialogEmail = s.email || '';
    this.dialogPassword = '';
    this.dialogBirthday = s.birthday ? new Date(s.birthday) : null;
    this.dialogGender = s.gender;
    this.dialogRole = s.role;
    this.dialogTimetables = [...(s.learned_timetables || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])];
    this.dialogVisible = true;
  }

  saveStudent() {
    this.dialogSaving.set(true);
    if (this.editingStudent) {
      // Edit existing
      const age = this.dialogBirthday ? this.calculateAge(this.dialogBirthday.toISOString()) : null;
      this.api
        .updateStudent(this.editingStudent.id, {
          name: this.dialogName.trim(),
          age,
          gender: this.dialogGender,
          learned_timetables: this.dialogTimetables,
        })
        .subscribe({
          next: () => {
            this.dialogSaving.set(false);
            this.dialogVisible = false;
            this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Student updated' });
            this.loadStudents();
          },
          error: () => {
            this.dialogSaving.set(false);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update student' });
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
        .createStudent({
          name: this.dialogName.trim(),
          email: this.dialogEmail.trim(),
          password: this.dialogPassword,
          birthday: birthdayStr || null,
          gender: this.dialogGender,
          role: this.dialogRole,
          learnedTimetables: this.dialogTimetables,
        })
        .subscribe({
          next: () => {
            this.dialogSaving.set(false);
            this.dialogVisible = false;
            this.messageService.add({ severity: 'success', summary: 'Created', detail: 'Student account created' });
            this.loadStudents();
          },
          error: (err) => {
            this.dialogSaving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.detail || 'Failed to create student',
            });
          },
        });
    }
  }

  openResetPasswordDialog(s: StudentRow) {
    this.resetPwStudentId = s.id;
    this.resetPwStudentName = s.name;
    this.newPassword = '';
    this.resetPwVisible = true;
  }

  resetPassword() {
    this.api.resetStudentPassword(this.resetPwStudentId, this.newPassword).subscribe({
      next: () => {
        this.resetPwVisible = false;
        this.messageService.add({ severity: 'success', summary: 'Done', detail: 'Password reset successfully' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to reset password' });
      },
    });
  }
}
