import { Component, DestroyRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { Notification } from '../../../models/notification.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ButtonModule, TagModule, OverlayPanelModule, TooltipModule, ConfirmDialogModule],
  providers: [ConfirmationService],
  template: `
    <header class="surface-card shadow-2 px-4 py-2 flex align-items-center justify-content-between">
      <nav class="flex gap-3 align-items-center">
        <a routerLink="/" class="no-underline flex align-items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28">
            <defs>
              <linearGradient id="om-grad-h" x1="80" y1="60" x2="430" y2="460" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#2D9CDB" />
                <stop offset="1" stop-color="#27AE60" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="210" fill="url(#om-grad-h)" />
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
        </a>
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
          <p-tag
            [value]="providerLabel(user.authProvider)"
            [severity]="user.authProvider === 'local' ? 'secondary' : 'success'"
          ></p-tag>
          <span class="text-sm font-semibold">{{ user.name }}</span>
          <span class="text-xs text-500">({{ user.email }})</span>
          <span class="text-300">|</span>
          @for (role of user.roles; track role) {
            <p-tag [value]="role" [severity]="roleSeverity(role)"></p-tag>
          }
          <span class="text-300">|</span>
          <div class="relative cursor-pointer" (click)="toggleNotifications($event)">
            <i class="pi pi-bell text-xl"></i>
            @if (unreadCount() > 0) {
              <span class="absolute"
                style="top: -8px; right: -8px; background: #e53935; color: white;
                       border-radius: 50%; min-width: 18px; height: 18px;
                       font-size: 0.7rem; display: flex; align-items: center;
                       justify-content: center; padding: 0 4px; font-weight: bold;">
                {{ unreadCount() > 99 ? '99+' : unreadCount() }}
              </span>
            }
          </div>
          <span class="text-300">|</span>
          <p-button
            label="Logout"
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            size="small"
            (onClick)="confirmLogout($event)"
          ></p-button>
        }
      </div>
    </header>

    <p-confirmDialog></p-confirmDialog>

    <p-overlayPanel #notifPanel [style]="{ width: '400px' }">
      <div class="flex justify-content-between align-items-center mb-2">
        <span class="font-semibold text-lg">Notifications</span>
        @if (unreadCount() > 0) {
          <p-button label="Accept All" icon="pi pi-check-circle" size="small"
            severity="secondary" [text]="true" (onClick)="acceptAll()"></p-button>
        }
      </div>
      <div class="flex flex-column gap-1" style="max-height: 400px; overflow-y: auto;">
        @for (notif of notifications(); track notif.id) {
          <div class="p-3 border-round flex justify-content-between align-items-start gap-2"
            [class.surface-100]="!notif.is_read" [class.surface-50]="notif.is_read">
            <div class="flex-1">
              <div class="font-semibold text-sm">{{ notif.title }}</div>
              <div class="text-sm text-700">{{ notif.message }}</div>
              <div class="text-xs text-500 mt-1">{{ notif.created_at | date:'short' }}</div>
            </div>
            @if (!notif.is_read) {
              <p-button icon="pi pi-check" [rounded]="true" [text]="true" size="small"
                severity="success" pTooltip="Accept"
                (onClick)="acceptNotification(notif)"></p-button>
            }
          </div>
        }
        @if (notifications().length === 0) {
          <div class="text-center text-500 py-3">No notifications</div>
        }
      </div>
    </p-overlayPanel>
  `,
  styles: [`
    nav a {
      padding: 0.375rem 0.625rem;
      border-radius: 6px;
      transition: background-color 0.15s;
    }
    nav a:hover {
      background-color: #f0f0f0;
    }
  `],
})
export class HeaderComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private confirmService = inject(ConfirmationService);

  unreadCount = signal(0);
  notifications = signal<Notification[]>([]);

  @ViewChild('notifPanel') notifPanel!: OverlayPanel;

  ngOnInit() {
    this.loadUnreadCount();
    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadUnreadCount());
  }

  loadUnreadCount() {
    if (!this.auth.currentUser()) return;
    this.api.getUnreadNotificationCount().subscribe({
      next: (r) => this.unreadCount.set(r.count),
      error: () => {},
    });
  }

  toggleNotifications(event: Event) {
    this.notifPanel.toggle(event);
    this.api.getNotifications().subscribe((n) => this.notifications.set(n));
  }

  acceptNotification(notif: Notification) {
    this.api.markNotificationRead(notif.id).subscribe(() => {
      notif.is_read = true;
      this.unreadCount.update((c) => Math.max(0, c - 1));
    });
  }

  acceptAll() {
    this.api.markAllNotificationsRead().subscribe(() => {
      this.notifications.update((list) => list.map((n) => ({ ...n, is_read: true })));
      this.unreadCount.set(0);
    });
  }

  providerLabel(provider: string): string {
    switch (provider) {
      case 'google': return 'google';
      case 'both': return 'google + local';
      default: return 'local';
    }
  }

  roleSeverity(role: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (role) {
      case 'admin': return 'danger';
      case 'teacher': return 'warning';
      case 'parent': return 'secondary';
      default: return 'info';
    }
  }

  confirmLogout(event: Event) {
    this.confirmService.confirm({
      message: 'Are you sure you want to log out?',
      header: 'Confirm Logout',
      icon: 'pi pi-sign-out',
      accept: () => this.auth.logout(),
    });
  }
}
