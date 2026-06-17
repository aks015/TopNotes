import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '../ui/auth-shell.component';
import { TextFieldComponent } from '@ui/text-field/text-field.component';
import { ButtonComponent } from '@ui/button/button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, TextFieldComponent, ButtonComponent],
  styleUrls: ['../auth.css'],
  template: `
    <app-auth-shell>
      <div card>
        <div class="kicker">good to see you again</div>
        <div class="card-head">
          <h1>Welcome back</h1>
          <p>Log in to access your notes library.</p>
        </div>

        @if (errorMsg(); as msg) {
          <div class="alert" role="alert">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="8" stroke="#DC2626" stroke-width="1.6" />
              <path d="M10 6.2v4.3" stroke="#DC2626" stroke-width="1.6" stroke-linecap="round" />
              <circle cx="10" cy="13.6" r="1" fill="#DC2626" />
            </svg>
            <div>{{ msg }}</div>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-text-field
            label="Email"
            type="email"
            formControlName="email"
            placeholder="you@example.com"
            autocomplete="email"
            [autoFocus]="true"
            [invalid]="invalid('email')"
            [error]="emailError()"
          />

          <app-text-field
            label="Password"
            type="password"
            toggleMode="text"
            formControlName="password"
            placeholder="Your password"
            autocomplete="current-password"
            [invalid]="invalid('password')"
            error="Please enter your password."
          />

          <app-button type="submit" size="lg" [block]="true" [loading]="loading()">Log in</app-button>
        </form>

        <div class="divider">OR</div>
        <p class="signup">New here? <a class="link" routerLink="/register">Create account</a></p>
        <p class="legal">
          By continuing you agree to our <a routerLink="/terms">Terms</a> &amp;
          <a routerLink="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </app-auth-shell>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  protected loading = signal(false);
  protected errorMsg = signal<string | null>(null);

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected invalid(name: 'email' | 'password'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  protected emailError(): string {
    const c = this.form.get('email');
    if (c?.hasError('required')) return 'Email is required.';
    if (c?.hasError('email')) return 'Enter a valid email address.';
    return '';
  }

  protected submit(): void {
    this.errorMsg.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth
      .login(email.trim().toLowerCase(), password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.auth.navigateAfterLogin();
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMsg.set(err?.error?.message ?? 'The email or password you entered is incorrect.');
        },
      });
  }
}
