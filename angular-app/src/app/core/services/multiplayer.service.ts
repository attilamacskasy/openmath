import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateGameRequest,
  CreateGameResponse,
  GameDetail,
  HistoryDetail,
  HistoryGame,
  MultiplayerGame,
} from '../../models/multiplayer.model';

@Injectable({ providedIn: 'root' })
export class MultiplayerService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/multiplayer`;

  createGame(body: CreateGameRequest): Observable<CreateGameResponse> {
    return this.http.post<CreateGameResponse>(`${this.baseUrl}/games`, body);
  }

  listGames(): Observable<MultiplayerGame[]> {
    return this.http.get<MultiplayerGame[]>(`${this.baseUrl}/games`);
  }

  getGame(code: string): Observable<GameDetail> {
    return this.http.get<GameDetail>(`${this.baseUrl}/games/${code}`);
  }

  joinGame(code: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/games/${code}/join`, {});
  }

  leaveGame(code: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/games/${code}/leave`);
  }

  getHistory(): Observable<HistoryGame[]> {
    return this.http.get<HistoryGame[]>(`${this.baseUrl}/history`);
  }

  getHistoryDetail(code: string): Observable<HistoryDetail> {
    return this.http.get<HistoryDetail>(`${this.baseUrl}/history/${code}`);
  }

  adminListGames(): Observable<MultiplayerGame[]> {
    return this.http.get<MultiplayerGame[]>(`${this.baseUrl}/admin/games`);
  }

  adminDeleteGame(code: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/games/${code}`);
  }
}
