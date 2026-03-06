import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Public routes
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/callback.component').then(
        (m) => m.AuthCallbackComponent
      ),
  },

  // Student routes (authenticated)
  {
    path: '',
    loadComponent: () =>
      import('./features/start/start.component').then((m) => m.StartComponent),
    canActivate: [authGuard],
  },
  {
    path: 'quiz/:sessionId',
    loadComponent: () =>
      import('./features/quiz/quiz.component').then((m) => m.QuizComponent),
    canActivate: [authGuard],
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./features/history/history-list.component').then(
        (m) => m.HistoryListComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'history/:sessionId',
    loadComponent: () =>
      import('./features/history/session-detail.component').then(
        (m) => m.SessionDetailComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then(
        (m) => m.ProfileComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'user-guide',
    loadComponent: () =>
      import('./features/user-guide/user-guide.component').then(
        (m) => m.UserGuideComponent
      ),
    canActivate: [authGuard],
  },

  // Admin routes
  {
    path: 'students',
    loadComponent: () =>
      import('./features/student-admin/student-admin.component').then(
        (m) => m.StudentAdminComponent
      ),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then(
        (m) => m.AdminComponent
      ),
    canActivate: [authGuard, adminGuard],
  },

  { path: '**', redirectTo: 'login' },
];
