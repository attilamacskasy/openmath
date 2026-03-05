import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule, DropdownModule],
  template: `
    <header class="surface-card shadow-2 px-4 py-2 flex align-items-center justify-content-between">
      <nav class="flex gap-3 align-items-center">
        <a routerLink="/" routerLinkActive="font-bold" [routerLinkActiveOptions]="{exact: true}" class="no-underline text-primary text-lg">Start</a>
        <a routerLink="/profile" routerLinkActive="font-bold" class="no-underline text-primary">Profile</a>
        <a routerLink="/history" routerLinkActive="font-bold" class="no-underline text-primary">History</a>
        <a routerLink="/user-guide" routerLinkActive="font-bold" class="no-underline text-primary">User Guide</a>
        <a routerLink="/admin" routerLinkActive="font-bold" class="no-underline text-primary">Admin</a>
      </nav>
      <div class="flex align-items-center gap-2">
        <label class="text-sm text-500">Student:</label>
        <p-dropdown
          [options]="studentOptions()"
          [(ngModel)]="selectedStudentId"
          optionLabel="label"
          optionValue="value"
          placeholder="No student"
          [showClear]="true"
          (onChange)="onStudentChange($event)"
          [style]="{'min-width': '180px'}"
        ></p-dropdown>
      </div>
    </header>
  `,
})
export class HeaderComponent implements OnInit {
  private quiz = inject(QuizService);

  selectedStudentId: string = '';

  studentOptions = () => {
    return this.quiz.studentsDirectory().map((s) => ({
      label: s.name,
      value: s.id,
    }));
  };

  ngOnInit() {
    this.quiz.refreshStudents();
    this.selectedStudentId = this.quiz.currentStudentId();
  }

  onStudentChange(event: any) {
    this.quiz.setCurrentStudent(event.value || '');
  }
}
