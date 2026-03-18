import { Injectable, inject, signal } from '@angular/core';
import { Subject, Observable, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { GameMessage } from '../../models/multiplayer.model';

@Injectable({ providedIn: 'root' })
export class MultiplayerWsService {
  private auth = inject(AuthService);
  private socket = signal<WebSocket | null>(null);
  private messages$ = new Subject<GameMessage>();

  /** Current connection state */
  readonly connected = signal(false);

  /** Cached game_started payload so components mounting after the event can retrieve it */
  readonly lastGameStarted = signal<any>(null);

  /** Current game code (for reconnection) */
  private currentGameCode = '';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private intentionalDisconnect = false;

  connect(gameCode: string): void {
    // If already connected to same game, don't reconnect
    const existing = this.socket();
    if (existing && existing.readyState === WebSocket.OPEN && this.currentGameCode === gameCode) {
      console.log('[WS] Already connected to', gameCode);
      return;
    }

    this.closeSocket();
    this.currentGameCode = gameCode;
    this.intentionalDisconnect = false;

    const token = this.auth.getToken();
    if (!token) {
      console.error('[WS] No auth token available');
      return;
    }

    const wsBase = environment.wsUrl || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
    const url = `${wsBase}/ws/game/${gameCode}?token=${token}`;
    console.log('[WS] Connecting to', gameCode, '(attempt', this.reconnectAttempts + 1, ')');

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WS] Connected to', gameCode);
      this.connected.set(true);
      this.reconnectAttempts = 0; // Reset on successful connection
    };

    ws.onmessage = (event) => {
      try {
        const msg: GameMessage = JSON.parse(event.data);
        console.log('[WS] \u2190', msg.type, msg.payload ? JSON.stringify(msg.payload).substring(0, 120) : '');

        // Cache game_started payload for late-mounting components
        if (msg.type === 'game_started') {
          this.lastGameStarted.set(msg.payload);
        }

        // Respond to server pings
        if (msg.type === 'ping') {
          this.send('pong', {});
          return;
        }

        this.messages$.next(msg);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed (code=' + event.code + ', reason=' + event.reason + ')');
      this.connected.set(false);
      this.socket.set(null);

      // Auto-reconnect if not intentional and game is still active
      if (!this.intentionalDisconnect && this.currentGameCode && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        console.log('[WS] Reconnecting in', delay, 'ms (attempt', this.reconnectAttempts + 1, '/' + this.maxReconnectAttempts + ')');
        this.reconnectTimer = setTimeout(() => {
          this.reconnectAttempts++;
          this.connect(this.currentGameCode);
        }, delay);
      }
    };

    ws.onerror = (event) => {
      console.error('[WS] Error', event);
      this.connected.set(false);
    };

    this.socket.set(ws);
  }

  send(type: string, payload: any = {}): void {
    const ws = this.socket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[WS] \u2192', type, JSON.stringify(payload).substring(0, 120));
      ws.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }));
    } else {
      console.warn('[WS] Cannot send', type, '- not connected (readyState=' + (ws?.readyState ?? 'null') + ')');
    }
  }

  onMessage(type: string): Observable<any> {
    return this.messages$.pipe(
      filter((msg) => msg.type === type),
      map((msg) => msg.payload),
    );
  }

  onAnyMessage(): Observable<GameMessage> {
    return this.messages$.asObservable();
  }

  /** Intentionally disconnect (user leaving game or game ended) */
  disconnect(): void {
    console.log('[WS] Intentional disconnect from', this.currentGameCode);
    this.intentionalDisconnect = true;
    this.currentGameCode = '';
    this.reconnectAttempts = 0;
    this.lastGameStarted.set(null);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
  }

  /** Close socket without clearing reconnect state */
  private closeSocket(): void {
    const ws = this.socket();
    if (ws) {
      ws.close();
      this.socket.set(null);
      this.connected.set(false);
    }
  }
}
