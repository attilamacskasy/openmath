import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { MultiplayerService } from '../../core/services/multiplayer.service';
import { MultiplayerGame } from '../../models/multiplayer.model';

@Component({
  selector: 'app-join-game',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, InputTextModule,
    ButtonModule, TableModule, TagModule, DividerModule,
    ToastModule, TranslocoModule,
  ],
  providers: [MessageService],
  template: `
    <ng-container *transloco="let t">
      <p-toast></p-toast>
      <div class="flex justify-content-center">
        <p-card [header]="t('multiplayer.join.find')" [style]="{ 'max-width': '800px', width: '100%' }">
          <div class="flex flex-column gap-3">

            <div class="flex gap-2 align-items-end">
              <div class="flex flex-column gap-1 flex-1">
                <label class="font-semibold">{{ t('multiplayer.join.gameCode') }}</label>
                <input pInputText [(ngModel)]="gameCode" [placeholder]="'MATH-XXX'"
                  style="text-transform: uppercase;" (keyup.enter)="joinByCode()" />
              </div>
              <p-button [label]="t('multiplayer.menu.join')" icon="pi pi-sign-in"
                (onClick)="joinByCode()" [disabled]="!gameCode.trim()"></p-button>
            </div>

            <p-divider></p-divider>

            <p-table [value]="games()" [loading]="loading()" [rows]="10"
              styleClass="p-datatable-sm" [sortField]="'created_at'" [sortOrder]="-1"
              [emptyMessage]="t('multiplayer.join.noGames')">
              <ng-template pTemplate="header">
                <tr>
                  <th pSortableColumn="game_code">{{ t('multiplayer.join.code') }} <p-sortIcon field="game_code"></p-sortIcon></th>
                  <th>{{ t('quiz.quizType') }}</th>
                  <th>{{ t('quiz.difficulty') }}</th>
                  <th>{{ t('multiplayer.join.questions') }}</th>
                  <th>{{ t('multiplayer.join.players') }}</th>
                  <th></th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-game>
                <tr>
                  <td><strong>{{ game.game_code }}</strong></td>
                  <td><p-tag [value]="game.quiz_type_description || game.quiz_type_code" severity="info"></p-tag></td>
                  <td><p-tag [value]="game.difficulty" [severity]="diffSeverity(game.difficulty)"></p-tag></td>
                  <td>{{ game.total_questions }}</td>
                  <td>
                    <p-tag [value]="game.player_count + '/' + game.max_players"
                      [severity]="game.player_count >= game.max_players ? 'danger' : 'success'"></p-tag>
                  </td>
                  <td>
                    <p-button icon="pi pi-sign-in" [label]="t('multiplayer.menu.join')" size="small"
                      [disabled]="game.player_count >= game.max_players"
                      (onClick)="joinGame(game.game_code)"></p-button>
                  </td>
                </tr>
              </ng-template>
            </p-table>

            <div class="flex justify-content-between align-items-center">
              <p-button icon="pi pi-refresh" [label]="t('common.refresh')" severity="secondary"
                [text]="true" (onClick)="loadGames()"></p-button>
              <span class="text-sm text-600">{{ games().length }} {{ t('multiplayer.join.available') }}</span>
            </div>

            <p-button [label]="t('common.back')" icon="pi pi-arrow-left" severity="secondary"
              [text]="true" (onClick)="back()"></p-button>
          </div>
        </p-card>
      </div>
    </ng-container>
  `,
})
export class JoinGameComponent implements OnInit {
  private mpService = inject(MultiplayerService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private destroyRef = inject(DestroyRef);

  games = signal<MultiplayerGame[]>([]);
  loading = signal(false);
  gameCode = '';

  ngOnInit() {
    this.loadGames();
    interval(5000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadGames());
  }

  loadGames() {
    this.loading.set(true);
    this.mpService.listGames().subscribe({
      next: (g) => { this.games.set(g); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  joinByCode() {
    const code = this.gameCode.trim().toUpperCase();
    if (!code) return;
    this.joinGame(code);
  }

  joinGame(code: string) {
    this.mpService.joinGame(code).subscribe({
      next: () => this.router.navigate(['/multiplayer/lobby', code]),
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.detail || 'Failed to join game',
        });
      },
    });
  }

  diffSeverity(d: string): 'success' | 'warning' | 'danger' {
    if (d === 'low') return 'success';
    if (d === 'hard') return 'danger';
    return 'warning';
  }

  back() {
    this.router.navigate(['/multiplayer']);
  }
}
