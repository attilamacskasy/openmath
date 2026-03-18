import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslocoModule } from '@jsverse/transloco';
import { MultiplayerWsService } from '../../core/services/multiplayer-ws.service';
import { MultiplayerService } from '../../core/services/multiplayer.service';
import { AuthService } from '../../core/services/auth.service';
import { GameResult, ChatMessage, MultiplayerGame } from '../../models/multiplayer.model';

interface AnswerCell {
  is_correct: boolean;
  lap_time: number;
  penalty: number;
}

interface ScoreboardPlayer {
  player_id: string;
  player_name: string;
  position: number;
  total_time: number;
  finished: boolean;
  answers: Map<number, AnswerCell>;
}

@Component({
  selector: 'app-game-results',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, ButtonModule,
    TableModule, TagModule, InputTextModule, ToastModule,
    TranslocoModule,
  ],
  providers: [MessageService],
  template: `
    <ng-container *transloco="let t">
      <p-toast></p-toast>

      <div class="flex justify-content-center">
        <div style="max-width: 1100px; width: 100%;" class="flex flex-column gap-3">

          <!-- Podium -->
          <p-card>
            <div class="text-center mb-3">
              <span class="text-2xl font-bold">{{ t('multiplayer.results.gameOver') }}</span>
              <span class="ml-2"><p-tag [value]="gameCode" severity="info"></p-tag></span>
            </div>

            <div class="flex justify-content-center align-items-end gap-4 mb-4" style="min-height: 220px;">
              <!-- 2nd place (left) -->
              @if (podium()[1]; as p2) {
                <div class="flex flex-column align-items-center">
                  <div class="text-4xl mb-2">🥈</div>
                  <div class="surface-200 border-round-top p-3 text-center" style="width: 140px; min-height: 120px;">
                    <div class="font-bold text-lg">{{ p2.name }}</div>
                    <div class="text-sm text-600 mt-1">{{ p2.correct_count }}/{{ totalQuestions() }} {{ t('multiplayer.game.correct') }}</div>
                    <div class="text-sm font-semibold mt-1">{{ formatTime(p2.total_time_ms) }}</div>
                    @if (p2.penalty_time_ms > 0) {
                      <div class="text-xs text-red-500">+{{ formatTime(p2.penalty_time_ms) }} {{ t('multiplayer.game.penalty') }}</div>
                    }
                  </div>
                </div>
              }

              <!-- 1st place (center, taller) -->
              @if (podium()[0]; as p1) {
                <div class="flex flex-column align-items-center">
                  <div style="font-size: 3.5rem;" class="mb-2">🥇</div>
                  <div class="bg-yellow-100 border-round-top p-3 text-center" style="width: 160px; min-height: 160px;">
                    <div class="font-bold text-xl">{{ p1.name }}</div>
                    <div class="text-sm text-600 mt-1">{{ p1.correct_count }}/{{ totalQuestions() }} {{ t('multiplayer.game.correct') }}</div>
                    <div class="text-lg font-bold mt-1">{{ formatTime(p1.total_time_ms) }}</div>
                    @if (p1.penalty_time_ms > 0) {
                      <div class="text-xs text-red-500">+{{ formatTime(p1.penalty_time_ms) }} {{ t('multiplayer.game.penalty') }}</div>
                    }
                  </div>
                </div>
              }

              <!-- 3rd place (right) -->
              @if (podium()[2]; as p3) {
                <div class="flex flex-column align-items-center">
                  <div class="text-4xl mb-2">🥉</div>
                  <div class="surface-200 border-round-top p-3 text-center" style="width: 130px; min-height: 100px;">
                    <div class="font-bold text-lg">{{ p3.name }}</div>
                    <div class="text-sm text-600 mt-1">{{ p3.correct_count }}/{{ totalQuestions() }} {{ t('multiplayer.game.correct') }}</div>
                    <div class="text-sm font-semibold mt-1">{{ formatTime(p3.total_time_ms) }}</div>
                    @if (p3.penalty_time_ms > 0) {
                      <div class="text-xs text-red-500">+{{ formatTime(p3.penalty_time_ms) }} {{ t('multiplayer.game.penalty') }}</div>
                    }
                  </div>
                </div>
              }
            </div>
          </p-card>

          <!-- Lap Times Scoreboard -->
          @if (scoreboardPlayers().length > 0) {
            <p-card>
              <p-table [value]="scoreboardPlayers()" styleClass="p-datatable-sm p-datatable-gridlines">
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
                      @if (player.position === 1) { <span>🥇</span> }
                      @else if (player.position === 2) { <span>🥈</span> }
                      @else if (player.position === 3) { <span>🥉</span> }
                      @else { {{ player.position }} }
                    </td>
                    <td>
                      <strong>{{ player.player_name }}</strong>
                      @if (player.finished) {
                        <p-tag value="Done" severity="success" styleClass="ml-1"></p-tag>
                      }
                    </td>
                    @for (qn of questionNumbers(); track qn) {
                      <td class="text-center">
                        @if (player.answers.has(qn)) {
                          @if (player.answers.get(qn); as ans) {
                            <div>
                              @if (ans.is_correct) {
                                <i class="pi pi-check-circle text-green-500"></i>
                              } @else {
                                <i class="pi pi-times-circle text-red-500"></i>
                              }
                              <div class="text-xs" [class.text-green-600]="ans.is_correct" [class.text-600]="!ans.is_correct">
                                {{ formatLapTime(ans.lap_time) }}
                              </div>
                              @if (!ans.is_correct && ans.penalty > 0) {
                                <div class="text-xs text-red-400">+{{ ans.penalty / 1000 }}s</div>
                              }
                            </div>
                          }
                        }
                      </td>
                    }
                    <td class="font-bold">{{ formatTime(player.total_time) }}</td>
                  </tr>
                </ng-template>
              </p-table>
            </p-card>
          }

          <!-- Chat + Actions -->
          <p-card [header]="t('multiplayer.lobby.chat')">
            <div class="surface-50 border-round p-2 mb-2 flex flex-column gap-1" style="height: 200px; overflow-y: auto;">
              @for (msg of chatMessages(); track msg.time) {
                <div class="text-sm"><strong>{{ msg.sender }}:</strong> {{ msg.text }}</div>
              }
            </div>
            <div class="flex gap-2 mb-3">
              <input pInputText [(ngModel)]="chatInput" [placeholder]="t('multiplayer.lobby.typeMessage')"
                class="flex-1" (keyup.enter)="sendChat()" [maxlength]="200" />
              <p-button icon="pi pi-send" (onClick)="sendChat()" [disabled]="!chatInput.trim()"></p-button>
            </div>

            <div class="flex gap-2 flex-wrap">
              @if (isHost()) {
                <p-button [label]="t('multiplayer.results.restartGame')" icon="pi pi-refresh"
                  (onClick)="restartGame()" [loading]="restarting()"></p-button>
                <p-button [label]="t('multiplayer.lobby.end')" icon="pi pi-stop" severity="danger"
                  [text]="true" (onClick)="endGame()"></p-button>
              } @else {
                <p-button [label]="t('common.back')" icon="pi pi-arrow-left" severity="secondary"
                  (onClick)="backToMenu()"></p-button>
              }
            </div>
          </p-card>
        </div>
      </div>
    </ng-container>
  `,
})
export class GameResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ws = inject(MultiplayerWsService);
  private mpService = inject(MultiplayerService);
  private auth = inject(AuthService);
  private messageService = inject(MessageService);

  gameCode = '';
  results = signal<GameResult[]>([]);
  chatMessages = signal<ChatMessage[]>([]);
  isHost = signal(false);
  restarting = signal(false);
  totalQuestions = signal(5);
  chatInput = '';

  // Game config for restart
  private gameConfig: any = null;
  private dbChatLoaded = false;

  podium = signal<GameResult[]>([]);
  scoreboardPlayers = signal<ScoreboardPlayer[]>([]);
  questionNumbers = signal<number[]>([]);

  ngOnInit() {
    this.gameCode = this.route.snapshot.paramMap.get('code') || '';

    // Load results from cached WS payload
    const cached = this.ws.lastGameCompleted();
    if (cached?.results?.length) {
      const sorted = [...cached.results].sort((a: GameResult, b: GameResult) => a.position - b.position);
      this.results.set(sorted);
      this.podium.set(sorted.slice(0, 3));
      // Infer total questions from winner's correct+wrong
      if (sorted.length > 0) {
        this.totalQuestions.set(sorted[0].correct_count + sorted[0].wrong_count);
      }
    }

    // Load game details for host check + restart config
    this.mpService.getGame(this.gameCode).subscribe({
      next: (detail) => {
        const userId = this.auth.currentUser()?.id;
        this.isHost.set(detail.game.host_user_id === userId);
        this.gameConfig = detail.game;
        this.totalQuestions.set(detail.game.total_questions);
      },
      error: () => {},
    });

    // Load full history detail for lap times scoreboard + chat history
    this.mpService.getHistoryDetail(this.gameCode).subscribe({
      next: (detail) => {
        const questions = detail.questions || [];
        const answers = detail.answers || [];
        const players = detail.players || [];

        // Set question numbers
        const qNums = questions.map((_: any, i: number) => i + 1);
        this.questionNumbers.set(qNums);
        this.totalQuestions.set(questions.length);

        // Build scoreboard: map answers to players
        const playerMap = new Map<string, ScoreboardPlayer>();
        for (const p of players) {
          playerMap.set(p.id, {
            player_id: p.id,
            player_name: p.user_name || 'Player',
            position: p.final_position || 0,
            total_time: p.total_time_ms || 0,
            finished: !!p.finished_at,
            answers: new Map(),
          });
        }

        // Map each answer to the question position (1-based)
        const questionIdToPos = new Map<string, number>();
        for (let i = 0; i < questions.length; i++) {
          questionIdToPos.set(questions[i].id, i + 1);
        }

        for (const ans of answers) {
          const player = playerMap.get(ans.player_id);
          const qPos = questionIdToPos.get(ans.question_id);
          if (player && qPos) {
            player.answers.set(qPos, {
              is_correct: ans.is_correct,
              lap_time: ans.lap_time_ms,
              penalty: ans.penalty_ms,
            });
          }
        }

        // Sort by position
        const board = Array.from(playerMap.values())
          .sort((a, b) => (a.position || 999) - (b.position || 999));
        this.scoreboardPlayers.set(board);

        // Load chat history from DB (normalize field names: DB uses user_name/message/sent_at, WS uses sender/text/time)
        // DB is the single source of truth for all historical messages
        if (detail.chat?.length) {
          console.log('[RESULTS] Raw chat[0] keys:', Object.keys(detail.chat[0]), 'values:', JSON.stringify(detail.chat[0]));
          const dbMessages: ChatMessage[] = detail.chat.map((c: any) => ({
            sender: c['sender'] || c['user_name'] || 'Player',
            text: c['text'] || c['message'] || '',
            time: c['time'] || c['sent_at'] || '',
            sender_id: c['sender_id'] || c['user_id'],
          }));
          console.log('[RESULTS] Normalized chat[0]:', JSON.stringify(dbMessages[0]));
          console.log('[RESULTS] Total DB chat messages:', dbMessages.length);
          this.dbChatLoaded = true;
          this.chatMessages.set(dbMessages);
        }

        // Update podium from DB data if we didn't get WS cache
        if (this.results().length === 0 && board.length > 0) {
          const dbResults: GameResult[] = board.map((p) => ({
            player_id: p.player_id,
            name: p.player_name,
            position: p.position,
            correct_count: Array.from(p.answers.values()).filter((a) => a.is_correct).length,
            wrong_count: Array.from(p.answers.values()).filter((a) => !a.is_correct).length,
            total_time_ms: p.total_time,
            penalty_time_ms: Array.from(p.answers.values()).reduce((sum, a) => sum + (a.penalty || 0), 0),
          }));
          this.results.set(dbResults);
          this.podium.set(dbResults.slice(0, 3));
        }
      },
      error: (err) => {
        console.warn('[RESULTS] Failed to load history detail:', err);
      },
    });

    // Listen for NEW chat messages via WS (only append messages that arrive after DB load)
    this.ws.onMessage('chat_broadcast').subscribe((msg) => {
      this.chatMessages.update((list) => {
        // Deduplicate by matching sender+text (DB uses different field names but we normalize above)
        if (list.some((m) => m.sender === msg.sender && m.text === msg.text)) return list;
        return [...list, msg];
      });
    });

    // If host ends game, navigate away
    this.ws.onMessage('game_ended').subscribe(() => {
      this.ws.disconnect();
      this.router.navigate(['/multiplayer']);
    });
  }

  sendChat() {
    const text = this.chatInput.trim();
    if (!text) return;
    this.ws.send('chat_message', { text });
    this.chatInput = '';
  }

  endGame() {
    this.ws.send('end_game', {});
    this.ws.disconnect();
    this.router.navigate(['/multiplayer']);
  }

  restartGame() {
    if (!this.gameConfig) return;
    this.restarting.set(true);

    this.mpService.createGame({
      quizTypeCode: this.gameConfig.quiz_type_code || this.gameConfig.quiz_type_id,
      difficulty: this.gameConfig.difficulty,
      totalQuestions: this.gameConfig.total_questions,
      penaltySeconds: this.gameConfig.penalty_seconds,
      minPlayers: this.gameConfig.min_players,
      maxPlayers: this.gameConfig.max_players,
    }).subscribe({
      next: (resp) => {
        // End current game first
        this.ws.send('end_game', {});
        this.ws.disconnect();
        // Navigate to new lobby
        this.router.navigate(['/multiplayer/lobby', resp.gameCode]);
      },
      error: (err) => {
        this.restarting.set(false);
        this.messageService.add({
          severity: 'error', summary: 'Error',
          detail: err.error?.detail || 'Failed to create game',
        });
      },
    });
  }

  backToMenu() {
    this.ws.disconnect();
    this.router.navigate(['/multiplayer']);
  }

  formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  }

  formatLapTime(ms: number): string {
    if (ms == null) return '';
    const sec = (ms / 1000).toFixed(1);
    return `${sec}s`;
  }
}
