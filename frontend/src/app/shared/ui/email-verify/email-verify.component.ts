import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { TextFieldComponent } from '@ui/text-field/text-field.component';
import { ButtonComponent } from '@ui/button/button.component';

/**
 * Reusable email-verification panel. Sends a 6-digit OTP, takes the code, and
 * emits `verified` on success. Used both in signup (auto-send) and on the
 * account page (manual send) so the verify flow lives in exactly one place.
 * Self-contained styling — drops into any host.
 *
 * Project a [ev-extra] element to add a trailing action (e.g. "I'll verify later").
 */
@Component({
  selector: 'app-email-verify',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TextFieldComponent, ButtonComponent],
  template: `
    @if (info(); as msg) {
      <div class="ev-info">{{ msg }}</div>
    }
    @if (error(); as msg) {
      <div class="ev-error" role="alert">{{ msg }}</div>
    }

    @if (!sent()) {
      <p class="ev-lead">
        @if (email()) {
          We’ll email a 6-digit code to <strong>{{ email() }}</strong
          >.
        } @else {
          We’ll email you a 6-digit verification code.
        }
      </p>
      <app-button size="lg" [block]="true" [loading]="sending()" (clicked)="send()">Send verification code</app-button>
    } @else {
      <form [formGroup]="form" (ngSubmit)="verify()" novalidate>
        <app-text-field
          label="Verification code"
          formControlName="code"
          placeholder="6-digit code"
          autocomplete="one-time-code"
          inputmode="numeric"
          [maxlength]="6"
          [autoFocus]="true"
          [invalid]="invalid()"
          error="Enter the 6-digit code from your email."
        />
        <app-button type="submit" size="lg" [block]="true" [loading]="verifying()">Verify email</app-button>
      </form>

      <div class="ev-actions">
        <button type="button" class="ev-link" [disabled]="resendIn() > 0 || sending()" (click)="send()">
          {{ resendIn() > 0 ? 'Resend code in ' + resendIn() + 's' : 'Resend code' }}
        </button>
        <ng-content select="[ev-extra]" />
      </div>
    }
  `,
  styles: [
    `
      .ev-lead {
        margin: 0 0 14px;
        font-size: 14px;
        line-height: 1.55;
        color: #4b4860;
      }
      .ev-info,
      .ev-error {
        font-size: 13.5px;
        line-height: 1.5;
        padding: 10px 12px;
        border-radius: 10px;
        margin-bottom: 12px;
      }
      .ev-info {
        background: #eef6ff;
        border: 1px solid #cfe4ff;
        color: #1f4e79;
      }
      .ev-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #b91c1c;
      }
      .ev-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 14px;
      }
      .ev-link {
        background: none;
        border: none;
        padding: 4px 0;
        font: inherit;
        font-weight: 600;
        color: var(--c-primary-bright, #5840e0);
        cursor: pointer;
      }
      .ev-link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class EmailVerifyComponent implements OnInit {
  /** Shown in the lead copy so the user knows where the code went. */
  email = input<string>('');
  /** Send a code immediately on init (signup flow). Default: manual send. */
  autoSend = input(false);
  /** Emitted once the email is verified and the session refreshed. */
  verified = output<void>();

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  protected sent = signal(false);
  protected sending = signal(false);
  protected verifying = signal(false);
  protected error = signal<string | null>(null);
  protected info = signal<string | null>(null);
  protected resendIn = signal(0);
  private cooldownId: ReturnType<typeof setInterval> | null = null;

  protected form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.cooldownId) clearInterval(this.cooldownId);
    });
  }

  ngOnInit(): void {
    if (this.autoSend()) this.send();
  }

  protected invalid(): boolean {
    const c = this.form.get('code');
    return !!c && c.invalid && c.touched;
  }

  protected send(): void {
    if (this.sending() || this.resendIn() > 0) return;
    this.sending.set(true);
    this.error.set(null);
    this.auth
      .sendEmailOtp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.sent.set(true);
          this.info.set('Code sent — it expires in 10 minutes.');
          this.startCooldown();
        },
        error: (err) => {
          this.sending.set(false);
          const msg = err?.error?.message ?? 'Could not send the code. Please try again.';
          // Already verified elsewhere → treat as success.
          if (/already verified/i.test(msg)) {
            this.verified.emit();
            return;
          }
          this.error.set(msg);
        },
      });
  }

  protected verify(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.verifying.set(true);
    this.auth
      .verifyEmailOtp(this.form.getRawValue().code.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.verifying.set(false);
          this.verified.emit();
        },
        error: (err) => {
          this.verifying.set(false);
          this.error.set(err?.error?.message ?? 'Verification failed. Please try again.');
        },
      });
  }

  private startCooldown(): void {
    if (this.cooldownId) clearInterval(this.cooldownId);
    this.resendIn.set(60);
    this.cooldownId = setInterval(() => {
      const next = this.resendIn() - 1;
      this.resendIn.set(Math.max(0, next));
      if (next <= 0 && this.cooldownId) {
        clearInterval(this.cooldownId);
        this.cooldownId = null;
      }
    }, 1000);
  }
}
