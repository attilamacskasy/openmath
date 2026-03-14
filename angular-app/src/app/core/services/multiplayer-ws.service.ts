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

  readonly connected = signal(false);

  connect(gameCode: string): void {
    this.disconnect();

    const token = this.auth.getToken();
    if (!token) return;

    const wsBase = environment.wsUrl || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
    const ws = new WebSocket(`${wsBase}/ws/game/${gameCode}?token=${token}`);

    ws.onopen = () => this.connected.set(true);

    ws.onmessage = (event) => {
      try {
        const msg: GameMessage = JSON.parse(event.data);
        this.messages$.next(msg);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      this.connected.set(false);
      this.socket.set(null);
    };

    ws.onerror = () => {
      this.connected.set(false);
    };

    this.socket.set(ws);
  }

  send(type: string, payload: any = {}): void {
    const ws = this.socket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }));
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

  disconnect(): void {
    const ws = this.socket();
    if (ws) {
      ws.close();
      this.socket.set(null);
      this.connected.set(false);
    }
  }
}
