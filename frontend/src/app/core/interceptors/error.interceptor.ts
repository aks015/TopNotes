import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';

/**
 * Global HTTP error handling:
 *  - 401 (expired/invalid access token) → try a one-shot refresh via the refresh
 *    token, then replay the original request. If the refresh fails, the session
 *    is over → toast + logout.
 *  - 403 → permission toast (genuine role denial; backend now returns 401 for
 *    auth failures, so 403 really means "forbidden").
 *  - 0   → network toast
 *  - 5xx → generic server toast
 * 4xx validation (400/422) is left to the calling component; the error is always re-thrown.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);

  // /auth/* (login, register, refresh) own their flow; the silent calls below
  // must never toast or force-logout on a transient failure.
  const isAuthEndpoint = req.url.includes('/auth/');
  const isSilentCall = isAuthEndpoint || req.url.includes('/profile/refresh-token');
  const alreadyRetried = req.headers.has('X-Retry');

  const sessionOver = (err: HttpErrorResponse) => {
    if (!isSilentCall) toast.error('Your session expired — please log in again.');
    auth.logout();
    return throwError(() => err);
  };

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Access token expired/invalid → refresh once, then replay the request.
      if (err.status === 401 && !isAuthEndpoint && !alreadyRetried) {
        return auth.refreshAccessToken().pipe(
          switchMap((token) => {
            if (!token) return sessionOver(err);
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${token}`, 'X-Retry': '1' },
            });
            return next(retried).pipe(
              catchError((retryErr: HttpErrorResponse) =>
                retryErr.status === 401 ? sessionOver(retryErr) : throwError(() => retryErr),
              ),
            );
          }),
        );
      }

      if (!isSilentCall) {
        if (err.status === 401) {
          toast.error('Your session expired — please log in again.');
          auth.logout();
        } else if (err.status === 403) {
          toast.error("You don't have permission to do that.");
        } else if (err.status === 0) {
          toast.error('Network error — check your connection.');
        } else if (err.status >= 500) {
          toast.error('Something went wrong on our end. Please try again.');
        }
      }
      return throwError(() => err);
    }),
  );
};
