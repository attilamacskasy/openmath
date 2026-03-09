import { Component, DestroyRef, inject, OnInit, signal, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { MenubarModule } from 'primeng/menubar';
import { BadgeModule } from 'primeng/badge';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { LocaleService } from '../../../core/services/locale.service';
import { Notification } from '../../../models/notification.model';
import { LocalDatePipe } from '../../pipes/local-date.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, OverlayPanelModule, TooltipModule, ConfirmDialogModule, MenubarModule, BadgeModule, TranslocoModule, LocalDatePipe],
  providers: [ConfirmationService],
  template: `
    <ng-container *transloco="let t">
    <p-menubar [model]="menuItems()" styleClass="shadow-2 border-noround">
      <ng-template pTemplate="start">
        <a routerLink="/" class="no-underline flex align-items-center mr-3 cursor-pointer" (click)="navigateTo('/')">
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
      </ng-template>
      <ng-template pTemplate="end">
        <div class="flex align-items-center gap-2">
          @if (auth.currentUser(); as user) {
            <span class="text-xs font-semibold hidden md:inline">{{ user.name }}</span>
            @for (role of user.roles; track role) {
              <p-tag [value]="role" [severity]="roleSeverity(role)" class="text-xs"></p-tag>
            }
            <div class="relative cursor-pointer" (click)="toggleNotifications($event)">
              <i class="pi pi-bell text-lg"></i>
              @if (unreadCount() > 0) {
                <span class="absolute"
                  style="top: -8px; right: -8px; background: #e53935; color: white;
                         border-radius: 50%; min-width: 16px; height: 16px;
                         font-size: 0.65rem; display: flex; align-items: center;
                         justify-content: center; padding: 0 3px; font-weight: bold;">
                  {{ unreadCount() > 99 ? '99+' : unreadCount() }}
                </span>
              }
            </div>
            <p-button
              icon="pi pi-sign-out"
              severity="secondary"
              [text]="true"
              [rounded]="true"
              size="small"
              [pTooltip]="t('header.logout')"
              (onClick)="confirmLogout($event)"
            ></p-button>
          }
        </div>
      </ng-template>
    </p-menubar>

    <p-confirmDialog></p-confirmDialog>

    <p-overlayPanel #notifPanel [style]="{ width: '400px' }">
      <div class="flex justify-content-between align-items-center mb-2">
        <span class="font-semibold text-lg">{{ t('header.notifications') }}</span>
        @if (unreadCount() > 0) {
          <p-button [label]="t('header.acceptAll')" icon="pi pi-check-circle" size="small"
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
              <div class="text-xs text-500 mt-1">{{ notif.created_at | localDate:'short' }}</div>
            </div>
            @if (!notif.is_read) {
              <p-button icon="pi pi-check" [rounded]="true" [text]="true" size="small"
                severity="success" [pTooltip]="t('header.accept')"
                (onClick)="acceptNotification(notif)"></p-button>
            }
          </div>
        }
        @if (notifications().length === 0) {
          <div class="text-center text-500 py-3">{{ t('header.noNotifications') }}</div>
        }
      </div>
    </p-overlayPanel>
    </ng-container>
  `,
  styles: [`
    :host ::ng-deep .p-menubar {
      border-radius: 0;
      padding: 0.25rem 1rem;
    }
    :host ::ng-deep .p-menubar .p-menuitem-text {
      font-size: 0.85rem;
    }
    :host ::ng-deep .p-menubar .p-menuitem-icon {
      font-size: 0.85rem;
    }
    :host ::ng-deep .p-menubar .p-menubar-root-list > .p-menuitem > .p-menuitem-content .p-menuitem-link {
      padding: 0.5rem 0.75rem;
    }
  `],
})
export class HeaderComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private confirmService = inject(ConfirmationService);
  private translocoService = inject(TranslocoService);
  localeService = inject(LocaleService);

  unreadCount = signal(0);
  notifications = signal<Notification[]>([]);

  @ViewChild('notifPanel') notifPanel!: OverlayPanel;

  menuItems = computed<MenuItem[]>(() => {
    const t = (key: string) => this.translocoService.translate(key);
    const user = this.auth.currentUser();
    if (!user) return [];

    const items: MenuItem[] = [
      { label: t('nav.start'), icon: 'pi pi-home', command: () => this.navigateTo('/') },
      { label: t('nav.profile'), icon: 'pi pi-user', command: () => this.navigateTo('/profile') },
      { label: t('nav.history'), icon: 'pi pi-clock', command: () => this.navigateTo('/history') },
    ];

    if (this.auth.isTeacher()) {
      items.push({ label: t('nav.myStudents'), icon: 'pi pi-users', command: () => this.navigateTo('/teacher') });
    }
    if (this.auth.isParent()) {
      items.push({ label: t('nav.myChild'), icon: 'pi pi-heart', command: () => this.navigateTo('/parent') });
    }

    items.push({ label: t('nav.userGuide'), icon: 'pi pi-book', command: () => this.navigateTo('/user-guide') });

    if (this.auth.isAdmin()) {
      items.push({
        label: t('nav.admin'),
        icon: 'pi pi-cog',
        items: [
          { label: t('nav.users'), icon: 'pi pi-users', command: () => this.navigateTo('/users') },
          { label: t('nav.quizTypes'), icon: 'pi pi-list', command: () => this.navigateTo('/admin/quiz-types') },
          { label: t('nav.admin'), icon: 'pi pi-shield', command: () => this.navigateTo('/admin') },
        ],
      });
    }

    return items;
  });

  ngOnInit() {
    this.loadUnreadCount();
    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadUnreadCount());
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
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

  roleSeverity(role: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (role) {
      case 'admin': return 'danger';
      case 'teacher': return 'warning';
      case 'parent': return 'secondary';
      default: return 'info';
    }
  }

  confirmLogout(event: Event) {
    const t = (key: string) => this.translocoService.translate(key);
    this.confirmService.confirm({
      message: t('header.logoutConfirm'),
      header: t('header.confirmLogout'),
      icon: 'pi pi-sign-out',
      accept: () => this.auth.logout(),
    });
  }
}
