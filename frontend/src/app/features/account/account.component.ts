import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { TopNavComponent } from '@layout/top-nav/top-nav.component';
import { TextFieldComponent } from '@ui/text-field/text-field.component';

interface AdminLink {
  path: string;
  icon: string;
  label: string;
  desc: string;
}

/**
 * Self-service account page (role-shared). Wired to live endpoints: identity
 * (JWT), payout UPI, become-seller, and password change. For admins it doubles
 * as a console launchpad with a live "needs attention" panel.
 */
@Component({
  selector: 'app-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, TopNavComponent, DatePipe, TextFieldComponent],
  template: `
    <app-top-nav />

    <main class="ac-page">
      <!-- Profile hero -->
      <section class="ac-hero">
        <label class="ac-avatar" [class.busy]="uploadingPic()" [title]="'Change photo'">
          @if (auth.user()?.profileImageUrl) {
            <img [src]="auth.user()?.profileImageUrl" alt="" />
          } @else {
            <span class="ac-avatar-init">{{ initial() }}</span>
          }
          <span class="ac-avatar-edit">
            @if (uploadingPic()) {
              <span class="ac-spin"></span>
            } @else {
              <lucide-icon name="image" [size]="15" [strokeWidth]="2" />
            }
          </span>
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="uploadPic($event)" />
        </label>
        <div class="ac-hero-text">
          <h1>{{ auth.user()?.fullName }}</h1>
          <div class="ac-hero-meta">
            <span>{{ auth.user()?.email }}</span>
            @if (memberSince()) {
              <span class="ac-dot">·</span>
              <span>Member since {{ memberSince() | date: 'MMMM y' }}</span>
            }
          </div>
          <div class="ac-pic-actions">
            <label class="ac-pic-link">
              {{ auth.user()?.profileImageUrl ? 'Change photo' : 'Add photo' }}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="uploadPic($event)" />
            </label>
            @if (auth.user()?.profileImageUrl) {
              <span class="ac-dot">·</span>
              <button type="button" class="ac-pic-link danger" (click)="removePic()" [disabled]="uploadingPic()">Remove</button>
            }
          </div>
        </div>
        <span class="ac-role">{{ roleLabel() }}</span>
      </section>

      @if (auth.canSell() && !auth.isVerified()) {
        <div class="ac-banner warn">
          <lucide-icon name="shield-check" [size]="18" [strokeWidth]="1.8" />
          <span>Your seller account isn’t qualified yet — pass a category test to publish notes.</span>
          <a routerLink="/seller/qualifications">Get qualified →</a>
        </div>
      }

      <!-- ADMIN: needs attention -->
      @if (auth.isAdmin()) {
        <section class="ac-card">
          <div class="ac-card-h">
            <h2>Needs attention</h2>
            <span class="ac-sub">Live queues waiting on you</span>
          </div>
          <div class="ac-attn">
            <a class="ac-attn-item" [class.urgent]="pendingQuals() > 0" routerLink="/admin/verifications">
              <div class="num">{{ pendingQuals() }}</div>
              <div class="lbl">Pending approvals</div>
              <div class="go">{{ pendingQuals() > 0 ? 'Review →' : 'All clear' }}</div>
            </a>
            <a class="ac-attn-item" [class.urgent]="pendingPayouts() > 0" routerLink="/admin/payouts">
              <div class="num">{{ pendingPayouts() }}</div>
              <div class="lbl">Pending payouts</div>
              <div class="go">{{ pendingPayouts() > 0 ? 'Pay out →' : 'All clear' }}</div>
            </a>
          </div>
        </section>

        <!-- ADMIN: console launchpad -->
        <section class="ac-card">
          <div class="ac-card-h"><h2>Admin console</h2></div>
          <div class="ac-grid">
            @for (s of adminLinks; track s.path) {
              <a class="ac-tile" [routerLink]="s.path">
                <span class="tic"><lucide-icon [name]="s.icon" [size]="20" [strokeWidth]="1.8" /></span>
                <b>{{ s.label }}</b>
                <small>{{ s.desc }}</small>
              </a>
            }
          </div>
        </section>
      } @else {
        <!-- Non-admin shortcuts -->
        <section class="ac-card">
          <div class="ac-card-h"><h2>Shortcuts</h2></div>
          <div class="ac-grid">
            <a class="ac-tile" routerLink="/browse">
              <span class="tic"><lucide-icon name="search" [size]="20" [strokeWidth]="1.8" /></span>
              <b>Browse notes</b><small>Find verified notes</small>
            </a>
            <a class="ac-tile" routerLink="/my-purchases">
              <span class="tic"><lucide-icon name="shopping-bag" [size]="20" [strokeWidth]="1.8" /></span>
              <b>My purchases</b><small>Notes you own</small>
            </a>
            @if (auth.canSell()) {
              <a class="ac-tile" routerLink="/seller/dashboard">
                <span class="tic"><lucide-icon name="layout-dashboard" [size]="20" [strokeWidth]="1.8" /></span>
                <b>Seller dashboard</b><small>Sales &amp; earnings</small>
              </a>
              <a class="ac-tile" [routerLink]="['/u', auth.user()?.userId]">
                <span class="tic"><lucide-icon name="user" [size]="20" [strokeWidth]="1.8" /></span>
                <b>Public profile</b><small>How buyers see you</small>
              </a>
            }
          </div>
        </section>
      }

      <!-- Profile -->
      <section class="ac-card">
        <div class="ac-card-h"><h2>Profile</h2><span class="ac-sub">Your name &amp; contact number</span></div>
        <div class="ac-two">
          <app-text-field
            label="Full name"
            [formControl]="pName"
            autocomplete="name"
            [invalid]="ctrlInvalid(pName)"
            error="Enter your full name (at least 2 characters)."
          />
          <app-text-field
            label="Phone"
            type="tel"
            inputmode="numeric"
            [maxlength]="10"
            [formControl]="pPhone"
            autocomplete="tel"
            [invalid]="ctrlInvalid(pPhone)"
            error="Enter a valid 10-digit mobile number."
          />
        </div>
        <button class="ac-btn primary" (click)="saveProfile()" [disabled]="savingProfile() || pName.invalid || pPhone.invalid">
          {{ savingProfile() ? 'Saving…' : 'Save profile' }}
        </button>
      </section>

      <!-- Become a seller (buyers only) -->
      @if (auth.isBuyer()) {
        <section class="ac-card">
          <div class="ac-card-h"><h2>Start selling</h2></div>
          <p class="ac-muted">Turn your rank into income — upload your handwritten notes and earn from every sale.</p>
          <button class="ac-btn primary" (click)="becomeSeller()" [disabled]="upgrading()">
            <lucide-icon name="store" [size]="18" [strokeWidth]="1.8" />
            {{ upgrading() ? 'Upgrading…' : 'Become a seller' }}
          </button>
        </section>
      }

      <!-- Payout UPI (sellers only) -->
      @if (auth.canSell()) {
        <section class="ac-card">
          <div class="ac-card-h">
            <h2>Payout UPI</h2>
            @if (upiSaved()) {
              <span class="ac-chip ok"><lucide-icon name="check" [size]="13" /> Saved</span>
            } @else {
              <span class="ac-chip warn">Required to withdraw</span>
            }
          </div>
          <p class="ac-muted">
            Your earnings are paid here. Once you've earned the minimum, request a withdrawal from your
            <a routerLink="/seller/dashboard">Seller dashboard</a> — an admin then disburses it to this UPI via Cashfree.
          </p>
          <div class="ac-row">
            <input
              class="ac-input"
              type="text"
              placeholder="yourname@bank"
              autocomplete="off"
              inputmode="email"
              [formControl]="upi"
              [class.invalid]="upi.invalid && upi.touched"
            />
            <button class="ac-btn primary" (click)="saveUpi()" [disabled]="savingUpi() || upi.invalid">
              {{ savingUpi() ? 'Saving…' : 'Save' }}
            </button>
          </div>
          @if (upi.invalid && upi.touched) {
            <small class="ac-err">Enter a valid UPI ID (e.g. name&#64;bank).</small>
          }
        </section>
      }

      <!-- Security: change password -->
      <section class="ac-card">
        <div class="ac-card-h">
          <h2>Security</h2>
          <span class="ac-sub">Change your password</span>
        </div>
        <form (ngSubmit)="changePassword()">
          <!-- Hidden username target so the password manager fills here, not the nav search. -->
          <input class="ac-hidden-user" type="text" [value]="auth.user()?.email" autocomplete="username" tabindex="-1" readonly aria-hidden="true" />
          <div class="ac-pw">
            <app-text-field
              label="Current password"
              type="password"
              toggleMode="text"
              [formControl]="curPw"
              autocomplete="current-password"
              [invalid]="ctrlInvalid(curPw)"
              error="Enter your current password."
            />
            <app-text-field
              label="New password"
              type="password"
              toggleMode="text"
              [formControl]="newPw"
              autocomplete="new-password"
              [invalid]="ctrlInvalid(newPw)"
              error="At least 8 characters."
            />
            <app-text-field
              label="Confirm new"
              type="password"
              toggleMode="text"
              [formControl]="confirmPw"
              autocomplete="new-password"
              [invalid]="confirmInvalid()"
              [error]="confirmPwError()"
            />
          </div>
          <button class="ac-btn primary" type="submit" [disabled]="savingPw() || form_pwInvalid()">
            <lucide-icon name="lock" [size]="17" [strokeWidth]="1.8" />
            {{ savingPw() ? 'Updating…' : 'Update password' }}
          </button>
        </form>
      </section>

      <!-- Session -->
      <section class="ac-card">
        <button class="ac-btn danger" (click)="auth.logout()">
          <lucide-icon name="log-out" [size]="18" [strokeWidth]="1.8" /> Log out
        </button>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        background: #fbfaf6;
        min-height: 100vh;
        color: #16141e;
      }
      .ac-page {
        max-width: 820px;
        margin: 0 auto;
        padding: 32px 24px 64px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      /* Hero */
      .ac-hero {
        display: flex;
        align-items: center;
        gap: 16px;
        background: linear-gradient(135deg, #16141e 0%, #2a2348 100%);
        border-radius: 20px;
        padding: 26px 28px;
        color: #fff;
      }
      .ac-avatar {
        position: relative;
        width: 60px;
        height: 60px;
        border-radius: 16px;
        background: #5840e0;
        color: #fff;
        display: grid;
        place-items: center;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 24px;
        flex: none;
        overflow: hidden;
        cursor: pointer;
      }
      .ac-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .ac-avatar-init {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
      }
      .ac-avatar-edit {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #fff;
        color: #5840e0;
        display: grid;
        place-items: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        border: 2px solid #16141e;
      }
      .ac-avatar.busy { opacity: 0.7; }
      .ac-spin {
        width: 12px;
        height: 12px;
        border: 2px solid #d8d0ff;
        border-top-color: #5840e0;
        border-radius: 50%;
        animation: ac-spin 0.7s linear infinite;
      }
      @keyframes ac-spin {
        to { transform: rotate(360deg); }
      }
      .ac-hero-text {
        min-width: 0;
        flex: 1;
      }
      .ac-hero-text h1 {
        margin: 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 26px;
        letter-spacing: -0.02em;
        color: #fff;
      }
      .ac-hero-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 5px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.72);
      }
      .ac-dot {
        opacity: 0.5;
      }
      .ac-pic-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 9px;
      }
      .ac-pic-link {
        font: inherit;
        font-size: 12.5px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .ac-pic-link:hover {
        color: #fff;
      }
      .ac-pic-link.danger {
        color: #ffb4a8;
      }
      .ac-pic-link.danger:hover {
        color: #ff8f7e;
      }
      .ac-pic-link:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .ac-role {
        margin-left: auto;
        align-self: flex-start;
        background: rgba(255, 255, 255, 0.14);
        color: #fff;
        font-size: 12.5px;
        font-weight: 700;
        padding: 6px 13px;
        border-radius: 99px;
        white-space: nowrap;
        border: 1px solid rgba(255, 255, 255, 0.16);
      }

      /* Cards */
      .ac-card {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 18px;
        padding: 22px 24px;
      }
      .ac-card-h {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 16px;
      }
      .ac-card-h h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }
      .ac-sub {
        font-size: 13px;
        color: #8a8475;
      }
      .ac-muted {
        margin: -8px 0 16px;
        color: #5b5870;
        font-size: 14px;
        line-height: 1.55;
      }

      /* Needs attention */
      .ac-attn {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .ac-attn-item {
        display: block;
        text-decoration: none;
        color: #16141e;
        background: #faf8f2;
        border: 1px solid #e9e5d8;
        border-radius: 14px;
        padding: 16px 18px;
        transition: border-color 0.15s, background 0.15s, transform 0.15s;
      }
      .ac-attn-item:hover {
        transform: translateY(-2px);
        border-color: #5840e0;
      }
      .ac-attn-item .num {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 30px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1;
      }
      .ac-attn-item .lbl {
        font-size: 13.5px;
        font-weight: 600;
        color: #5b5870;
        margin-top: 6px;
      }
      .ac-attn-item .go {
        font-size: 12px;
        font-weight: 700;
        color: #8a8475;
        margin-top: 8px;
      }
      .ac-attn-item.urgent {
        background: #efebff;
        border-color: #d8d0ff;
      }
      .ac-attn-item.urgent .num,
      .ac-attn-item.urgent .go {
        color: #5840e0;
      }

      /* Console grid */
      .ac-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
      }
      .ac-tile {
        display: flex;
        flex-direction: column;
        gap: 2px;
        text-decoration: none;
        color: #16141e;
        background: #faf8f2;
        border: 1px solid #e9e5d8;
        border-radius: 14px;
        padding: 16px;
        transition: border-color 0.15s, background 0.15s, transform 0.15s;
      }
      .ac-tile:hover {
        transform: translateY(-2px);
        border-color: #5840e0;
        background: #fff;
      }
      .ac-tile .tic {
        width: 40px;
        height: 40px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        background: #efebff;
        color: #5840e0;
        margin-bottom: 8px;
      }
      .ac-tile b {
        font-size: 14.5px;
        font-weight: 700;
      }
      .ac-tile small {
        font-size: 12.5px;
        color: #8a8475;
      }

      /* Inputs / buttons */
      .ac-row {
        display: flex;
        gap: 10px;
      }
      .ac-two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        --field-mb: 6px;
      }
      .ac-pw {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
        --field-mb: 4px;
      }
      .ac-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 99px;
      }
      .ac-chip.ok {
        background: #eafaf0;
        color: #1a9e5f;
        border: 1px solid #c9efd8;
      }
      .ac-chip.warn {
        background: #fbf0dc;
        color: #b8791c;
        border: 1px solid #f2e1bf;
      }
      .ac-hidden-user {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
      .ac-input {
        flex: 1;
        height: 44px;
        padding: 0 14px;
        border: 1px solid #e2decf;
        border-radius: 12px;
        font-size: 15px;
        background: #fbfaf6;
        color: #16141e;
        width: 100%;
      }
      .ac-input:focus {
        outline: none;
        border-color: #5840e0;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }
      .ac-input.invalid {
        border-color: #dc2626;
      }
      .ac-err {
        display: block;
        margin-top: 8px;
        color: #dc2626;
        font-size: 13px;
      }
      .ac-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 44px;
        padding: 0 20px;
        border: none;
        border-radius: 12px;
        font-size: 14.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .ac-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .ac-btn.primary {
        background: #5840e0;
        color: #fff;
      }
      .ac-btn.primary:hover:not(:disabled) {
        background: #4733c4;
      }
      .ac-btn.danger {
        background: #fff;
        color: #dc2626;
        border: 1px solid #f3c8c8;
      }
      .ac-btn.danger:hover {
        background: #fef2f2;
      }
      .ac-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 13.5px;
        line-height: 1.4;
      }
      .ac-banner.warn {
        background: #fbf7e8;
        border: 1px solid #f2e7b8;
        color: #7a6a2e;
      }
      .ac-banner a {
        margin-left: auto;
        white-space: nowrap;
        font-weight: 700;
        color: #5840e0;
        text-decoration: none;
      }
      @media (max-width: 560px) {
        .ac-hero {
          flex-wrap: wrap;
        }
        .ac-role {
          margin-left: 0;
        }
        .ac-attn,
        .ac-pw {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AccountComponent {
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  protected upgrading = signal(false);
  protected savingUpi = signal(false);
  protected savingPw = signal(false);
  protected savingProfile = signal(false);
  protected uploadingPic = signal(false);
  protected upiSaved = signal(false);
  protected pendingQuals = signal(0);
  protected pendingPayouts = signal(0);

  protected initial = computed(() => (this.auth.user()?.fullName ?? '?').charAt(0).toUpperCase());
  protected memberSince = computed(() => {
    const d = this.auth.user()?.createdAt;
    return d ? new Date(d) : null;
  });
  protected roleLabel = computed(() => {
    if (this.auth.isAdmin()) return 'Administrator';
    return this.auth.canSell() ? 'Buyer & Seller' : 'Buyer';
  });

  protected readonly adminLinks: AdminLink[] = [
    { path: '/admin/dashboard', icon: 'layout-dashboard', label: 'Dashboard', desc: 'Overview & revenue' },
    { path: '/admin/users', icon: 'users', label: 'Users', desc: 'Buyers & sellers' },
    { path: '/admin/verifications', icon: 'shield-check', label: 'Verifications', desc: 'Qualification queue' },
    { path: '/admin/payouts', icon: 'wallet', label: 'Payouts', desc: 'Seller withdrawals' },
    { path: '/admin/taxonomy', icon: 'book-open', label: 'Taxonomy', desc: 'Categories & exams' },
    { path: '/admin/test', icon: 'clipboard-list', label: 'Test manager', desc: 'Per-category tests' },
    { path: '/admin/landing', icon: 'layout-template', label: 'Landing editor', desc: 'Public site' },
    { path: '/admin/config', icon: 'sliders-horizontal', label: 'Platform config', desc: 'Revenue & rules' },
  ];

  protected upi = new FormControl('', {
    nonNullable: true,
    validators: [Validators.pattern(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/)],
  });
  protected pName = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] });
  protected pPhone = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)] });
  protected curPw = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected newPw = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] });
  protected confirmPw = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  constructor() {
    // Refresh the JWT so identity (createdAt, phone, name) is current.
    if (this.auth.isLoggedIn()) this.auth.refreshSession();
    // Seed the profile form from identity, and re-seed when the refresh lands —
    // but only while the fields are untouched, so we never clobber user edits.
    effect(
      () => {
        const u = this.auth.user();
        if (!u) return;
        if (this.pName.pristine) this.pName.setValue(u.fullName ?? '');
        if (this.pPhone.pristine) this.pPhone.setValue(u.phone ?? '');
      },
      { allowSignalWrites: true },
    );

    if (this.auth.canSell()) {
      this.api
        .getUpiId()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (r) => {
            this.upi.setValue(r.data ?? '');
            this.upiSaved.set(!!r.data);
          },
          error: () => {},
        });
    }

    if (this.auth.isAdmin()) {
      this.api
        .getPendingQualifications()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (r) => this.pendingQuals.set(r.data?.totalElements ?? 0), error: () => {} });
      this.api
        .getPayoutStats()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (r) => this.pendingPayouts.set(r.data?.pendingCount ?? 0), error: () => {} });
    }
  }

  protected becomeSeller() {
    if (this.upgrading()) return;
    this.upgrading.set(true);
    this.auth
      .becomeSeller()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.upgrading.set(false);
          this.toast.success('You are now a seller — get qualified to publish notes.');
          this.router.navigate(['/seller/qualifications']);
        },
        error: () => {
          this.upgrading.set(false);
          this.toast.error('Could not upgrade to seller. Please try again.');
        },
      });
  }

  protected saveUpi() {
    if (this.upi.invalid || this.savingUpi()) return;
    this.savingUpi.set(true);
    this.api
      .setUpiId(this.upi.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingUpi.set(false);
          this.upiSaved.set(true);
          this.toast.success('Payout UPI saved.');
        },
        error: () => {
          this.savingUpi.set(false);
          this.toast.error('Could not save UPI. Please try again.');
        },
      });
  }

  protected uploadPic(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.uploadingPic()) return;
    const fd = new FormData();
    fd.append('file', file);
    this.uploadingPic.set(true);
    this.api
      .uploadProfileImage(fd)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.uploadingPic.set(false);
          if (r.data) this.auth.applyAuth(r.data);
          this.toast.success('Profile picture updated.');
          input.value = '';
        },
        error: (e) => {
          this.uploadingPic.set(false);
          this.toast.error(e?.error?.message ?? 'Could not upload picture.');
          input.value = '';
        },
      });
  }

  protected removePic() {
    if (this.uploadingPic() || !this.auth.user()?.profileImageUrl) return;
    this.uploadingPic.set(true);
    this.api
      .removeProfileImage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.uploadingPic.set(false);
          if (r.data) this.auth.applyAuth(r.data);
          this.toast.success('Profile picture removed.');
        },
        error: (e) => {
          this.uploadingPic.set(false);
          this.toast.error(e?.error?.message ?? 'Could not remove picture.');
        },
      });
  }

  // ── Profile ───────────────────────────────────────────────
  protected ctrlInvalid(c: FormControl): boolean {
    return c.invalid && (c.touched || c.dirty);
  }
  protected confirmInvalid(): boolean {
    return this.ctrlInvalid(this.confirmPw) || (this.confirmPw.touched && this.newPw.value !== this.confirmPw.value);
  }
  protected confirmPwError(): string {
    if (this.confirmPw.hasError('required')) return 'Please confirm your password.';
    if (this.newPw.value !== this.confirmPw.value) return "Passwords don't match.";
    return '';
  }
  protected form_pwInvalid(): boolean {
    return this.curPw.invalid || this.newPw.invalid || this.confirmPw.invalid || this.newPw.value !== this.confirmPw.value;
  }

  protected saveProfile() {
    if (this.savingProfile()) return;
    if (this.pName.invalid || this.pPhone.invalid) {
      this.pName.markAsTouched();
      this.pPhone.markAsTouched();
      return;
    }
    this.savingProfile.set(true);
    this.api
      .updateProfile(this.pName.value.trim(), this.pPhone.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.savingProfile.set(false);
          if (r.data) this.auth.applyAuth(r.data);
          this.pName.markAsPristine();
          this.pPhone.markAsPristine();
          this.toast.success('Profile updated.');
        },
        error: (e) => {
          this.savingProfile.set(false);
          this.toast.error(e?.error?.message ?? 'Could not update profile.');
        },
      });
  }

  protected changePassword() {
    if (this.savingPw()) return;
    const cur = this.curPw.value;
    const next = this.newPw.value;
    const confirm = this.confirmPw.value;
    if (!cur || !next) {
      this.toast.error('Fill in your current and new password.');
      return;
    }
    if (next.length < 8) {
      this.toast.error('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      this.toast.error('New passwords do not match.');
      return;
    }
    this.savingPw.set(true);
    this.api
      .changePassword(cur, next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingPw.set(false);
          this.curPw.reset();
          this.newPw.reset();
          this.confirmPw.reset();
          this.toast.success('Password updated.');
        },
        error: (e) => {
          this.savingPw.set(false);
          this.toast.error(e?.error?.message ?? 'Could not change password.');
        },
      });
  }
}
