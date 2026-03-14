import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { MultiplayerService } from '../../core/services/multiplayer.service';
import { AuthService } from '../../core/services/auth.service';
import {
  HistoryDetail,
  MultiplayerPlayer,
  MultiplayerQuestion,
  MultiplayerAnswer,
  ChatMessage,
} from '../../models/multiplayer.model';

@Component({
  selector: 'app-multiplayer-history-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, TableModule, TagModule, ButtonModule, CheckboxModule, TranslocoModule],
  template: `
    <ng-container *transloco="let t">
      <div class="flex justify-content-center">
        <div style="max-width: 1000px; width: 100%;">

          <!-- Game info -->
          <p-card styleClass="mb-3">
            <ng-template pTemplate="header">
              <div class="flex justify-content-between align-items-center p-3">
                <div>
                  <span class="text-xl font-bold">{{ detail()?.game?.game_code }}</span>
                  <p-tag [value]="detail()?.game?.quiz_type_description || ''" severity="info" styleClass="ml-2"></p-tag>
                  <p-tag [value]="detail()?.game?.difficulty || ''" severity="warning" styleClass="ml-1"></p-tag>
                </div>
                <span class="text-500">{{ detail()?.game?.created_at | date:'medium' }}</span>
              </div>
            </ng-template>

            <!-- Results table -->
            <p-table [value]="sortedPlayers()" styleClass="p-datatable-sm p-datatable-gridlines">
              <ng-template pTemplate="header">
                <tr>
                  <th style="width: 60px;">{{ t('multiplayer.results.position') }}</th>
                  <th>{{ t('multiplayer.lobby.player') }}</th>
                  <th class="text-center">{{ t('multiplayer.history.correct') }}</th>
                  <th class="text-center">{{ t('multiplayer.history.wrong') }}</th>
                  <th class="text-center">{{ t('multiplayer.game.penalty') }}</th>
                  <th class="text-center">{{ t('multiplayer.game.totalTime') }}</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-player>
                <tr>
                  <td class="text-center font-bold">
                    @if (player.final_position === 1) { 🥇 }
                    @else if (player.final_position === 2) { 🥈 }
                    @else if (player.final_position === 3) { 🥉 }
                    @else { {{ player.final_position || '-' }} }
                  </td>
                  <td><strong>{{ player.user_name || 'Player' }}</strong></td>
                  <td class="text-center text-green-600">{{ player.correct_count }}</td>
                  <td class="text-center text-red-600">{{ player.wrong_count }}</td>
                  <td class="text-center">{{ formatTime(player.penalty_time_ms) }}</td>
                  <td class="text-center font-bold">{{ formatTime(player.total_time_ms) }}</td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>

          <!-- Chat transcript -->
          @if (chat().length > 0) {
            <p-card [header]="t('multiplayer.lobby.chat')" styleClass="mb-3">
              <div class="surface-50 border-round p-3 flex flex-column gap-1" style="max-height: 300px; overflow-y: auto;">
                @for (msg of chat(); track msg.sent_at) {
                  <div class="text-sm">
                    <strong>{{ msg.user_name || msg.sender || 'Unknown' }}:</strong> {{ msg.message || msg.text }}
                  </div>
                }
              </div>
            </p-card>
          }

          <p-button [label]="t('common.back')" icon="pi pi-arrow-left" severity="secondary"
            [text]="true" (onClick)="back()"></p-button>
        </div>
      </div>
    </ng-container>
  `,
})
export class MultiplayerHistoryDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mpService = inject(MultiplayerService);

  detail = signal<HistoryDetail | null>(null);
  loading = signal(false);

  sortedPlayers = signal<MultiplayerPlayer[]>([]);
  chat = signal<any[]>([]);

  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code') || '';
    this.loading.set(true);
    this.mpService.getHistoryDetail(code).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.sortedPlayers.set(
          [...d.players].sort((a, b) => (a.final_position || 999) - (b.final_position || 999))
        );
        this.chat.set(d.chat || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/multiplayer/history']);
      },
    });
  }

  formatTime(ms?: number): string {
    if (!ms) return '-';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  back() {
    this.router.navigate(['/multiplayer/history']);
  }
}
