export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
  age: number | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  isNewUser?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  birthday?: string | null;
  gender?: string | null;
  learnedTimetables?: number[];
}

export interface GoogleAuthRequest {
  code: string;
  redirectUri: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AdminCreateStudentRequest {
  name: string;
  email: string;
  password: string;
  birthday?: string | null;
  gender?: string | null;
  role?: string;
  learnedTimetables?: number[];
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
  age: number | null;
  birthday: string | null;
  gender: string | null;
  authProvider: string;
  learnedTimetables: number[];
}
