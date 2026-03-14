import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthUser,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  GoogleAuthRequest,
  MeResponse,
} from '../../models/auth.model';
import { LocaleService } from './locale.service';

const ACCESS_TOKEN_KEY = 'openmath_access_token';
const REFRESH_TOKEN_KEY = 'openmath_refresh_token';
const USER_KEY = 'openmath_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private localeService = inject(LocaleService);
  private baseUrl = environment.apiUrl;

  private _currentUser = signal<AuthUser | null>(null);
  private _isAuthenticated = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly isAdmin = computed(() => this._currentUser()?.roles?.includes('admin') ?? false);
  readonly isTeacher = computed(() => this._currentUser()?.roles?.includes('teacher') ?? false);
  readonly isParent = computed(() => this._currentUser()?.roles?.includes('parent') ?? false);
  readonly userRoles = computed(() => this._currentUser()?.roles ?? []);

  constructor() {
    this.loadFromStorage();
  }

  // ── Public API ──────────────────────────────────────────

  getToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/login`, { email, password })
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/register`, payload)
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  loginWithGoogle(code: string, redirectUri: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/google`, {
        code,
        redirectUri,
      } as GoogleAuthRequest)
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  refreshToken(): Observable<AuthResponse | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return of(null);
    }
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((res) => this.handleAuthResponse(res)),
        catchError(() => {
          this.logout();
          return of(null);
        })
      );
  }

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.baseUrl}/auth/me`).pipe(
      tap((me) => {
        if (me.locale) {
          this.localeService.initFromProfile(me.locale);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  // ── Internal ────────────────────────────────────────────

  private handleAuthResponse(res: AuthResponse): void {
    if (!res) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    if (res.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      this._currentUser.set(res.user);
    }
    this._isAuthenticated.set(true);
  }

  loadFromStorage(): void {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as AuthUser;
        this._currentUser.set(user);
        this._isAuthenticated.set(true);
      } catch {
        this.logout();
      }
    }
  }
}
