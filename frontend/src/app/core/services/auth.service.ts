import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { environment } from '@env/environment';
import { AuthResponse, ApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'tn_token';
  private readonly REFRESH_KEY = 'tn_refresh';
  private readonly USER_KEY = 'tn_user';

  /** Shared in-flight refresh so concurrent 401s trigger only one /auth/refresh. */
  private refresh$?: Observable<string | null>;

  private _user = signal<AuthResponse | null>(this.loadStored());

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');
  readonly isSeller = computed(() => this._user()?.role === 'SELLER');
  readonly isBuyer = computed(() => this._user()?.role === 'BUYER');
  readonly isVerified = computed(() => !!this._user()?.isVerified);
  /** Whether the signed-in user has confirmed their email via OTP. */
  readonly emailVerified = computed(() => !!this._user()?.emailVerified);

  // ── Capabilities (a user can both buy and sell) ───────────────
  /** Any logged-in non-admin can browse and buy notes. */
  readonly canBuy = computed(() => this.isLoggedIn() && !this.isAdmin());
  /** Sellers can sell (publishing still requires verification). */
  readonly canSell = computed(() => this.isSeller());

  /**
   * Where the landing's "Go to app" button takes a user: the marketplace
   * (Browse) for buyers & sellers — the seller console is one click away in the
   * nav — and the admin console for admins. Single source of truth; don't
   * re-derive per-role home elsewhere.
   */
  readonly homeLink = computed(() => (this.isAdmin() ? '/admin/dashboard' : '/browse'));

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  register(body: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/register`, body).pipe(
      tap((r) => {
        if (r.success) this.persist(r.data);
      }),
    );
  }

  login(email: string, password: string): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap((r) => {
        if (r.success) this.persist(r.data);
      }),
    );
  }

  /**
   * Upgrade the current buyer into a seller. The backend re-issues a JWT with
   * the SELLER role, which we persist so seller features unlock immediately.
   * Buying ability is retained.
   */
  becomeSeller(): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/profile/become-seller`, {}).pipe(
      tap((r) => {
        if (r.success) this.persist(r.data);
      }),
    );
  }

  /**
   * Email verification (OTP). Both endpoints require the caller to be logged in;
   * the JWT issued at registration is already persisted, so the interceptor
   * attaches it automatically.
   */
  sendEmailOtp(): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/auth/email/send`, {});
  }

  /** Verify the 6-digit code; on success the refreshed session (emailVerified=true) is persisted. */
  verifyEmailOtp(code: string): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/email/verify`, { code }).pipe(
      tap((r) => {
        if (r.success) this.persist(r.data);
      }),
    );
  }

  /**
   * Silently re-issue the JWT from the server so locally-cached fields
   * (esp. isVerified after an admin approval) stay fresh — no re-login needed.
   * Fails quietly; the error interceptor still handles a genuinely expired token.
   */
  refreshSession(): void {
    if (!this.isLoggedIn()) return;
    this.http.post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/profile/refresh-token`, {}).subscribe({
      next: (r) => {
        if (r.success) this.persist(r.data);
      },
      error: () => {},
    });
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._user.set(null);
    this.router.navigate(['/']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  /**
   * Exchange the stored refresh token for a fresh access token. Resolves to the
   * new access token, or null if there's no refresh token / it was rejected
   * (caller should then log out). Concurrent callers share one HTTP call.
   */
  refreshAccessToken(): Observable<string | null> {
    if (this.refresh$) return this.refresh$;

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return of(null);

    this.refresh$ = this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((r) => {
          if (r.success) this.persist(r.data);
        }),
        map((r) => (r.success ? r.data.token : null)),
        catchError(() => of(null)),
        finalize(() => (this.refresh$ = undefined)),
        shareReplay(1),
      );
    return this.refresh$;
  }

  /**
   * Every user (buyer, seller, admin) lands on the public landing page after
   * login — it adapts to the logged-in state and links onward to their home via
   * the nav. First-time seller onboarding (verification) is handled by signup.
   */
  navigateAfterLogin() {
    this.router.navigate(['/']);
  }

  /** Persist a fresh AuthResponse (e.g. after a profile update) into the session. */
  applyAuth(data: AuthResponse) {
    this.persist(data);
  }

  private persist(data: AuthResponse) {
    localStorage.setItem(this.TOKEN_KEY, data.token);
    if (data.refreshToken) localStorage.setItem(this.REFRESH_KEY, data.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data));
    this._user.set(data);
  }

  private loadStored(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
