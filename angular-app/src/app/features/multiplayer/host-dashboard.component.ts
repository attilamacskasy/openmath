import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslocoModule } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { MultiplayerWsService } from '../../core/services/multiplayer-ws.service';
import { PositionEntry, ChatMessage, GameResult } from '../../models/multiplayer.model';

interface AnswerCell {
  is_correct: boolean;
  lap_time: number;
  penalty: number;
}

interface DashboardPlayer {
  player_id: string;
  player_name: string;
  pos: number;
  completed: number;
  total_time: number;
  finished: boolean;
  answers: Map<number, AnswerCell>;
}

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule,
    TableModule, TagModule, ToolbarModule, InputTextModule,
    ToastModule, TranslocoModule,
  ],
  providers: [MessageService],
  template: `
    <ng-container *transloco="let t">
      <p-toast></p-toast>

      <p-toolbar styleClass="mb-3">
        <ng-template pTemplate="start">
          <div class="flex align-items-center gap-3">
            <span class="font-bold text-xl">{{ t('multiplayer.dashboard.title') }}</span>
            <p-tag [value]="gameCode" severity="info"></p-tag>
            <p-tag severity="secondary" [value]="t('multiplayer.game.elapsed') + ': ' + formatTime(elapsedMs())"></p-tag>
          </div>
        </ng-template>
        <ng-template pTemplate="end">
          @if (gameCompleted()) {
            <p-button [label]="t('multiplayer.lobby.end')" icon="pi pi-stop" severity="danger"
              (onClick)="endGame()"></p-button>
          }
        </ng-template>
      </p-toolbar>

      <!-- Scoreboard -->
      <p-card styleClass="mb-3">
        <p-table [value]="playerList()" styleClass="p-datatable-sm p-datatable-gridlines">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 50px;">{{ t('multiplayer.results.position') }}</th>
              <th style="width: 150px;">{{ t('multiplayer.lobby.player') }}</th>
              @for (qn of questionNumbers(); track qn) {
                <th class="text-center" style="width: 80px;">Q{{ qn }}</th>
              }
              <th style="width: 100px;">{{ t('multiplayer.game.totalTime') }}</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-player>
            <tr>
              <td class="text-center font-bold">
                @if (player.pos === 1 && player.finished) { <span>🥇</span> }
                @else if (player.pos === 2 && player.finished) { <span>🥈</span> }
                @else if (player.pos === 3 && player.finished) { <span>🥉</span> }
                @else { {{ player.pos }} }
              </td>
              <td>
                <strong>{{ player.player_name }}</strong>
                @if (player.finished) {
                  <p-tag value="Done" severity="success" styleClass="ml-1"></p-tag>
                }
              </td>
              @for (qn of questionNumbers(); track qn) {
                <td class="text-center">
                  @if (player.answers.has(qn); as hasAnswer) {
                    @if (player.answers.get(qn); as ans) {
                      @if (ans.is_correct) {
                        <i class="pi pi-check-circle text-green-500"></i>
                      } @else {
                        <div>
                          <i class="pi pi-times-circle text-red-500"></i>
                          <div class="text-xs text-red-400">+{{ ans.penalty / 1000 }}s</div>
                        </div>
                      }
                    }
                  }
                </td>
              }
              <td class="font-bold">{{ formatTime(player.total_time) }}</td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <!-- Chat -->
      <p-card [header]="t('multiplayer.lobby.chat')">
        <div class="surface-50 border-round p-2 mb-2 flex flex-column gap-1" style="height: 200px; overflow-y: auto;">
          @for (msg of chatMessages(); track msg.time) {
            <div class="text-sm"><strong>{{ msg.sender }}:</strong> {{ msg.text }}</div>
          }
        </div>
        <div class="flex gap-2">
          <input pInputText [(ngModel)]="chatInput" placeholder="Type a message..."
            class="flex-1" (keyup.enter)="sendChat()" [maxlength]="200" />
          <p-button icon="pi pi-send" (onClick)="sendChat()"></p-button>
        </div>
      </p-card>
    </ng-container>
  `,
})
export class HostDashboardComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ws = inject(MultiplayerWsService);
  private messageService = inject(MessageService);
  private destroyRef = inject(DestroyRef);

  gameCode = '';
  totalQuestions = signal(10);
  playerList = signal<DashboardPlayer[]>([]);
  chatMessages = signal<ChatMessage[]>([]);
  elapsedMs = signal(0);
  gameCompleted = signal(false);
  chatInput = '';
  private startTime = 0;
  private timerInterval: any;

  questionNumbers = signal<number[]>([]);

  ngOnInit() {
    this.gameCode = this.route.snapshot.paramMap.get('code') || '';
    this.startTime = Date.now();
    this.startTimer();

    // Check if game_started already fired before this component mounted
    const cached = this.ws.lastGameStarted();
    if (cached && cached.questions?.length) {
      console.log('[DASHBOARD] Using cached game_started payload:', cached.questions.length, 'questions');
      const qs = cached.questions;
      this.totalQuestions.set(qs.length);
      this.questionNumbers.set(qs.map((_: any, i: number) => i + 1));
    }

    // Also subscribe for future game_started events
    this.ws.onMessage('game_started').subscribe((p) => {
      const qs = p.questions || [];
      this.totalQuestions.set(qs.length);
      this.questionNumbers.set(qs.map((_: any, i: number) => i + 1));
    });

    this.ws.onMessage('answer_update').subscribe((p) => {
      this.playerList.update((list) => {
        let player = list.find((pl) => pl.player_id === p.player_id);
        if (!player) {
          player = {
            player_id: p.player_id,
            player_name: p.player_name || 'Player',
            pos: list.length + 1,
            completed: 0,
            total_time: 0,
            finished: false,
            answers: new Map(),
          };
          list = [...list, player];
        } else {
          list = list.map((pl) => pl.player_id === p.player_id ? { ...pl } : pl);
          player = list.find((pl) => pl.player_id === p.player_id)!;
        }
        player.answers.set(p.question_pos, {
          is_correct: p.is_correct,
          lap_time: p.lap_time,
          penalty: p.penalty,
        });
        player.completed = player.answers.size;
        player.total_time = p.total_time;
        return list;
      });
    });

    this.ws.onMessage('position_update').subscribe((p) => {
      const positions: PositionEntry[] = p.positions || [];
      this.playerList.update((list) => {
        return positions.map((pos) => {
          const existing = list.find((pl) => pl.player_id === pos.player_id);
          return {
            player_id: pos.player_id,
            player_name: pos.player_name,
            pos: pos.pos,
            completed: pos.completed,
            total_time: pos.total_time,
            finished: pos.finished,
            answers: existing?.answers || new Map(),
          };
        });
      });
    });

    this.ws.onMessage('chat_broadcast').subscribe((msg) => {
      this.chatMessages.update((list) => [...list, msg]);
    });

    this.ws.onMessage('game_completed').subscribe((p) => {
      this.gameCompleted.set(true);
      this.stopTimer();
      this.messageService.add({
        severity: 'success',
        summary: 'Game Complete',
        detail: 'All players have finished!',
      });
    });
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.elapsedMs.set(Date.now() - this.startTime);
    }, 100);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  endGame() {
    this.ws.send('end_game', {});
    this.ws.disconnect();
    this.router.navigate(['/multiplayer']);
  }

  sendChat() {
    const text = this.chatInput.trim();
    if (!text) return;
    this.ws.send('chat_message', { text });
    this.chatInput = '';
  }

  formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }
}
