import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }
  router.navigate(['/']);
  return false;
};

export const teacherGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isTeacher() || auth.isAdmin()) return true;
  inject(Router).navigate(['/']);
  return false;
};

export const parentGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isParent() || auth.isAdmin()) return true;
  inject(Router).navigate(['/']);
  return false;
};
