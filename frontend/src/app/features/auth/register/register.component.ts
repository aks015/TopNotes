import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '../ui/auth-shell.component';
import { TextFieldComponent } from '@ui/text-field/text-field.component';
import { ButtonComponent } from '@ui/button/button.component';
import { EmailVerifyComponent } from '@ui/email-verify/email-verify.component';
import { ConsentDialogService } from '@core/services/consent-dialog.service';

const STRENGTH = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const p = group.get('password')?.value;
  const c = group.get('confirm')?.value;
  return c && p !== c ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AuthShellComponent,
    TextFieldComponent,
    ButtonComponent,
    EmailVerifyComponent,
  ],
  styleUrls: ['../auth.css'],
  template: `
    <app-auth-shell>
      <div card>
        @if (step() === 1) {
          <div class="kicker">takes under a minute</div>
          <div class="card-head">
            <h1>Create your account</h1>
            <p>One account to buy notes — and to sell yours whenever you're ready.</p>
          </div>

          @if (sellerIntent) {
            <div class="seller-note" role="note">
              <span class="shield" aria-hidden="true">⛨</span>
              <div>
                After signing up we'll start your seller setup — qualify per exam category (a short test + marksheet
                review) before you can publish.
              </div>
            </div>
          }

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
              label="Full name"
              formControlName="fullName"
              placeholder="e.g. Aarav Sharma"
              autocomplete="name"
              [autoFocus]="true"
              [invalid]="invalid('fullName')"
              error="Please enter your full name."
            />

            <app-text-field
              label="Email"
              type="email"
              formControlName="email"
              placeholder="you@example.com"
              autocomplete="email"
              [invalid]="invalid('email')"
              [error]="emailError()"
            />

            <app-text-field
              label="Phone (optional)"
              type="tel"
              formControlName="phone"
              placeholder="10-digit mobile"
              autocomplete="tel"
              inputmode="numeric"
              [maxlength]="10"
              [invalid]="invalid('phone')"
              [error]="phoneError()"
            />

            <div class="pw-grid">
              <app-text-field
                label="Password"
                type="password"
                toggleMode="text"
                formControlName="password"
                placeholder="Create one"
                autocomplete="new-password"
                [invalid]="invalid('password')"
                error="At least 8 characters."
              />

              <app-text-field
                label="Confirm"
                type="password"
                toggleMode="text"
                formControlName="confirm"
                placeholder="Re-enter it"
                autocomplete="new-password"
                [invalid]="invalidConfirm()"
                [error]="confirmError()"
              />
            </div>

            @if (password()) {
              <div class="strength" [attr.data-level]="strength()">
                <div class="strength-bars"><i></i><i></i><i></i><i></i></div>
                <div class="strength-row">
                  <span class="strength-label">{{ strengthLabel() }}</span>
                  <span>{{ strength() >= 3 ? 'Looks great' : 'Use 8+ chars with a number & symbol' }}</span>
                </div>
              </div>
            }

            <app-button type="submit" size="lg" [block]="true" [loading]="loading()">Create account</app-button>
          </form>

          <p class="signup" style="margin-top:18px">
            Already have an account? <a class="link" routerLink="/login">Log in</a>
          </p>
          <p class="legal">
            By creating an account you agree to our <a routerLink="/terms">Terms</a> &amp;
            <a routerLink="/privacy">Privacy Policy</a>.
          </p>
        }

        @if (step() === 2) {
          <div class="kicker">almost there</div>
          <div class="card-head">
            <h1>Verify your email</h1>
            <p>
              Confirm <strong>{{ submittedEmail() }}</strong> to secure your account.
            </p>
          </div>

          <app-email-verify [email]="submittedEmail()" [autoSend]="true" (verified)="finish()">
            <button ev-extra type="button" class="link" (click)="skip()">I’ll verify later</button>
          </app-email-verify>

          @if (sellerIntent) {
            <p class="legal">Email verification is required before you can take the seller qualification test.</p>
          }
        }
      </div>
    </app-auth-shell>
  `,
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private consent = inject(ConsentDialogService);
  private destroyRef = inject(DestroyRef);

  protected step = signal<1 | 2>(1);

  /**
   * True when the user arrived via a "Become a seller" CTA. We still create a
   * plain buyer account, then upgrade to seller after email verification —
   * keeping signup itself dead simple. (`role=seller` kept for back-compat.)
   */
  protected readonly sellerIntent = (() => {
    const q = this.route.snapshot.queryParamMap;
    return q.get('intent') === 'sell' || q.get('role') === 'seller';
  })();

  protected loading = signal(false);
  protected errorMsg = signal<string | null>(null);
  protected submittedEmail = signal('');

  protected form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      // Optional for everyone at signup; collected/used later for payouts.
      phone: ['', [Validators.pattern(/^[6-9]\d{9}$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected strength = computed(() => this.score(this.password()));
  protected strengthLabel = computed(() => STRENGTH[this.strength()]);

  protected invalid(name: 'fullName' | 'email' | 'phone' | 'password'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }
  protected phoneError(): string {
    return this.form.get('phone')?.hasError('pattern') ? 'Enter a valid 10-digit mobile number.' : '';
  }
  protected invalidConfirm(): boolean {
    const c = this.form.get('confirm');
    return !!c && c.touched && (c.invalid || this.form.hasError('mismatch'));
  }
  protected emailError(): string {
    const c = this.form.get('email');
    if (c?.hasError('required')) return 'Email is required.';
    if (c?.hasError('email')) return 'Enter a valid email address.';
    return '';
  }
  protected confirmError(): string {
    const c = this.form.get('confirm');
    if (c?.hasError('required')) return 'Please confirm your password.';
    if (this.form.hasError('mismatch')) return "Passwords don't match.";
    return '';
  }

  private score(v: string): number {
    if (!v) return 0;
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    if (v.length >= 12 && s >= 3) s = 4;
    return Math.min(s, 4);
  }

  protected submit(): void {
    this.errorMsg.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const raw = this.form.getRawValue();
    const fullName = raw.fullName.trim();
    const email = raw.email.trim().toLowerCase();
    const phone = raw.phone.trim();

    // Everyone signs up as a buyer; phone is sent only when provided.
    const body = { fullName, email, password: raw.password, ...(phone ? { phone } : {}) };

    this.auth
      .register(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          // Account created + session active → move to email verification
          // (the verify panel auto-sends the first code).
          this.submittedEmail.set(email);
          this.step.set(2);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMsg.set(err?.error?.message ?? 'Could not create your account. Please try again.');
        },
      });
  }

  /** Let users (especially buyers) proceed and verify later. */
  protected skip(): void {
    this.finish();
  }

  /**
   * Route onward after signup. Seller-intent users are upgraded to a seller here
   * (the single "become a seller" path) and dropped into qualification; everyone
   * else lands on the marketplace.
   */
  protected async finish(): Promise<void> {
    if (this.sellerIntent) {
      // Becoming a seller requires accepting the Seller Agreement.
      const accepted = await this.consent.require('SELLER_AGREEMENT');
      if (!accepted) {
        this.router.navigate(['/browse']);
        return;
      }
      this.auth
        .becomeSeller()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.router.navigate(['/seller/qualifications']),
          // Upgrade failed — they can retry from the account page.
          error: () => this.router.navigate(['/account']),
        });
      return;
    }
    this.router.navigate(['/browse']);
  }
}
