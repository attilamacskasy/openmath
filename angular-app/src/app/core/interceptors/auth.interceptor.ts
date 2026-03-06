import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  // Don't attach token to auth/refresh or auth/login (avoid loops)
  const isAuthUrl = req.url.includes('/auth/login') ||
                    req.url.includes('/auth/register') ||
                    req.url.includes('/auth/refresh') ||
                    req.url.includes('/auth/google');

  let request = req;
  if (token && !isAuthUrl) {
    request = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthUrl) {
        // Try refresh
        return authService.refreshToken().pipe(
          switchMap((res) => {
            if (res) {
              const newReq = req.clone({
                setHeaders: { Authorization: `Bearer ${res.accessToken}` },
              });
              return next(newReq);
            }
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
