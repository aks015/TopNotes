import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { ConfirmService } from '@core/services/confirm.service';
import { User } from '@core/models';
import { initials } from '@shared/util/note-display';

type RoleFilter = '' | 'BUYER' | 'SELLER';
type StatusFilter = '' | 'ACTIVE' | 'SUSPENDED';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="au">
      <header class="au-head">
        <div class="au-eyebrow">admin console</div>
        <h1 class="au-title">Users</h1>
        <p class="au-sub">
          @if (loading()) {
            Loading…
          } @else {
            <b>{{ total() }}</b> {{ total() === 1 ? 'account' : 'accounts' }}{{ role() ? ' · ' + roleLabel() : '' }}
          }
        </p>
      </header>

      <div class="au-tools">
        <div class="au-tabs">
          <button class="au-tab" [class.on]="role() === ''" (click)="setRole('')">All</button>
          <button class="au-tab" [class.on]="role() === 'BUYER'" (click)="setRole('BUYER')">Buyers</button>
          <button class="au-tab" [class.on]="role() === 'SELLER'" (click)="setRole('SELLER')">Sellers</button>
        </div>
        <div class="au-right">
          <div class="au-status">
            <button class="au-chip" [class.on]="status() === ''" (click)="setStatus('')">All</button>
            <button class="au-chip" [class.on]="status() === 'ACTIVE'" (click)="setStatus('ACTIVE')">Active</button>
            <button class="au-chip" [class.on]="status() === 'SUSPENDED'" (click)="setStatus('SUSPENDED')">Suspended</button>
          </div>
          <label class="au-search">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <input type="search" placeholder="Search all users by name or email…" [value]="term()" (input)="onSearch($any($event.target).value)" />
          </label>
        </div>
      </div>

      @if (loading()) {
        <div class="au-card"><div class="au-skel"></div><div class="au-skel"></div><div class="au-skel"></div></div>
      } @else {
        <div class="au-card">
          <div class="au-row au-row-head">
            <span>User</span><span class="au-hide-sm">Role</span><span class="au-hide-sm">Status</span><span class="au-hide">Joined</span><span class="au-right-h">Actions</span>
          </div>
          @for (u of users(); track u.id) {
            <div class="au-row">
              <div class="au-user">
                <span class="au-av">{{ initials(u.fullName) }}</span>
                <div class="au-user-id">
                  <div class="au-name">
                    {{ u.fullName }}
                    @if (u.role === 'SELLER' && u.isVerified) { <span class="au-verified" title="Verified topper">✓</span> }
                  </div>
                  <div class="au-email">{{ u.email }}</div>
                </div>
              </div>
              <div class="au-hide-sm"><span class="au-badge" [class]="roleClass(u.role)">{{ u.role }}</span></div>
              <div class="au-hide-sm"><span class="au-pill" [class]="statusClass(u.status)"><i></i>{{ u.status }}</span></div>
              <div class="au-hide au-joined">{{ u.createdAt | date: 'd MMM y' }}</div>
              <div class="au-act">
                @if (u.role === 'ADMIN') {
                  <span class="au-protected">Protected</span>
                } @else if (u.status === 'ACTIVE') {
                  <button class="au-btn danger" [disabled]="busyId() === u.id" (click)="suspend(u)">Suspend</button>
                } @else {
                  <button class="au-btn ok" [disabled]="busyId() === u.id" (click)="activate(u)">Activate</button>
                }
              </div>
            </div>
          } @empty {
            <div class="au-none">No users match.</div>
          }
        </div>

        @if (hasMore()) {
          <div class="au-more">
            <button class="au-btn primary" [disabled]="loadingMore()" (click)="loadMore()">
              {{ loadingMore() ? 'Loading…' : 'Load more' }}
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .au { max-width: 1180px; margin: 0 auto; font-family: 'Instrument Sans', system-ui, sans-serif; color: #16141e; }
      .au-eyebrow { font-family: 'Caveat', cursive; font-size: 22px; font-weight: 600; color: #5840e0; }
      .au-title { margin: 2px 0 6px; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 38px; letter-spacing: -0.03em; }
      .au-sub { margin: 0; font-size: 15px; color: #5b5870; }
      .au-sub b { color: #16141e; }

      .au-tools { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin: 20px 0 14px; }
      .au-tabs { display: flex; gap: 6px; }
      .au-tab { border: none; background: none; cursor: pointer; font: inherit; font-weight: 700; font-size: 14px; color: #8b879a; padding: 8px 4px; margin-right: 14px; border-bottom: 2px solid transparent; }
      .au-tab.on { color: #16141e; border-bottom-color: #5840e0; }
      .au-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .au-status { display: flex; gap: 6px; }
      .au-chip { border: 1px solid #e2decf; background: #fff; color: #5b5870; font: inherit; font-size: 12.5px; font-weight: 700; padding: 6px 12px; border-radius: 99px; cursor: pointer; }
      .au-chip.on { background: #16141e; color: #fff; border-color: #16141e; }
      .au-search { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2decf; border-radius: 99px; padding: 0 14px; color: #8b879a; min-width: 240px; }
      .au-search:focus-within { border-color: #5840e0; box-shadow: 0 0 0 3px rgba(88,64,224,.12); }
      .au-search input { border: none; background: none; outline: none; font: inherit; font-size: 14px; color: #16141e; padding: 9px 0; width: 100%; }

      .au-card { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; overflow: hidden; }
      .au-row { display: grid; grid-template-columns: 2.4fr 1fr 1.1fr 1fr 1fr; align-items: center; gap: 12px; padding: 14px 18px; border-top: 1px solid #f0ede2; }
      .au-row:first-child { border-top: none; }
      .au-row-head { background: #fbfaf6; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #8b879a; padding: 12px 18px; }
      .au-right-h { text-align: right; }
      .au-user { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .au-av { width: 38px; height: 38px; border-radius: 99px; background: #efebff; color: #5840e0; display: grid; place-items: center; font-size: 12px; font-weight: 700; flex: none; }
      .au-user-id { min-width: 0; }
      .au-name { font-weight: 700; font-size: 14.5px; display: flex; align-items: center; gap: 6px; }
      .au-verified { display: inline-grid; place-items: center; width: 15px; height: 15px; border-radius: 99px; background: #5840e0; color: #fff; font-size: 9px; }
      .au-email { font-size: 13px; color: #8b879a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .au-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
      .au-badge.seller { background: #fff3e0; color: #c47f17; }
      .au-badge.buyer { background: #efebff; color: #5840e0; }
      .au-badge.admin { background: #eafaf0; color: #1a9e5f; }
      .au-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; }
      .au-pill i { width: 7px; height: 7px; border-radius: 99px; }
      .au-pill.active { color: #1a9e5f; } .au-pill.active i { background: #1a9e5f; }
      .au-pill.susp { color: #d8453b; } .au-pill.susp i { background: #d8453b; }
      .au-joined { font-size: 13.5px; color: #5b5870; }
      .au-act { text-align: right; }
      .au-protected { font-size: 12.5px; color: #a8a4b8; font-weight: 600; }
      .au-btn { border: 1px solid #e2decf; background: #fff; cursor: pointer; font: inherit; font-weight: 700; border-radius: 99px; padding: 7px 14px; font-size: 13px; transition: background .16s, color .16s, border-color .16s; }
      .au-btn.danger { color: #d8453b; border-color: #f0d9d6; }
      .au-btn.danger:hover:not(:disabled) { background: #fdeceb; }
      .au-btn.ok { color: #1a9e5f; border-color: #c4ecd5; }
      .au-btn.ok:hover:not(:disabled) { background: #eafaf0; }
      .au-btn.primary { background: #16141e; color: #fff; border: none; padding: 11px 24px; font-size: 14px; }
      .au-btn.primary:hover:not(:disabled) { background: #5840e0; }
      .au-btn:disabled { opacity: .5; cursor: default; }
      .au-none { padding: 32px; text-align: center; color: #8b879a; font-size: 14px; }
      .au-more { display: flex; justify-content: center; margin-top: 20px; }

      .au-skel { height: 60px; margin: 14px 18px; border-radius: 12px; background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%); background-size: 200% 100%; animation: auShimmer 1.3s infinite; }
      @keyframes auShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

      @media (max-width: 820px) {
        .au-title { font-size: 30px; }
        .au-hide { display: none; }
        .au-row { grid-template-columns: 2.2fr 1fr 1.1fr 1fr; }
      }
      @media (max-width: 560px) {
        .au-hide-sm { display: none; }
        .au-row { grid-template-columns: 1.5fr auto; }
      }
    `,
  ],
})
export class AdminUsersComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private destroyRef = inject(DestroyRef);

  protected users = signal<User[]>([]);
  protected total = signal(0);
  protected loading = signal(true);
  protected loadingMore = signal(false);
  protected busyId = signal<number | null>(null);
  protected role = signal<RoleFilter>('');
  protected status = signal<StatusFilter>('');
  protected term = signal('');
  private page = signal(0);

  private search$ = new Subject<string>();

  protected hasMore = computed(() => this.users().length < this.total());

  constructor() {
    this.fetch(0);
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetch(0));
  }

  protected roleLabel(): string {
    return this.role() === 'BUYER' ? 'buyers' : this.role() === 'SELLER' ? 'sellers' : '';
  }

  protected setRole(r: RoleFilter) {
    if (this.role() === r) return;
    this.role.set(r);
    this.fetch(0);
  }
  protected setStatus(s: StatusFilter) {
    if (this.status() === s) return;
    this.status.set(s);
    this.fetch(0);
  }
  protected onSearch(v: string) {
    this.term.set(v);
    this.search$.next(v);
  }

  private fetch(page: number) {
    const initial = page === 0;
    initial ? this.loading.set(true) : this.loadingMore.set(true);
    this.api
      .getUsers(this.role() || undefined, page, this.term().trim() || undefined, this.status() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const content = r.data?.content ?? [];
          this.users.update((cur) => (initial ? content : [...cur, ...content]));
          this.total.set(r.data?.totalElements ?? 0);
          this.page.set(page);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: () => { this.loading.set(false); this.loadingMore.set(false); },
      });
  }
  protected loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.fetch(this.page() + 1);
  }

  protected async suspend(u: User) {
    const ok = await this.confirm.ask({
      title: 'Suspend account?',
      message: `${u.fullName} won't be able to log in until reactivated.`,
      confirmText: 'Suspend',
      danger: true,
    });
    if (!ok) return;
    this.busyId.set(u.id);
    this.api.suspendUser(u.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.toast.success(`${u.fullName} suspended`); this.patch(u.id, 'SUSPENDED'); this.busyId.set(null); },
      error: () => this.busyId.set(null),
    });
  }
  protected activate(u: User) {
    this.busyId.set(u.id);
    this.api.activateUser(u.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.toast.success(`${u.fullName} activated`); this.patch(u.id, 'ACTIVE'); this.busyId.set(null); },
      error: () => this.busyId.set(null),
    });
  }
  private patch(id: number, status: User['status']) {
    this.users.update((list) => list.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  protected readonly initials = initials;
  protected roleClass(r?: string): string { return r === 'SELLER' ? 'seller' : r === 'ADMIN' ? 'admin' : 'buyer'; }
  protected statusClass(s?: string): string { return s === 'ACTIVE' ? 'active' : 'susp'; }
}
