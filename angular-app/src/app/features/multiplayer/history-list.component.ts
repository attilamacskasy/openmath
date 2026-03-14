import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TranslocoModule } from '@jsverse/transloco';
import { MultiplayerService } from '../../core/services/multiplayer.service';
import { HistoryGame } from '../../models/multiplayer.model';

@Component({
  selector: 'app-multiplayer-history-list',
  standalone: true,
  imports: [CommonModule, CardModule, TableModule, TagModule, ButtonModule, TranslocoModule],
  template: `
    <ng-container *transloco="let t">
      <div class="flex justify-content-center">
        <p-card [header]="t('multiplayer.history.title')" [style]="{ 'max-width': '900px', width: '100%' }">
          <p-table [value]="games()" [paginator]="true" [rows]="10"
            [rowsPerPageOptions]="[5, 10, 25]" styleClass="p-datatable-sm"
            [sortField]="'created_at'" [sortOrder]="-1" [loading]="loading()"
            [emptyMessage]="t('multiplayer.history.noGames')"
            selectionMode="single" (onRowSelect)="onSelect($event)">
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="created_at">{{ t('multiplayer.history.date') }} <p-sortIcon field="created_at"></p-sortIcon></th>
                <th>{{ t('multiplayer.join.code') }}</th>
                <th>{{ t('quiz.quizType') }}</th>
                <th>{{ t('multiplayer.join.players') }}</th>
                <th>{{ t('multiplayer.results.winner') }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-game>
              <tr [pSelectableRow]="game">
                <td>{{ game.created_at | date:'short' }}</td>
                <td><strong>{{ game.game_code }}</strong></td>
                <td><p-tag [value]="game.quiz_type_description || game.quiz_type_code || ''" severity="info"></p-tag></td>
                <td>{{ game.player_count }}</td>
                <td>
                  @if (game.winner_name) {
                    <p-tag severity="success">
                      <span>🥇 {{ game.winner_name }} {{ formatTime(game.winner_time_ms) }}</span>
                    </p-tag>
                  } @else {
                    <span class="text-500">-</span>
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>

          <p-button [label]="t('common.back')" icon="pi pi-arrow-left" severity="secondary"
            [text]="true" (onClick)="back()" styleClass="mt-3"></p-button>
        </p-card>
      </div>
    </ng-container>
  `,
})
export class MultiplayerHistoryListComponent implements OnInit {
  private mpService = inject(MultiplayerService);
  private router = inject(Router);

  games = signal<HistoryGame[]>([]);
  loading = signal(false);

  ngOnInit() {
    this.loading.set(true);
    this.mpService.getHistory().subscribe({
      next: (g) => { this.games.set(g); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSelect(event: any) {
    this.router.navigate(['/multiplayer/history', event.data.game_code]);
  }

  formatTime(ms?: number): string {
    if (!ms) return '';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  back() {
    this.router.navigate(['/multiplayer']);
  }
}
