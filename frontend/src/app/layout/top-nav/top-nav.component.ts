import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ConsentDialogService } from '@core/services/consent-dialog.service';
import { AppNotification } from '@core/models';
import { LogoComponent } from '@ui/logo/logo.component';

type Menu = 'seller' | 'admin' | 'account' | 'notif' | null;

/**
 * The single top navigation used across the WHOLE logged-in app — marketplace
 * (browse, purchases, note detail) AND the seller/admin consoles. Every
 * destination a user can reach is always one click away from here, so a
 * dual-role (buyer + seller) user never loses their nav or has to go "back".
 */
@Component({
  selector: 'app-top-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule, LogoComponent],
  template: `
    <header class="tn">
      <div class="tn-inner">
        <a class="tn-logo" routerLink="/" aria-label="TopNotes home">
          <app-logo [size]="34" [wordSize]="20" />
        </a>

        <!-- Primary links (desktop) -->
        <nav class="tn-links" aria-label="Primary">
          <a class="tn-link" routerLink="/browse" routerLinkActive="active">Browse</a>
          @if (auth.isLoggedIn() && !auth.isAdmin()) {
            <a class="tn-link" routerLink="/my-purchases" routerLinkActive="active">My Purchases</a>
          }
          @if (auth.canSell()) {
            @if (auth.isVerified()) {
              <div class="tn-drop">
                <button class="tn-link tn-trig" [class.open]="menu() === 'seller'" (click)="toggle('seller', $event)">
                  Seller <lucide-icon name="chevron-down" [size]="15" [strokeWidth]="2" />
                </button>
                @if (menu() === 'seller') {
                  <div class="tn-menu" role="menu">
                    <a class="tn-item" routerLink="/seller/dashboard">Dashboard</a>
                    <a class="tn-item" routerLink="/seller/upload">Upload note</a>
                    <a class="tn-item" routerLink="/seller/notes">My Notes</a>
                    <a class="tn-item" routerLink="/seller/qualifications">Qualifications</a>
                  </div>
                }
              </div>
            } @else {
              <!-- Not yet qualified in any category → drive them to get verified. -->
              <a class="tn-link tn-getverified" routerLink="/seller/qualifications" routerLinkActive="active">
                Get verified
              </a>
            }
          }
          @if (auth.isAdmin()) {
            <div class="tn-drop">
              <button class="tn-link tn-trig" [class.open]="menu() === 'admin'" (click)="toggle('admin', $event)">
                Admin <lucide-icon name="chevron-down" [size]="15" [strokeWidth]="2" />
              </button>
              @if (menu() === 'admin') {
                <div class="tn-menu" role="menu">
                  <a class="tn-item" routerLink="/admin/dashboard">Dashboard</a>
                  <a class="tn-item" routerLink="/admin/users">Users</a>
                  <a class="tn-item" routerLink="/admin/verifications">Verifications</a>
                  <a class="tn-item" routerLink="/admin/note-approvals">Note approvals</a>
                  <a class="tn-item" routerLink="/admin/test">Test Manager</a>
                  <a class="tn-item" routerLink="/admin/taxonomy">Exam Taxonomy</a>
                  <a class="tn-item" routerLink="/admin/payouts">Payouts</a>
                  <a class="tn-item" routerLink="/admin/config">Config</a>
                  <a class="tn-item" routerLink="/admin/landing">Landing</a>
                </div>
              }
            </div>
          }
        </nav>

        <!-- Search -->
        <div class="tn-search">
          <span class="tn-search-ic"><lucide-icon name="search" [size]="18" [strokeWidth]="1.8" /></span>
          <input
            type="search"
            name="q"
            autocomplete="off"
            placeholder="Search notes, subjects, toppers…"
            [value]="term()"
            (input)="onSearch($any($event.target).value)"
            (keyup.enter)="searchNow()"
            aria-label="Search"
          />
        </div>

        <!-- Right -->
        <div class="tn-right">
          @if (auth.isLoggedIn()) {
            <div class="tn-drop">
              <button class="tn-icon" (click)="toggleNotif($event)" aria-label="Notifications">
                <lucide-icon name="bell" [size]="21" [strokeWidth]="1.8" />
                @if (unread() > 0) {
                  <span class="tn-dot"></span>
                }
              </button>
              @if (menu() === 'notif') {
                <div class="tn-menu tn-notif" role="region" aria-label="Notifications">
                  <div class="tn-notif-head">
                    <b>Notifications</b>
                    <button type="button" (click)="markAllRead()" [disabled]="!hasUnread()">Mark all read</button>
                  </div>
                  @if (notifLoading()) {
                    <p class="tn-notif-empty">Loading…</p>
                  } @else if (notifications().length === 0) {
                    <p class="tn-notif-empty">You're all caught up 🎉</p>
                  } @else {
                    <div class="tn-notif-list">
                      @for (n of notifications(); track n.id) {
                        <button
                          type="button"
                          class="tn-notif-row"
                          [class.unread]="!n.isRead"
                          [class.clickable]="!!notifLink(n.type)"
                          (click)="openNotif(n)"
                        >
                          <span class="tn-notif-ic" [class]="'k-' + n.type.toLowerCase()">
                            <lucide-icon [name]="notifIcon(n.type)" [size]="16" [strokeWidth]="2" />
                          </span>
                          <span class="tn-notif-body">
                            <span class="tn-notif-top">
                              <b>{{ n.title }}</b>
                              <time>{{ timeAgo(n.createdAt) }}</time>
                            </span>
                            <span class="tn-notif-msg">{{ n.message }}</span>
                          </span>
                          @if (!n.isRead) {
                            <span class="tn-notif-unread" aria-label="Unread"></span>
                          }
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <div class="tn-drop">
              <button class="tn-acct" (click)="toggle('account', $event)" aria-label="Account menu">
                <span class="tn-avatar">
                  @if (auth.user()?.profileImageUrl) {
                    <img [src]="auth.user()?.profileImageUrl" alt="" />
                  } @else {
                    {{ initial() }}
                  }
                </span>
                <span class="tn-who">
                  <b>{{ auth.user()?.fullName }}</b>
                  <small>{{ roleLabel() }}</small>
                </span>
                <lucide-icon name="chevron-down" [size]="16" [strokeWidth]="1.8" />
              </button>
              @if (menu() === 'account') {
                <div class="tn-menu tn-acct-menu" role="menu">
                  <!-- Mobile-only quick nav (inline links are hidden on small screens) -->
                  <div class="tn-mobile-nav">
                    <a class="tn-item" routerLink="/browse">Browse</a>
                    @if (!auth.isAdmin()) {
                      <a class="tn-item" routerLink="/my-purchases">My Purchases</a>
                    }
                    @if (auth.canSell()) {
                      @if (auth.isVerified()) {
                        <a class="tn-item" routerLink="/seller/dashboard">Seller dashboard</a>
                        <a class="tn-item" routerLink="/seller/upload">Upload note</a>
                        <a class="tn-item" routerLink="/seller/notes">My Notes</a>
                        <a class="tn-item" routerLink="/seller/qualifications">Qualifications</a>
                      } @else {
                        <a class="tn-item" routerLink="/seller/qualifications">Get verified</a>
                      }
                    }
                    @if (auth.isAdmin()) {
                      <a class="tn-item" routerLink="/admin/dashboard">Admin console</a>
                    }
                    <div class="tn-sep"></div>
                  </div>
                  <a class="tn-item" routerLink="/account">Account</a>
                  @if (auth.isBuyer()) {
                    <button class="tn-item" (click)="becomeSeller()" [disabled]="upgrading()">
                      {{ upgrading() ? 'Upgrading…' : 'Become a seller' }}
                    </button>
                  }
                  <div class="tn-sep"></div>
                  <button class="tn-item danger" (click)="auth.logout()">Log out</button>
                </div>
              }
            </div>
          } @else {
            <a class="tn-login" routerLink="/login">Log in</a>
            <a class="tn-signup" routerLink="/register">Sign up</a>
          }
        </div>
      </div>
    </header>

    @if (auth.isLoggedIn() && !auth.emailVerified() && !verifyDismissed()) {
      <div class="tn-verify" role="status">
        <span class="tn-verify-txt">Verify your email to secure your account.</span>
        <span class="tn-verify-actions">
          <a class="tn-verify-cta" routerLink="/account">Verify now</a>
          <button type="button" class="tn-verify-x" (click)="verifyDismissed.set(true)" aria-label="Dismiss">✕</button>
        </span>
      </div>
    }
  `,
  styles: [
    `
      /* Host carries the stickiness so it sticks against the whole page scroll
         (not just the nav's own short box). */
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 50;
      }
      /* Floating pill header — detached from the top/side edges. */
      .tn {
        padding: 14px 20px 0;
      }
      /* Unverified-email nudge, sits just under the floating nav. */
      .tn-verify {
        max-width: 1400px;
        margin: 10px auto 0;
        padding: 9px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: #fff7ed;
        border: 1px solid #fed7aa;
        border-radius: 12px;
        font-size: 13.5px;
        font-weight: 600;
        color: #9a3412;
      }
      .tn-verify-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .tn-verify-cta {
        text-decoration: none;
        font-weight: 700;
        color: #9a3412;
        padding: 5px 12px;
        border-radius: 99px;
        background: #ffedd5;
      }
      .tn-verify-cta:hover {
        background: #fed7aa;
      }
      .tn-verify-x {
        background: none;
        border: none;
        cursor: pointer;
        color: #9a3412;
        font-size: 15px;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 6px;
      }
      .tn-verify-x:hover {
        background: #ffedd5;
      }
      .tn-inner {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 16px 0 20px;
        height: 62px;
        display: flex;
        align-items: center;
        gap: 18px;
        background: rgba(255, 255, 255, 0.82);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border: 1px solid rgba(22, 20, 30, 0.08);
        border-radius: 18px;
        box-shadow: 0 12px 34px -14px rgba(22, 20, 30, 0.22);
      }
      .tn-logo {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        text-decoration: none;
        color: #16141e;
      }
      .tn-links {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .tn-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        text-decoration: none;
        color: #4b4860;
        font-size: 14.5px;
        font-weight: 600;
        padding: 8px 12px;
        border-radius: 9px;
        background: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
      }
      .tn-link:hover {
        background: #f0ede2;
        color: #16141e;
      }
      .tn-link.active {
        color: #5840e0;
        background: #efebff;
      }
      .tn-trig.open {
        background: #f0ede2;
        color: #16141e;
      }
      /* "Get verified" CTA shown until a seller qualifies in any category. */
      .tn-getverified {
        color: #5840e0;
        font-weight: 700;
      }
      .tn-getverified:hover {
        background: #efebff;
        color: #5840e0;
      }
      .tn-drop {
        position: relative;
      }
      .tn-search {
        flex: 1;
        min-width: 0;
        max-width: 460px;
        margin-left: auto;
        position: relative;
      }
      .tn-search-ic {
        position: absolute;
        left: 16px;
        top: 50%;
        transform: translateY(-50%);
        color: #a8a4b8;
        display: inline-flex;
        pointer-events: none;
      }
      .tn-search input {
        width: 100%;
        padding: 10px 18px 10px 44px;
        border: 1.5px solid #e2decf;
        border-radius: 99px;
        background: #fff;
        font-size: 14px;
        font-family: inherit;
        color: #16141e;
      }
      .tn-search input:focus {
        outline: none;
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }
      .tn-right {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tn-icon {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: none;
        border: none;
        cursor: pointer;
        color: #4b4860;
      }
      .tn-icon:hover {
        background: #f0ede2;
        color: #16141e;
      }
      .tn-dot {
        position: absolute;
        top: 9px;
        right: 9px;
        width: 8px;
        height: 8px;
        border-radius: 99px;
        background: #e5484d;
        border: 2px solid #fbfaf6;
      }
      .tn-acct {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #fff;
        border: 1.5px solid #e2decf;
        border-radius: 99px;
        padding: 5px 10px 5px 5px;
        cursor: pointer;
        color: #16141e;
        font-family: inherit;
      }
      .tn-avatar {
        width: 30px;
        height: 30px;
        border-radius: 99px;
        background: #5840e0;
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
        overflow: hidden;
      }
      .tn-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .tn-who {
        display: flex;
        flex-direction: column;
        line-height: 1.15;
        text-align: left;
      }
      .tn-who b {
        font-size: 13.5px;
        font-weight: 700;
      }
      .tn-who small {
        font-size: 11.5px;
        color: #8b879a;
      }
      .tn-login {
        text-decoration: none;
        color: #16141e;
        font-size: 15px;
        font-weight: 600;
        padding: 9px 14px;
      }
      .tn-login:hover {
        color: #5840e0;
      }
      .tn-signup {
        text-decoration: none;
        background: #16141e;
        color: #fbfaf6;
        font-size: 15px;
        font-weight: 600;
        padding: 10px 20px;
        border-radius: 99px;
      }
      .tn-signup:hover {
        background: #5840e0;
      }

      /* Dropdown menus */
      .tn-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 14px;
        box-shadow: 0 16px 40px -16px rgba(22, 20, 30, 0.3);
        padding: 6px;
        min-width: 200px;
        display: flex;
        flex-direction: column;
        z-index: 60;
      }
      .tn-drop .tn-menu.left {
        left: 0;
        right: auto;
      }
      .tn-item {
        text-align: left;
        text-decoration: none;
        background: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        color: #16141e;
        padding: 10px 12px;
        border-radius: 9px;
        white-space: nowrap;
      }
      .tn-item:hover {
        background: #f5f2ea;
      }
      .tn-item.danger {
        color: #dc2626;
      }
      .tn-item:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .tn-sep {
        height: 1px;
        background: #f0ede2;
        margin: 4px 0;
      }
      .tn-mobile-nav {
        display: none;
      }

      /* Notifications */
      .tn-notif {
        min-width: 320px;
        max-width: 360px;
        padding: 0;
        overflow: hidden;
      }
      .tn-notif-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid #f0ede2;
      }
      .tn-notif-head b {
        font-size: 14px;
      }
      .tn-notif-head button {
        font-size: 12px;
        font-weight: 600;
        color: #5840e0;
        background: none;
        border: none;
        cursor: pointer;
      }
      .tn-notif-head button:disabled {
        color: #b3ad9c;
        cursor: default;
      }
      .tn-notif-empty {
        margin: 0;
        padding: 26px 16px;
        color: #8b879a;
        font-size: 13.5px;
        text-align: center;
      }
      .tn-notif-list {
        max-height: 384px;
        overflow-y: auto;
      }
      .tn-notif-row {
        display: flex;
        align-items: flex-start;
        gap: 11px;
        width: 100%;
        text-align: left;
        font: inherit;
        background: none;
        border: none;
        border-bottom: 1px solid #f5f2ea;
        padding: 12px 16px;
        cursor: default;
      }
      .tn-notif-row.clickable {
        cursor: pointer;
      }
      .tn-notif-row:last-child {
        border-bottom: none;
      }
      .tn-notif-row.unread {
        background: #f7f5ff;
      }
      .tn-notif-row.clickable:hover {
        background: #f1eeff;
      }
      .tn-notif-ic {
        flex: none;
        width: 32px;
        height: 32px;
        border-radius: 9px;
        display: grid;
        place-items: center;
        background: #eef0f4;
        color: #5b5870;
      }
      .tn-notif-ic.k-sale {
        background: #eafaf0;
        color: #1a9e5f;
      }
      .tn-notif-ic.k-payment {
        background: #efebff;
        color: #5840e0;
      }
      .tn-notif-ic.k-verification {
        background: #eef4ff;
        color: #2563eb;
      }
      .tn-notif-ic.k-review {
        background: #fff5e6;
        color: #c47f17;
      }
      .tn-notif-ic.k-system {
        background: #f1efe7;
        color: #6b6657;
      }
      .tn-notif-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tn-notif-top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .tn-notif-top b {
        font-size: 13px;
        font-weight: 700;
        color: #16141e;
      }
      .tn-notif-top time {
        flex: none;
        font-size: 11px;
        color: #a8a4b8;
        white-space: nowrap;
      }
      .tn-notif-msg {
        font-size: 12.5px;
        color: #5b5870;
        line-height: 1.45;
      }
      .tn-notif-unread {
        flex: none;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #5840e0;
        margin-top: 6px;
      }

      /* Responsive: collapse inline links + search into the account menu */
      @media (max-width: 900px) {
        .tn-links {
          display: none;
        }
        .tn-mobile-nav {
          display: contents;
        }
        .tn-who {
          display: none;
        }
      }
      @media (max-width: 620px) {
        .tn-search {
          display: none;
        }
      }
    `,
  ],
})
export class TopNavComponent {
  protected auth = inject(AuthService);
  private consent = inject(ConsentDialogService);

  /** Dismisses the "verify your email" nudge for the current session. */
  protected verifyDismissed = signal(false);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  protected menu = signal<Menu>(null);
  protected upgrading = signal(false);
  protected unread = signal(0);
  protected notifications = signal<AppNotification[]>([]);
  protected notifLoading = signal(false);

  protected initial = computed(() => (this.auth.user()?.fullName ?? '?').charAt(0).toUpperCase());
  protected roleLabel = computed(() => {
    if (this.auth.isAdmin()) return 'Administrator';
    return this.auth.canSell() ? 'Buyer & Seller' : 'Buyer';
  });

  // Seed the search box from the URL so it reflects the active keyword on browse.
  private routeKeyword = toSignal(this.route.queryParamMap, { initialValue: null });
  protected term = signal('');
  private search$ = new Subject<string>();

  constructor() {
    const kw = this.routeKeyword()?.get('keyword') ?? '';
    if (kw) this.term.set(kw);

    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.go(q));

    if (this.auth.isLoggedIn()) {
      this.api
        .getUnreadCount()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (r) => this.unread.set(r.data?.count ?? 0), error: () => {} });
    }
  }

  // ── Search ──────────────────────────────────────────────────
  protected onSearch(value: string) {
    this.term.set(value);
    this.search$.next(value);
  }
  protected searchNow() {
    this.go(this.term());
  }
  private go(value: string) {
    this.router.navigate(['/browse'], {
      queryParams: { keyword: value.trim() || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  // ── Menus ───────────────────────────────────────────────────
  protected toggle(which: Menu, e: Event) {
    e.stopPropagation();
    this.menu.update((m) => (m === which ? null : which));
  }
  protected toggleNotif(e: Event) {
    e.stopPropagation();
    const opening = this.menu() !== 'notif';
    this.menu.set(opening ? 'notif' : null);
    if (opening) this.loadNotifications();
  }
  @HostListener('document:click')
  protected closeMenus() {
    this.menu.set(null);
  }

  // ── Notifications ───────────────────────────────────────────
  protected hasUnread = computed(() => this.notifications().some((n) => !n.isRead));

  private loadNotifications() {
    this.notifLoading.set(true);
    this.api
      .getNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.notifications.set((r.data?.content ?? []) as AppNotification[]);
          this.notifLoading.set(false);
          this.markSeen(); // clear the bell badge, but keep per-row unread highlight for this view
        },
        error: () => this.notifLoading.set(false),
      });
  }
  /** Clears the server-side unread badge without flipping the local rows (so highlights stay visible). */
  private markSeen() {
    if (this.unread() > 0) {
      this.api
        .markNotificationsRead()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: () => this.unread.set(0), error: () => {} });
    }
  }
  protected markAllRead() {
    this.notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.markSeen();
  }

  /** Lucide icon per notification type. */
  protected notifIcon(type: string): string {
    switch (type) {
      case 'SALE':
        return 'shopping-bag';
      case 'PAYMENT':
        return 'wallet';
      case 'VERIFICATION':
        return 'shield-check';
      case 'REVIEW':
        return 'star';
      default:
        return 'bell';
    }
  }
  /** Where a notification routes when clicked (role-aware; null = not clickable). */
  protected notifLink(type: string): string | null {
    const seller = this.auth.canSell();
    switch (type) {
      case 'SALE':
      case 'PAYMENT':
        return seller ? '/seller/dashboard' : null;
      case 'VERIFICATION':
        return seller ? '/seller/qualifications' : null;
      case 'REVIEW':
        return seller ? '/seller/notes' : '/my-purchases';
      default:
        return null;
    }
  }
  protected openNotif(n: AppNotification) {
    const link = this.notifLink(n.type);
    this.menu.set(null);
    if (link) this.router.navigate([link]);
  }
  /** Compact relative time, e.g. "2h ago". */
  protected timeAgo(iso?: string): string {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    const w = Math.floor(d / 7);
    if (w < 5) return w + 'w ago';
    const mo = Math.floor(d / 30);
    if (mo < 12) return mo + 'mo ago';
    return Math.floor(d / 365) + 'y ago';
  }

  // ── Become a seller ─────────────────────────────────────────
  protected async becomeSeller() {
    if (this.upgrading()) return;
    // Accepting the Seller Agreement is a precondition of becoming a seller.
    const accepted = await this.consent.require('SELLER_AGREEMENT');
    if (!accepted) return;
    this.upgrading.set(true);
    this.auth
      .becomeSeller()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.upgrading.set(false);
          this.menu.set(null);
          this.toast.success('You are now a seller — get qualified to publish notes.');
          this.router.navigate(['/seller/qualifications']);
        },
        error: () => {
          this.upgrading.set(false);
          this.toast.error('Could not upgrade to seller. Please try again.');
        },
      });
  }
}
