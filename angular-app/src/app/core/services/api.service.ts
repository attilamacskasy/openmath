import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { QuizType } from '../../models/quiz-type.model';
import {
  StudentListItem,
  StudentProfile,
  UpdateStudentRequest,
} from '../../models/student.model';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  SessionDetail,
  SessionListItem,
} from '../../models/session.model';
import {
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../../models/answer.model';
import { DatabaseStats } from '../../models/stats.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  // ── Quiz Types ──────────────────────────────────────────
  getQuizTypes(): Observable<QuizType[]> {
    return this.http.get<QuizType[]>(`${this.baseUrl}/quiz-types`);
  }

  // ── Students ────────────────────────────────────────────
  getStudents(): Observable<StudentListItem[]> {
    return this.http.get<StudentListItem[]>(`${this.baseUrl}/students`);
  }

  getStudent(id: string): Observable<StudentProfile> {
    return this.http.get<StudentProfile>(`${this.baseUrl}/students/${id}`);
  }

  updateStudent(
    id: string,
    payload: UpdateStudentRequest
  ): Observable<Record<string, any>> {
    return this.http.patch(`${this.baseUrl}/students/${id}`, payload);
  }

  // ── Sessions ────────────────────────────────────────────
  createSession(
    payload: CreateSessionRequest
  ): Observable<CreateSessionResponse> {
    return this.http.post<CreateSessionResponse>(
      `${this.baseUrl}/sessions`,
      payload
    );
  }

  getSessions(): Observable<SessionListItem[]> {
    return this.http.get<SessionListItem[]>(`${this.baseUrl}/sessions`);
  }

  getSession(id: string): Observable<SessionDetail> {
    return this.http.get<SessionDetail>(`${this.baseUrl}/sessions/${id}`);
  }

  // ── Answers ─────────────────────────────────────────────
  submitAnswer(payload: SubmitAnswerRequest): Observable<SubmitAnswerResponse> {
    return this.http.post<SubmitAnswerResponse>(
      `${this.baseUrl}/answers`,
      payload
    );
  }

  // ── Stats ───────────────────────────────────────────────
  getStats(): Observable<DatabaseStats> {
    return this.http.get<DatabaseStats>(`${this.baseUrl}/stats`);
  }

  getTableRows(table: string): Observable<{ table: string; rows: any[] }> {
    return this.http.get<{ table: string; rows: any[] }>(
      `${this.baseUrl}/stats/${table}`
    );
  }

  resetData(confirmation: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.baseUrl}/stats/reset`,
      { confirmation }
    );
  }
}
