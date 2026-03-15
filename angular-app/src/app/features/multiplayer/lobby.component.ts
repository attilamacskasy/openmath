import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MultiplayerService } from '../../core/services/multiplayer.service';
import { MultiplayerWsService } from '../../core/services/multiplayer-ws.service';
import { AuthService } from '../../core/services/auth.service';
import { MultiplayerGame, MultiplayerPlayer, ChatMessage } from '../../models/multiplayer.model';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule,
    TableModule, TagModule, InputSwitchModule, InputTextModule,
    ToastModule, ConfirmDialogModule, TranslocoModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <ng-container *transloco="let t">
      <p-toast></p-toast>
      <p-confirmDialog></p-confirmDialog>

      <!-- Countdown overlay -->
      @if (countdown() > 0) {
        <div class="fixed top-0 left-0 w-full h-full flex align-items-center justify-content-center"
          style="background: rgba(0,0,0,0.7); z-index: 9999;">
          <div class="text-center">
            <div class="text-white mb-3" style="font-size: 1.5rem;">{{ t('multiplayer.lobby.starting') }}</div>
            <div class="text-white font-bold" style="font-size: 8rem;">{{ countdown() }}</div>
          </div>
        </div>
      }

      <div class="flex justify-content-center">
        <p-card [style]="{ 'max-width': '900px', width: '100%' }">
          <ng-template pTemplate="header">
            <div class="flex justify-content-between align-items-center p-3">
              <div>
                <span class="text-xl font-bold">{{ t('multiplayer.lobby.title') }}</span>
                <span class="ml-2">
                  <p-tag [value]="gameCode" severity="info" styleClass="text-lg"></p-tag>
                </span>
              </div>
              <div class="flex align-items-center gap-2">
                <p-tag [value]="game()?.quiz_type_description || ''" severity="info"></p-tag>
                <p-tag [value]="game()?.difficulty || ''" severity="warning"></p-tag>
                <p-tag [value]="game()?.total_questions + ' Q'" severity="secondary"></p-tag>
              </div>
            </div>
          </ng-template>

          <div class="grid">
            <!-- Player list -->
            <div class="col-12 md:col-7">
              <h3>{{ t('multiplayer.lobby.players') }} ({{ players().length }}/{{ game()?.max_players || '?' }})</h3>
              <p-table [value]="players()" styleClass="p-datatable-sm">
                <ng-template pTemplate="header">
                  <tr>
                    <th>#</th>
                    <th>{{ t('multiplayer.lobby.player') }}</th>
                    <th>{{ t('multiplayer.lobby.status') }}</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-player>
                  <tr>
                    <td>{{ player.slot_number }}</td>
                    <td>{{ player.user_name || 'Player' }}</td>
                    <td>
                      @if (player.is_ready) {
                        <p-tag value="Ready" severity="success" icon="pi pi-check"></p-tag>
                      } @else {
                        <p-tag value="Waiting" severity="warning" icon="pi pi-clock"></p-tag>
                      }
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr><td colspan="3" class="text-center text-500">{{ t('multiplayer.lobby.waiting') }}</td></tr>
                </ng-template>
              </p-table>

              <div class="flex gap-2 mt-3 flex-wrap">
                @if (!isHost()) {
                  <div class="flex align-items-center gap-2">
                    <p-inputSwitch [(ngModel)]="ready" (onChange)="toggleReady()"></p-inputSwitch>
                    <label class="font-semibold">{{ t('multiplayer.lobby.ready') }}</label>
                  </div>
                }

                @if (isHost()) {
                  <p-button [label]="t('multiplayer.lobby.start')" icon="pi pi-play"
                    (onClick)="startGame()" [disabled]="!canStart()"></p-button>
                }

                <p-button [label]="t('multiplayer.lobby.leave')" icon="pi pi-sign-out"
                  severity="danger" [text]="true" (onClick)="confirmLeave()"></p-button>
              </div>
            </div>

            <!-- Chat -->
            <div class="col-12 md:col-5">
              <h3>{{ t('multiplayer.lobby.chat') }}</h3>
              <div class="surface-50 border-round p-2 mb-2 flex flex-column gap-1"
                style="height: 300px; overflow-y: auto;" #chatContainer>
                @for (msg of chatMessages(); track msg.time) {
                  <div class="text-sm">
                    <strong>{{ msg.sender }}:</strong> {{ msg.text }}
                  </div>
                }
                @if (chatMessages().length === 0) {
                  <div class="text-center text-500 text-sm py-3">{{ t('multiplayer.lobby.noMessages') }}</div>
                }
              </div>
              <div class="flex gap-2">
                <input pInputText [(ngModel)]="chatInput" [placeholder]="t('multiplayer.lobby.typeMessage')"
                  class="flex-1" (keyup.enter)="sendChat()" [maxlength]="200" />
                <p-button icon="pi pi-send" (onClick)="sendChat()" [disabled]="!chatInput.trim()"></p-button>
              </div>
            </div>
          </div>
        </p-card>
      </div>
    </ng-container>
  `,
})
export class LobbyComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private mpService = inject(MultiplayerService);
  private ws = inject(MultiplayerWsService);
  private auth = inject(AuthService);
  private messageService = inject(MessageService);
  private confirmService = inject(ConfirmationService);
  private t = inject(TranslocoService);

  gameCode = '';
  game = signal<MultiplayerGame | null>(null);
  players = signal<MultiplayerPlayer[]>([]);
  chatMessages = signal<ChatMessage[]>([]);
  countdown = signal(0);
  ready = false;
  chatInput = '';

  isHost = signal(false);

  canStart(): boolean {
    const g = this.game();
    const p = this.players();
    if (!g) return false;
    return p.length >= g.min_players && p.every((pl) => pl.is_ready);
  }

  ngOnInit() {
    this.gameCode = this.route.snapshot.paramMap.get('code') || '';
    this.loadGame();
    this.ws.connect(this.gameCode);
    this.setupWsListeners();
  }

  ngOnDestroy() {
    this.ws.disconnect();
  }

  loadGame() {
    this.mpService.getGame(this.gameCode).subscribe({
      next: (detail) => {
        this.game.set(detail.game);
        this.players.set(detail.players);
        const userId = this.auth.currentUser()?.id;
        this.isHost.set(detail.game.host_user_id === userId);
      },
      error: () => this.router.navigate(['/multiplayer']),
    });
  }

  setupWsListeners() {
    this.ws.onMessage('player_joined').subscribe((p) => {
      this.players.update((list) => {
        if (list.some((pl) => pl.user_id === p.player.id)) return list;
        return [...list, {
          id: p.player.id, user_id: p.player.id, user_name: p.player.name,
          slot_number: list.length + 1, is_ready: false,
          correct_count: 0, wrong_count: 0, penalty_time_ms: 0, joined_at: new Date().toISOString(),
        } as MultiplayerPlayer];
      });
    });

    this.ws.onMessage('player_left').subscribe((p) => {
      this.players.update((list) => list.filter((pl) => pl.user_id !== p.player_id));
    });

    this.ws.onMessage('player_ready_changed').subscribe((p) => {
      this.players.update((list) =>
        list.map((pl) => pl.user_id === p.player_id ? { ...pl, is_ready: p.ready } : pl)
      );
    });

    this.ws.onMessage('chat_broadcast').subscribe((msg) => {
      this.chatMessages.update((list) => [...list, msg]);
    });

    this.ws.onMessage('countdown_tick').subscribe((p) => {
      this.countdown.set(p.value);
    });

    this.ws.onMessage('game_started').subscribe((p) => {
      this.countdown.set(0);
      if (this.isHost()) {
        this.router.navigate(['/multiplayer/dashboard', this.gameCode]);
      } else {
        this.router.navigate(['/multiplayer/play', this.gameCode]);
      }
    });

    this.ws.onMessage('game_ended').subscribe(() => {
      this.messageService.add({ severity: 'info', summary: 'Game ended', detail: 'The host ended the game.' });
      this.router.navigate(['/multiplayer']);
    });

    this.ws.onMessage('error').subscribe((p) => {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: p.message });
    });
  }

  toggleReady() {
    this.ws.send('player_ready', { ready: this.ready });
  }

  startGame() {
    this.ws.send('start_game', {});
  }

  sendChat() {
    const text = this.chatInput.trim();
    if (!text) return;
    this.ws.send('chat_message', { text });
    this.chatInput = '';
  }

  confirmLeave() {
    this.confirmService.confirm({
      message: this.t.translate('multiplayer.lobby.leaveConfirm'),
      accept: () => {
        this.ws.disconnect();
        if (!this.isHost()) {
          this.mpService.leaveGame(this.gameCode).subscribe();
        }
        this.router.navigate(['/multiplayer']);
      },
    });
  }
}
