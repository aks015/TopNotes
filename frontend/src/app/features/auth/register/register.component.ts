import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AuthShellComponent } from '../ui/auth-shell.component';
import { TextFieldComponent } from '@ui/text-field/text-field.component';
import { ButtonComponent } from '@ui/button/button.component';

type Role = 'student' | 'seller';

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
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, TextFieldComponent, ButtonComponent],
  styleUrls: ['../auth.css'],
  template: `
    <app-auth-shell>
      <div card>
        <div class="steps" aria-hidden="true">
          <span class="step" [class.on]="step() === 1" [class.done]="step() === 2">
            <span class="dot">{{ step() === 2 ? '✓' : '1' }}</span>
            <span class="lbl">Choose role</span>
          </span>
          <span class="seg" [class.on]="step() === 2"></span>
          <span class="step" [class.on]="step() === 2">
            <span class="dot">2</span>
            <span class="lbl">Your details</span>
          </span>
        </div>

        @if (step() === 1) {
          <div class="kicker">takes under a minute</div>
          <div class="card-head">
            <h1>Create your account</h1>
            <p>First, tell us how you'll use TopNotes.</p>
          </div>

          <div class="roles" role="radiogroup" aria-label="Account type" (keydown.enter)="role() && step.set(2)">
            <label class="role student">
              <input
                type="radio"
                name="role"
                value="student"
                [checked]="role() === 'student'"
                (change)="role.set('student')"
              />
              <span class="role-ic" aria-hidden="true">S</span>
              <span class="role-txt">
                <h3>I'm a Student <small>(Buyer)</small></h3>
                <p>Browse and buy verified notes to ace your exams.</p>
              </span>
              <span class="role-check" aria-hidden="true">✓</span>
            </label>

            <label class="role seller">
              <input
                type="radio"
                name="role"
                value="seller"
                [checked]="role() === 'seller'"
                (change)="role.set('seller')"
              />
              <span class="role-ic" aria-hidden="true">T</span>
              <span class="role-txt">
                <h3>I'm a Topper <small>(Seller)</small></h3>
                <p>Upload your handwritten notes and earn from your rank.</p>
              </span>
              <span class="role-check" aria-hidden="true">✓</span>
            </label>
          </div>

          <div class="continue-wrap" [class.idle]="!role()" style="margin-top:24px">
            <app-button size="lg" [block]="true" [disabled]="!role()" (clicked)="step.set(2)">Continue</app-button>
          </div>
          <p class="signup" style="margin-top:24px">
            Already have an account? <a class="link" routerLink="/login">Log in</a>
          </p>
        }

        @if (step() === 2) {
          <button type="button" class="back-btn" (click)="step.set(1)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 3 5 8l5 5"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Back
          </button>

          <div class="card-head" style="margin-top:12px">
            <h1>Your details</h1>
            <p>Set up your {{ role() === 'seller' ? 'seller' : 'student' }} credentials.</p>
          </div>

          <div class="role-pill" [class.seller]="role() === 'seller'">
            <span class="mini" aria-hidden="true">✓</span>
            {{ role() === 'seller' ? 'Topper (Seller) account' : 'Student (Buyer) account' }}
          </div>

          @if (role() === 'seller') {
            <div class="seller-note" role="note">
              <span class="shield" aria-hidden="true">⛨</span>
              <div>
                To publish, you’ll qualify per exam category — pass a short test and upload your marksheet for admin review.
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
              label="Phone"
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

          <p class="legal">
            By creating an account you agree to our <a routerLink="/terms">Terms</a> &amp;
            <a routerLink="/privacy">Privacy Policy</a>.
          </p>
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
  private destroyRef = inject(DestroyRef);

  protected step = signal<1 | 2>(1);
  protected role = signal<Role | null>(null);

  constructor() {
    // Deep-link from "Become a seller" pre-selects the role and jumps straight
    // to the details step (the user already declared intent).
    const r = this.route.snapshot.queryParamMap.get('role');
    if (r === 'seller' || r === 'student') {
      this.role.set(r);
      this.step.set(2);
    }
  }
  protected loading = signal(false);
  protected errorMsg = signal<string | null>(null);

  protected form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
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
    const c = this.form.get('phone');
    if (c?.hasError('required')) return 'Phone number is required.';
    if (c?.hasError('pattern')) return 'Enter a valid 10-digit mobile number.';
    return '';
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
    const role = this.role() === 'seller' ? 'SELLER' : 'BUYER';

    this.auth
      .register({ fullName, email, phone, password: raw.password, role })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate([role === 'SELLER' ? '/seller/qualifications' : '/browse']);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMsg.set(err?.error?.message ?? 'Could not create your account. Please try again.');
        },
      });
  }
}
