import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ApiResponse, AuthResponse, UserRole } from '../models';

function authResponse(role: UserRole): AuthResponse {
  return {
    token: 'tok',
    tokenType: 'Bearer',
    userId: 1,
    email: 'a@b.com',
    fullName: 'Aarav B',
    role,
    isVerified: true,
  };
}
function ok(data: AuthResponse): ApiResponse<AuthResponse> {
  return { success: true, message: 'ok', data };
}

describe('AuthService', () => {
  let http: { post: jest.Mock };
  let router: { navigate: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    http = { post: jest.fn() };
    router = { navigate: jest.fn() };
    service = new AuthService(http as unknown as HttpClient, router as unknown as Router);
  });

  it('starts logged out', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('login() persists token + user and sets role flags', () => {
    http.post.mockReturnValue(of(ok(authResponse('SELLER'))));
    service.login('a@b.com', 'pw').subscribe();

    expect(service.isLoggedIn()).toBe(true);
    expect(service.isSeller()).toBe(true);
    expect(service.isBuyer()).toBe(false);
    expect(service.isAdmin()).toBe(false);
    expect(localStorage.getItem('tn_token')).toBe('tok');
  });

  it('does not persist on an unsuccessful response', () => {
    http.post.mockReturnValue(of({ success: false, message: 'bad', data: null }));
    service.login('a', 'b').subscribe();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('logout() clears storage and navigates to the landing page', () => {
    http.post.mockReturnValue(of(ok(authResponse('BUYER'))));
    service.login('a', 'b').subscribe();

    service.logout();
    expect(service.user()).toBeNull();
    expect(localStorage.getItem('tn_token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('navigateAfterLogin() routes by role', () => {
    http.post.mockReturnValue(of(ok(authResponse('ADMIN'))));
    service.login('a', 'b').subscribe();
    service.navigateAfterLogin();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('restores the user from localStorage on construction', () => {
    localStorage.setItem('tn_user', JSON.stringify(authResponse('BUYER')));
    const restored = new AuthService(http as unknown as HttpClient, router as unknown as Router);
    expect(restored.isLoggedIn()).toBe(true);
    expect(restored.isBuyer()).toBe(true);
  });
});
