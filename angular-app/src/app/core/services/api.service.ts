import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  QuizType,
  QuizTypeCreate,
  QuizTypeUpdate,
  PreviewQuestion,
} from '../../models/quiz-type.model';
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
import { AdminCreateStudentRequest } from '../../models/auth.model';

export interface QuizTypesResponse {
  types: QuizType[];
  categories: string[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  // ── Quiz Types (public) ─────────────────────────────────
  getQuizTypes(age?: number, category?: string): Observable<QuizTypesResponse> {
    let params = new HttpParams();
    if (age != null) params = params.set('age', age.toString());
    if (category) params = params.set('category', category);
    return this.http.get<QuizTypesResponse>(`${this.baseUrl}/quiz-types`, { params });
  }

  previewByTemplate(templateKind: string, answerType: string, quizTypeCode: string = ''): Observable<PreviewQuestion[]> {
    return this.http.post<PreviewQuestion[]>(`${this.baseUrl}/quiz-types/preview`, {
      template_kind: templateKind,
      answer_type: answerType,
      quiz_type_code: quizTypeCode,
    });
  }

  // ── Quiz Types (admin) ──────────────────────────────────
  getAdminQuizTypes(): Observable<QuizType[]> {
    return this.http.get<QuizType[]>(`${this.baseUrl}/admin/quiz-types`);
  }

  getAdminQuizType(id: string): Observable<QuizType> {
    return this.http.get<QuizType>(`${this.baseUrl}/admin/quiz-types/${id}`);
  }

  createQuizType(data: QuizTypeCreate): Observable<QuizType> {
    return this.http.post<QuizType>(`${this.baseUrl}/admin/quiz-types`, data);
  }

  updateQuizType(id: string, data: QuizTypeUpdate): Observable<QuizType> {
    return this.http.patch<QuizType>(`${this.baseUrl}/admin/quiz-types/${id}`, data);
  }

  deleteQuizType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/quiz-types/${id}`);
  }

  previewQuizType(id: string): Observable<PreviewQuestion[]> {
    return this.http.post<PreviewQuestion[]>(`${this.baseUrl}/admin/quiz-types/${id}/preview`, {});
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

  createStudent(payload: AdminCreateStudentRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/students`, payload);
  }

  resetStudentPassword(studentId: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/students/${studentId}/reset-password`, { password });
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

  deleteSession(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/sessions/${id}`);
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
