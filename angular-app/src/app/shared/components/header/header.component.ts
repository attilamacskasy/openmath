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
        @if (auth.isTeacher()) {
          <a routerLink="/teacher" routerLinkActive="font-bold" class="no-underline text-primary">My Students</a>
        }
        @if (auth.isParent()) {
          <a routerLink="/parent" routerLinkActive="font-bold" class="no-underline text-primary">My Child</a>
        }
        <a routerLink="/user-guide" routerLinkActive="font-bold" class="no-underline text-primary">User Guide</a>
        @if (auth.isAdmin()) {
          <a routerLink="/users" routerLinkActive="font-bold" class="no-underline text-primary">Users</a>
          <a routerLink="/admin/quiz-types" routerLinkActive="font-bold" class="no-underline text-primary">Quiz Types</a>
          <a routerLink="/admin" routerLinkActive="font-bold" [routerLinkActiveOptions]="{exact: true}" class="no-underline text-primary">Admin</a>
        }
      </nav>
      <div class="flex align-items-center gap-2">
        @if (auth.currentUser(); as user) {
          <span class="text-sm font-semibold">{{ user.name }}</span>
          <span class="text-xs border-round px-2 py-1" [ngClass]="providerClass(user.authProvider)">{{ providerLabel(user.authProvider) }}</span>
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

  providerLabel(p: string): string {
    return p === 'google' ? '🔵 Google' : p === 'both' ? '🔗 Google + Local' : '🔑 Local';
  }

  providerClass(p: string): string {
    return p === 'google' ? 'bg-blue-100 text-blue-700' : p === 'both' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700';
  }
}
