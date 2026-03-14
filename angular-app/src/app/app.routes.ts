import { Routes } from '@angular/router';
import { authGuard, adminGuard, teacherGuard, parentGuard } from './core/guards/auth.guard';

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

  // User routes (authenticated)
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
    path: 'history/user/:userId',
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

  // Multiplayer routes
  {
    path: 'multiplayer',
    loadComponent: () =>
      import('./features/multiplayer/multiplayer-menu.component').then(
        (m) => m.MultiplayerMenuComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'multiplayer/create',
    loadComponent: () =>
      import('./features/multiplayer/create-game.component').then(
        (m) => m.CreateGameComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'multiplayer/join',
    loadComponent: () =>
      import('./features/multiplayer/join-game.component').then(
        (m) => m.JoinGameComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'multiplayer/lobby/:code',
    loadComponent: () =>
      import('./features/multiplayer/lobby.component').then(
        (m) => m.LobbyComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'multiplayer/play/:code',
    loadComponent: () =>
      import('./features/multiplayer/multiplayer-quiz.component').then(
        (m) => m.MultiplayerQuizComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'multiplayer/dashboard/:code',
    loadComponent: () =>
      import('./features/multiplayer/host-dashboard.component').then(
        (m) => m.HostDashboardComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'multiplayer/history',
    loadComponent: () =>
      import('./features/multiplayer/history-list.component').then(
        (m) => m.MultiplayerHistoryListComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'multiplayer/history/:code',
    loadComponent: () =>
      import('./features/multiplayer/history-detail.component').then(
        (m) => m.MultiplayerHistoryDetailComponent
      ),
    canActivate: [authGuard],
  },

  // Teacher routes
  {
    path: 'teacher',
    loadComponent: () =>
      import('./features/teacher/teacher-dashboard.component').then(
        (m) => m.TeacherDashboardComponent
      ),
    canActivate: [authGuard, teacherGuard],
  },

  // Parent routes
  {
    path: 'parent',
    loadComponent: () =>
      import('./features/parent/parent-dashboard.component').then(
        (m) => m.ParentDashboardComponent
      ),
    canActivate: [authGuard, parentGuard],
  },

  // Admin routes
  {
    path: 'users',
    loadComponent: () =>
      import('./features/user-admin/user-admin.component').then(
        (m) => m.UserAdminComponent
      ),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'admin/quiz-types',
    loadComponent: () =>
      import('./features/quiz-type-editor/quiz-type-editor.component').then(
        (m) => m.QuizTypeEditorComponent
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
