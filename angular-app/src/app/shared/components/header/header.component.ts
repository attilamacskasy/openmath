import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ButtonModule],
  template: `
    <header class="surface-card shadow-2 px-4 py-2 flex align-items-center justify-content-between">
      <nav class="flex gap-3 align-items-center">
        <a routerLink="/" routerLinkActive="font-bold" [routerLinkActiveOptions]="{exact: true}" class="no-underline text-primary text-lg">Start</a>
        <a routerLink="/profile" routerLinkActive="font-bold" class="no-underline text-primary">Profile</a>
        <a routerLink="/history" routerLinkActive="font-bold" class="no-underline text-primary">History</a>
        <a routerLink="/user-guide" routerLinkActive="font-bold" class="no-underline text-primary">User Guide</a>
        @if (auth.isAdmin()) {
          <a routerLink="/students" routerLinkActive="font-bold" class="no-underline text-primary">Students</a>
          <a routerLink="/admin" routerLinkActive="font-bold" class="no-underline text-primary">Admin</a>
        }
      </nav>
      <div class="flex align-items-center gap-2">
        @if (auth.currentUser(); as user) {
          <span class="text-sm font-semibold">{{ user.name }}</span>
          <p-button
            label="Logout"
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            size="small"
            (onClick)="auth.logout()"
          ></p-button>
        }
      </div>
    </header>
  `,
})
export class HeaderComponent {
  auth = inject(AuthService);
}
