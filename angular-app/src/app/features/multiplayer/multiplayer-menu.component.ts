import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-multiplayer-menu',
  standalone: true,
  imports: [CommonModule, CardModule, TranslocoModule],
  template: `
    <ng-container *transloco="let t">
      <div class="flex justify-content-center">
        <p-card [header]="t('multiplayer.menu.title')" [subheader]="t('multiplayer.menu.subtitle')" [style]="{ 'max-width': '900px', width: '100%' }">
          <div class="grid">
            <div class="col-12 md:col-4" (click)="go('/multiplayer/join')">
              <div class="surface-card hover:surface-hover cursor-pointer border-round p-4 text-center h-full flex flex-column align-items-center gap-3 border-1 surface-border">
                <i class="pi pi-search text-primary" style="font-size: 3rem;"></i>
                <span class="font-bold text-lg">{{ t('multiplayer.menu.join') }}</span>
                <span class="text-sm text-600">{{ t('multiplayer.menu.joinDesc') }}</span>
              </div>
            </div>
            <div class="col-12 md:col-4" (click)="go('/multiplayer/create')">
              <div class="surface-card hover:surface-hover cursor-pointer border-round p-4 text-center h-full flex flex-column align-items-center gap-3 border-1 surface-border">
                <i class="pi pi-plus text-primary" style="font-size: 3rem;"></i>
                <span class="font-bold text-lg">{{ t('multiplayer.menu.create') }}</span>
                <span class="text-sm text-600">{{ t('multiplayer.menu.createDesc') }}</span>
              </div>
            </div>
            <div class="col-12 md:col-4" (click)="go('/multiplayer/history')">
              <div class="surface-card hover:surface-hover cursor-pointer border-round p-4 text-center h-full flex flex-column align-items-center gap-3 border-1 surface-border">
                <i class="pi pi-history text-primary" style="font-size: 3rem;"></i>
                <span class="font-bold text-lg">{{ t('multiplayer.menu.history') }}</span>
                <span class="text-sm text-600">{{ t('multiplayer.menu.historyDesc') }}</span>
              </div>
            </div>
          </div>
        </p-card>
      </div>
    </ng-container>
  `,
})
export class MultiplayerMenuComponent {
  private router = inject(Router);

  go(path: string) {
    this.router.navigate([path]);
  }
}
