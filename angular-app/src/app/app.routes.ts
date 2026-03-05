import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/start/start.component').then((m) => m.StartComponent),
  },
  {
    path: 'quiz/:sessionId',
    loadComponent: () =>
      import('./features/quiz/quiz.component').then((m) => m.QuizComponent),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./features/history/history-list.component').then(
        (m) => m.HistoryListComponent
      ),
  },
  {
    path: 'history/:sessionId',
    loadComponent: () =>
      import('./features/history/session-detail.component').then(
        (m) => m.SessionDetailComponent
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then(
        (m) => m.ProfileComponent
      ),
  },
  {
    path: 'user-guide',
    loadComponent: () =>
      import('./features/user-guide/user-guide.component').then(
        (m) => m.UserGuideComponent
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then(
        (m) => m.AdminComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
