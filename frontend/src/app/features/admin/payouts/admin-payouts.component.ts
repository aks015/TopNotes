import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { PayoutRow, PayoutStats } from '@core/models';
import { IllustrationComponent } from '@ui/illustration/illustration.component';
import { initials, rupee } from '@shared/util/note-display';

type TabKey = 'PENDING' | 'PAID' | 'FAILED' | '';

@Component({
  selector: 'app-admin-payouts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IllustrationComponent],
  template: `
    <div class="po">
      <header class="po-head">
        <div class="po-eyebrow">money out</div>
        <h1 class="po-title">Payouts</h1>
        <p class="po-sub">Disburse seller withdrawals to UPI and track every transfer.</p>
      </header>

      <!-- KPIs -->
      @if (stats(); as s) {
        <div class="po-stats">
          <div class="po-stat" [class.urgent]="s.pendingCount > 0">
            <div class="po-ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="po-body">
              <div class="po-label">Awaiting payout</div>
              <div class="po-value">{{ inr(s.pendingAmount) }}</div>
              <div class="po-meta">{{ s.pendingCount }} {{ s.pendingCount === 1 ? 'request' : 'requests' }}{{ s.pendingCount > 0 ? ' — pay now ↓' : ' · all clear 🎉' }}</div>
            </div>
          </div>

          <div class="po-stat">
            <div class="po-ic ok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 7L9.5 17.5 4 12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="po-body">
              <div class="po-label">Paid out</div>
              <div class="po-value">{{ inr(s.paidAmount) }}</div>
              <div class="po-meta">{{ s.paidCount }} {{ s.paidCount === 1 ? 'transfer' : 'transfers' }} · all time</div>
            </div>
          </div>

          <div class="po-stat">
            <div class="po-ic" [class.bad]="s.failedCount > 0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16.5v.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            </div>
            <div class="po-body">
              <div class="po-label">Failed</div>
              <div class="po-value">{{ inr(s.failedAmount) }}</div>
              <div class="po-meta">{{ s.failedCount }} {{ s.failedCount === 1 ? 'transfer' : 'transfers' }}{{ s.failedCount > 0 ? ' · balance returned' : '' }}</div>
            </div>
          </div>
        </div>
      }

      <!-- Toolbar: tabs + search -->
      <div class="po-toolbar">
        <div class="po-tabs" role="tablist">
          @for (t of tabs(); track t.key) {
            <button
              class="po-tab"
              role="tab"
              [attr.aria-selected]="tab() === t.key"
              (click)="setTab(t.key)">
              {{ t.label }}
              @if (t.count !== null) { <span class="po-count">{{ t.count }}</span> }
            </button>
          }
        </div>
        <div class="po-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.7"/><path d="m20 20-3.2-3.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          <input
            type="search"
            placeholder="Search seller or UPI…"
            [value]="search()"
            (input)="onSearch($any($event.target).value)" />
        </div>
      </div>

      <!-- Body -->
      @if (loading() && rows().length === 0) {
        <div class="skel" style="height:320px;border-radius:16px"></div>
      } @else if (rows().length === 0) {
        <div class="po-empty">
          <app-illustration name="sales" />
          <h3>{{ emptyTitle() }}</h3>
          <p>{{ emptyHint() }}</p>
        </div>
      } @else {
        <div class="po-table-card">
          <div class="po-table-wrap">
            <table class="po-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>UPI</th>
                  <th class="num">Amount</th>
                  <th class="hide-sm">Requested</th>
                  <th>Status</th>
                  <th class="act"></th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr>
                    <td>
                      <div class="po-seller">
                        <span class="po-av">{{ ini(r.sellerName) }}</span>
                        <b>{{ r.sellerName }}</b>
                      </div>
                    </td>
                    <td class="po-upi">{{ r.upiId }}</td>
                    <td class="num"><b>{{ inr(r.amount) }}</b></td>
                    <td class="hide-sm muted">{{ r.requestedAt | date: 'd MMM y, h:mm a' }}</td>
                    <td>
                      @switch (r.status) {
                        @case ('PENDING') { <span class="badge badge-amber"><i class="dot"></i> Awaiting</span> }
                        @case ('PAID') {
                          <span class="badge badge-success"><i class="dot"></i> Paid</span>
                          @if (r.paidAt) { <div class="po-fine">{{ r.paidAt | date: 'd MMM, h:mm a' }}@if (r.reference) { · ref {{ r.reference }} }</div> }
                        }
                        @case ('FAILED') {
                          <span class="badge badge-danger"><i class="dot"></i> Failed</span>
                          @if (r.failureReason) { <div class="po-fine err" [title]="r.failureReason">{{ r.failureReason }}</div> }
                        }
                        @default { <span class="badge badge-muted">{{ r.status }}</span> }
                      }
                    </td>
                    <td class="act">
                      @if (r.status === 'PENDING') {
                        <button class="po-pay" [disabled]="paying() === r.id" (click)="pay(r)">
                          {{ paying() === r.id ? 'Paying…' : 'Pay ' + inr(r.amount) }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (hasMore()) {
            <div class="po-more">
              <button class="po-more-btn" [disabled]="loading()" (click)="loadMore()">
                {{ loading() ? 'Loading…' : 'Load more' }}
              </button>
              <span class="muted">Showing {{ rows().length }} of {{ total() }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .po-head { margin-bottom: 22px; }
      .po-eyebrow { font-family: 'Caveat', cursive; font-size: 22px; color: #5840e0; line-height: 1; }
      .po-title { font-size: 30px; letter-spacing: -0.02em; margin: 2px 0 4px; }
      .po-sub { color: #6b6657; font-size: 15px; }

      /* KPI cards */
      .po-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 22px; }
      @media (max-width: 820px) { .po-stats { grid-template-columns: 1fr; } }
      .po-stat { display: flex; gap: 14px; align-items: flex-start; background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; padding: 18px; transition: border-color .15s, background .15s; }
      .po-stat.urgent { background: #16141e; border-color: #16141e; }
      .po-stat.urgent .po-label, .po-stat.urgent .po-meta { color: rgba(255,255,255,.72); }
      .po-stat.urgent .po-value { color: #fff; }
      .po-stat.urgent .po-ic { background: #5840e0; color: #fff; }
      .po-ic { flex: none; width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: #efebff; color: #5840e0; }
      .po-ic.ok { background: #eafaf0; color: #1a9e5f; }
      .po-ic.bad { background: #fdecea; color: #d64545; }
      .po-label { font-size: 13px; font-weight: 600; color: #6b6657; }
      .po-value { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #16141e; margin-top: 3px; }
      .po-meta { font-size: 12px; font-weight: 600; color: #8a8475; margin-top: 4px; }

      /* Toolbar */
      .po-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
      .po-tabs { display: flex; gap: 4px; background: #f1efe7; border: 1px solid #e9e5d8; border-radius: 12px; padding: 4px; }
      .po-tab { font: inherit; font-size: 14px; font-weight: 600; color: #6b6657; background: none; border: none; padding: 8px 14px; border-radius: 9px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: background .15s, color .15s; }
      .po-tab:hover { color: #16141e; }
      .po-tab[aria-selected='true'] { background: #fff; color: #16141e; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
      .po-count { font-size: 12px; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #e9e5d8; color: #6b6657; display: inline-grid; place-items: center; }
      .po-tab[aria-selected='true'] .po-count { background: #efebff; color: #5840e0; }
      .po-search { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e9e5d8; border-radius: 11px; padding: 0 12px; height: 40px; min-width: 240px; flex: 1; max-width: 320px; color: #8a8475; }
      .po-search input { border: none; outline: none; background: none; font: inherit; font-size: 14px; color: #16141e; width: 100%; }

      /* Empty */
      .po-empty { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; padding: 56px 24px; text-align: center; }
      .po-empty app-illustration { display: block; max-width: 180px; margin: 0 auto 8px; }
      .po-empty h3 { font-size: 20px; margin-bottom: 6px; }
      .po-empty p { color: #6b6657; max-width: 420px; margin: 0 auto; }

      /* Table */
      .po-table-card { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; overflow: hidden; }
      .po-table-wrap { overflow-x: auto; }
      .po-table { width: 100%; border-collapse: collapse; }
      .po-table th { text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #8a8475; padding: 14px 18px; border-bottom: 1px solid #e9e5d8; background: #faf8f2; white-space: nowrap; }
      .po-table th.num, .po-table td.num { text-align: right; }
      .po-table th.act { width: 1%; }
      .po-table td { padding: 14px 18px; border-bottom: 1px solid #f1efe7; font-size: 14px; color: #16141e; vertical-align: middle; }
      .po-table tbody tr:last-child td { border-bottom: none; }
      .po-table tbody tr:hover { background: #faf8f2; }
      .po-seller { display: flex; align-items: center; gap: 10px; }
      .po-av { flex: none; width: 32px; height: 32px; border-radius: 50%; background: #efebff; color: #5840e0; font-size: 12px; font-weight: 700; display: grid; place-items: center; }
      .po-upi { color: #6b6657; overflow-wrap: anywhere; font-feature-settings: 'tnum'; }
      .po-fine { font-size: 11.5px; color: #8a8475; margin-top: 4px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .po-fine.err { color: #d64545; }
      .badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
      .po-pay { font: inherit; font-size: 13px; font-weight: 700; color: #fff; background: #5840e0; border: none; border-radius: 9px; padding: 8px 14px; cursor: pointer; white-space: nowrap; transition: background .15s; }
      .po-pay:hover:not(:disabled) { background: #4733c2; }
      .po-pay:disabled { opacity: .6; cursor: default; }

      .po-more { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-top: 1px solid #e9e5d8; background: #faf8f2; }
      .po-more-btn { font: inherit; font-size: 13px; font-weight: 700; color: #16141e; background: #fff; border: 1px solid #e9e5d8; border-radius: 9px; padding: 8px 16px; cursor: pointer; }
      .po-more-btn:hover:not(:disabled) { border-color: #5840e0; color: #5840e0; }
      .muted { color: #8a8475; font-size: 13px; }
      @media (max-width: 640px) { .hide-sm { display: none; } }
    `,
  ],
})
export class AdminPayoutsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected stats = signal<PayoutStats | null>(null);
  protected rows = signal<PayoutRow[]>([]);
  protected loading = signal(true);
  protected paying = signal<number | null>(null);

  protected tab = signal<TabKey>('PENDING');
  protected search = signal('');
  protected page = signal(0);
  protected total = signal(0);
  protected hasMore = computed(() => this.rows().length < this.total());

  private readonly size = 20;
  private search$ = new Subject<string>();

  protected tabs = computed(() => {
    const s = this.stats();
    return [
      { key: 'PENDING' as TabKey, label: 'Pending', count: s ? s.pendingCount : null },
      { key: 'PAID' as TabKey, label: 'Paid', count: s ? s.paidCount : null },
      { key: 'FAILED' as TabKey, label: 'Failed', count: s ? s.failedCount : null },
      { key: '' as TabKey, label: 'All', count: s ? s.pendingCount + s.paidCount + s.failedCount : null },
    ];
  });

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.search.set(q);
        this.reload();
      });
    this.loadStats();
    this.reload();
  }

  protected ini = initials;
  protected inr = (v: number) => rupee(v);

  protected emptyTitle(): string {
    if (this.search()) return 'No matches';
    switch (this.tab()) {
      case 'PENDING': return 'No pending payouts';
      case 'PAID': return 'No payouts paid yet';
      case 'FAILED': return 'No failed payouts';
      default: return 'No payouts yet';
    }
  }
  protected emptyHint(): string {
    if (this.search()) return 'No seller or UPI matches “' + this.search() + '”.';
    switch (this.tab()) {
      case 'PENDING': return 'Seller withdrawal requests will show up here for you to pay out.';
      case 'PAID': return 'Disbursed transfers will be listed here once you pay sellers.';
      case 'FAILED': return 'Transfers that fail at the bank will appear here — the amount returns to the seller’s balance.';
      default: return 'Withdrawals and their history will appear here.';
    }
  }

  protected setTab(key: TabKey) {
    if (this.tab() === key) return;
    this.tab.set(key);
    this.reload();
  }

  protected onSearch(value: string) {
    this.search$.next(value);
  }

  private loadStats() {
    this.api
      .getPayoutStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.stats.set(r.data ?? null) });
  }

  private reload() {
    this.page.set(0);
    this.rows.set([]);
    this.fetch();
  }

  protected loadMore() {
    this.page.update((p) => p + 1);
    this.fetch();
  }

  private fetch() {
    this.loading.set(true);
    this.api
      .getPayouts(this.tab(), this.search(), this.page(), this.size)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const pageData = r.data;
          const content = pageData?.content ?? [];
          this.rows.update((prev) => (this.page() === 0 ? content : [...prev, ...content]));
          this.total.set(pageData?.totalElements ?? content.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected pay(r: PayoutRow) {
    if (this.paying()) return;
    this.paying.set(r.id);
    this.api
      .payPayout(r.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.paying.set(null);
          const p = res.data;
          if (p?.status === 'PAID') {
            this.toast.success('Paid ' + rupee(p.amount) + ' to ' + r.sellerName);
          } else {
            this.toast.error('Payout failed: ' + (p?.failureReason ?? 'unknown error'));
          }
          this.loadStats();
          this.reload();
        },
        error: () => this.paying.set(null),
      });
  }
}
