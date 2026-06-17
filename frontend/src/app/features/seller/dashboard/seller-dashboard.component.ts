import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { Purchase, SellerDashboard, SellerEarnings } from '@core/models';
import { AreaChartComponent } from '@ui/area-chart/area-chart.component';
import { IllustrationComponent } from '@ui/illustration/illustration.component';
import { initials, rupeeShort } from '@shared/util/note-display';

@Component({
  selector: 'app-seller-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, AreaChartComponent, IllustrationComponent],
  template: `
    <div class="sd">
      <!-- Header -->
      <header class="sd-head">
        <div>
          <div class="sd-eyebrow">seller studio</div>
          <h1 class="sd-title">Welcome back, {{ firstName() }}</h1>
          <p class="sd-sub">Here's how your notes are performing.</p>
        </div>
        <div class="sd-head-actions">
          <a class="sd-btn ghost" [routerLink]="['/u', auth.user()?.userId]">View public profile</a>
          <a class="sd-btn primary" routerLink="/seller/upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            Upload new note
          </a>
        </div>
      </header>

      @if (loading()) {
        <div class="sd-stats">
          @for (s of [1, 2, 3, 4]; track s) {
            <div class="sd-skel" style="height:104px"></div>
          }
        </div>
        <div class="sd-skel" style="height:340px;margin-top:20px"></div>
      } @else {
        @if (data(); as d) {
        @if (d.totalSales === 0 && d.totalNotes === 0) {
          <!-- First-run empty state -->
          <div class="sd-empty">
            <app-illustration name="sales" />
            @if (!d.isVerified) {
              <h3>Get verified to start selling</h3>
              <p>Before you can publish notes, complete a one-time verification — a short test and your marksheet.</p>
              <a class="sd-btn primary" routerLink="/seller/qualifications">Get qualified</a>
            } @else {
              <h3>No sales yet</h3>
              <p>Upload your first set of notes to start earning. Verified toppers earn on every download.</p>
              <a class="sd-btn primary" routerLink="/seller/upload">Upload your first note</a>
            }
          </div>
        } @else {
          <!-- Stat cards -->
          <div class="sd-stats">
            <div class="sd-stat">
              <span class="sd-stat-ic" style="background:#eafaf0;color:#1a9e5f">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7h18v12H3zM3 7l3-3h12l3 3" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                  <circle cx="12" cy="13" r="2.4" stroke="currentColor" stroke-width="1.7" />
                </svg>
              </span>
              <div>
                <div class="sd-stat-label">Total earnings</div>
                <div class="sd-stat-value">₹{{ (d.totalEarnings || 0).toLocaleString('en-IN') }}</div>
              </div>
            </div>
            <div class="sd-stat">
              <span class="sd-stat-ic" style="background:#efebff;color:#5840e0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" stroke-width="1.7" />
                  <path d="M3.5 9h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                </svg>
              </span>
              <div>
                <div class="sd-stat-label">This month</div>
                <div class="sd-stat-value">₹{{ (d.monthEarnings || 0).toLocaleString('en-IN') }}</div>
              </div>
            </div>
            <div class="sd-stat">
              <span class="sd-stat-ic" style="background:#eef4ff;color:#2563eb">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M7 3h7l5 5v13H7zM14 3v5h5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                </svg>
              </span>
              <div>
                <div class="sd-stat-label">Notes sold</div>
                <div class="sd-stat-value">{{ d.totalSales || 0 }}</div>
              </div>
            </div>
            <div class="sd-stat">
              <span class="sd-stat-ic" style="background:#fff5e6;color:#c47f17">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <div>
                <div class="sd-stat-label">Avg. rating</div>
                @if ((d.averageRating || 0) > 0) {
                  <div class="sd-stat-value">{{ (d.averageRating || 0).toFixed(1) }} <span class="sd-star">★</span></div>
                } @else {
                  <div class="sd-stat-value sd-stat-empty">No ratings yet</div>
                }
              </div>
            </div>
          </div>

          <!-- Chart + sidebar -->
          <div class="sd-grid">
            <div class="sd-card sd-chart">
              <div class="sd-card-head">
                <h3>Revenue · last 30 days</h3>
                <span class="sd-card-note">Your earnings</span>
              </div>
              <app-area-chart [data]="chartData()" [labels]="chartLabels()" [fmt]="moneyFmt" />
            </div>

            <div class="sd-side">
              <div class="sd-card sd-card-pad">
                <div
                  class="sd-verify"
                  [class.ok]="d.isVerified"
                  [class.warn]="!d.isVerified"
                >
                  <span class="sd-verify-ic">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2.5 4 6v5c0 5 3.5 8 8 9.5 4.5-1.5 8-4.5 8-9.5V6l-8-3.5Z"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linejoin="round"
                      />
                      <path d="m9 12 2 2 4-4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <b>{{ d.isVerified ? 'Verified Seller' : 'Verification pending' }}</b>
                    <small>{{ d.isVerified ? 'You can publish notes' : 'Complete verification to sell' }}</small>
                  </div>
                </div>

                @if (!d.isVerified) {
                  <a class="sd-action" routerLink="/seller/qualifications">
                    <span class="sd-action-ic">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2.5 4 6v5c0 5 3.5 8 8 9.5 4.5-1.5 8-4.5 8-9.5V6l-8-3.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                      </svg>
                    </span>
                    <span class="sd-action-tx"><b>Get qualified</b><small>Per-category test + marksheet</small></span>
                    <span class="sd-action-arrow">→</span>
                  </a>
                }
                <a class="sd-action" routerLink="/seller/upload">
                  <span class="sd-action-ic">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="sd-action-tx"><b>Upload new note</b><small>Add to your catalogue</small></span>
                  <span class="sd-action-arrow">→</span>
                </a>
                <a class="sd-action" routerLink="/seller/notes">
                  <span class="sd-action-ic">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M6 3h9l5 5v13H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="sd-action-tx"><b>Manage notes</b><small>{{ d.totalNotes }} published</small></span>
                  <span class="sd-action-arrow">→</span>
                </a>
              </div>

              @if (earnings(); as e) {
                <div class="sd-card sd-card-pad sd-earn">
                  <h3>Earnings</h3>
                  <div class="sd-earn-amt">₹{{ e.available.toLocaleString('en-IN') }}</div>
                  <small class="sd-muted">available to withdraw</small>
                  <div class="sd-earn-split">
                    <span>Earned <b>₹{{ e.totalEarned.toLocaleString('en-IN') }}</b></span>
                    <span>Paid <b>₹{{ e.paidOut.toLocaleString('en-IN') }}</b></span>
                  </div>
                  @if (e.inProgress > 0) {
                    <span class="sd-badge">₹{{ e.inProgress.toLocaleString('en-IN') }} payout pending</span>
                  }
                  <button
                    class="sd-btn primary sd-earn-btn"
                    [disabled]="withdrawing() || !e.upiSet || e.available < e.minWithdraw"
                    (click)="withdraw()"
                  >
                    {{ withdrawing() ? 'Requesting…' : 'Withdraw ₹' + e.available.toLocaleString('en-IN') }}
                  </button>
                  @if (!e.upiSet) {
                    <a routerLink="/seller/verification" class="sd-earn-link">Add a payout UPI →</a>
                  } @else if (e.available < e.minWithdraw) {
                    <small class="sd-earn-min">Minimum withdrawal ₹{{ e.minWithdraw }}</small>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Recent sales -->
          <div class="sd-card sd-card-pad sd-sales">
            <div class="sd-card-head">
              <h3>Recent sales</h3>
              <a routerLink="/seller/notes" class="sd-card-link">Manage notes →</a>
            </div>
            <div class="sd-sales-list">
              @for (s of sales(); track s.id) {
                <div class="sd-sale">
                  <span class="sd-sale-av">{{ initials(s.note?.title) }}</span>
                  <div class="sd-sale-body">
                    <div class="sd-sale-note">{{ s.note?.title }}</div>
                    <div class="sd-sale-meta">
                      {{ s.purchasedAt | date: 'd MMM y' }} · <span class="sd-inv">{{ s.invoiceNumber }}</span>
                    </div>
                  </div>
                  <span class="sd-sale-amt">+₹{{ (s.sellerShare || s.amount || 0).toLocaleString('en-IN') }}</span>
                </div>
              } @empty {
                <p class="sd-muted">No sales yet.</p>
              }
            </div>
          </div>
        }
        }
      }
    </div>
  `,
  styles: [
    `
      .sd {
        max-width: 1280px;
        margin: 0 auto;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        color: #16141e;
      }

      /* Header */
      .sd-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 26px;
      }
      .sd-eyebrow {
        font-family: 'Caveat', cursive;
        font-size: 22px;
        font-weight: 600;
        color: #5840e0;
      }
      .sd-title {
        margin: 2px 0 6px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 38px;
        letter-spacing: -0.03em;
      }
      .sd-sub {
        margin: 0;
        font-size: 15px;
        color: #5b5870;
      }

      /* Buttons */
      .sd-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-decoration: none;
        font-size: 14px;
        font-weight: 700;
        padding: 11px 20px;
        border-radius: 99px;
        border: none;
        cursor: pointer;
        transition: background 0.18s, color 0.18s;
      }
      .sd-head-actions {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .sd-btn.primary {
        background: #16141e;
        color: #fbfaf6;
      }
      .sd-btn.primary:hover:not(:disabled) {
        background: #5840e0;
      }
      .sd-btn.ghost {
        background: #fff;
        color: #16141e;
        border: 1px solid #e9e5d8;
      }
      .sd-btn.ghost:hover {
        border-color: #5840e0;
        color: #5840e0;
      }
      .sd-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }

      /* Stat cards */
      .sd-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
      .sd-stat {
        display: flex;
        align-items: center;
        gap: 13px;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        padding: 18px;
      }
      .sd-stat-ic {
        width: 40px;
        height: 40px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        flex: none;
      }
      .sd-stat-label {
        font-size: 12px;
        font-weight: 600;
        color: #8b879a;
        margin-bottom: 3px;
      }
      .sd-stat-value {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
      }
      .sd-star {
        color: #c47f17;
        font-size: 18px;
      }
      .sd-stat-empty {
        font-size: 14px;
        font-weight: 700;
        color: #a8a4b8;
      }

      /* Main grid */
      .sd-grid {
        margin-top: 20px;
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 16px;
        align-items: start;
      }
      .sd-side {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .sd-card {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
      }
      .sd-card-pad {
        padding: 18px 20px;
      }
      .sd-chart {
        padding: 18px 20px 8px;
      }
      .sd-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .sd-card-head h3 {
        margin: 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 17px;
        font-weight: 700;
      }
      .sd-card-note {
        font-size: 12px;
        font-weight: 600;
        color: #8b879a;
      }
      .sd-card-link {
        font-size: 13px;
        font-weight: 700;
        color: #5840e0;
        text-decoration: none;
      }
      .sd-card-link:hover {
        text-decoration: underline;
      }

      /* Verify banner */
      .sd-verify {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 12px 14px;
        border-radius: 12px;
        margin-bottom: 12px;
      }
      .sd-verify.ok {
        background: #eafaf0;
        border: 1px solid #c4ecd5;
        color: #1a9e5f;
      }
      .sd-verify.warn {
        background: #fff6e6;
        border: 1px solid #f3e0b8;
        color: #c47f17;
      }
      .sd-verify b {
        font-size: 13.5px;
        color: #16141e;
        display: block;
        line-height: 1.3;
      }
      .sd-verify small {
        font-size: 12px;
        color: #5b5870;
      }

      /* Quick actions */
      .sd-action {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 1px solid #eee9dc;
        border-radius: 12px;
        text-decoration: none;
        color: inherit;
        margin-top: 10px;
        transition: border-color 0.16s, background 0.16s;
      }
      .sd-action:hover {
        border-color: #5840e0;
        background: #faf9ff;
      }
      .sd-action-ic {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #efebff;
        color: #5840e0;
        display: grid;
        place-items: center;
        flex: none;
      }
      .sd-action-tx {
        flex: 1;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }
      .sd-action-tx b {
        font-size: 13.5px;
      }
      .sd-action-tx small {
        font-size: 12px;
        color: #8b879a;
      }
      .sd-action-arrow {
        color: #c5bfd8;
        font-weight: 700;
      }
      .sd-action:hover .sd-action-arrow {
        color: #5840e0;
      }

      /* Earnings */
      .sd-earn h3 {
        margin: 0 0 2px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 17px;
        font-weight: 700;
      }
      .sd-earn-amt {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 30px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .sd-muted {
        color: #8b879a;
      }
      .sd-earn-split {
        display: flex;
        gap: 18px;
        margin: 12px 0;
        font-size: 13px;
        color: #5b5870;
      }
      .sd-earn-split b {
        color: #16141e;
      }
      .sd-badge {
        display: inline-block;
        font-size: 12px;
        font-weight: 700;
        color: #c47f17;
        background: #fff6e6;
        border: 1px solid #f3e0b8;
        padding: 4px 10px;
        border-radius: 99px;
        margin-bottom: 12px;
      }
      .sd-earn-btn {
        width: 100%;
        margin-top: 4px;
      }
      .sd-earn-link {
        display: block;
        text-align: center;
        margin-top: 10px;
        font-size: 13px;
        font-weight: 700;
        color: #5840e0;
        text-decoration: none;
      }
      .sd-earn-min {
        display: block;
        text-align: center;
        margin-top: 8px;
        color: #a8a4b8;
        font-size: 12.5px;
      }

      /* Recent sales */
      .sd-sales {
        margin-top: 20px;
      }
      .sd-sales-list {
        display: flex;
        flex-direction: column;
      }
      .sd-sale {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid #f0ede2;
      }
      .sd-sale:first-child {
        border-top: none;
      }
      .sd-sale-av {
        width: 38px;
        height: 38px;
        border-radius: 99px;
        background: #efebff;
        color: #5840e0;
        display: grid;
        place-items: center;
        font-size: 13px;
        font-weight: 700;
        flex: none;
      }
      .sd-sale-body {
        flex: 1;
        min-width: 0;
      }
      .sd-sale-note {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sd-sale-meta {
        font-size: 12.5px;
        color: #8b879a;
      }
      .sd-inv {
        font-variant-numeric: tabular-nums;
      }
      .sd-sale-amt {
        font-weight: 800;
        color: #1a9e5f;
        font-size: 15px;
        white-space: nowrap;
      }

      /* Skeleton + empty */
      .sd-skel {
        border-radius: 16px;
        background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%);
        background-size: 200% 100%;
        animation: sdShimmer 1.3s infinite;
      }
      @keyframes sdShimmer {
        from {
          background-position: 200% 0;
        }
        to {
          background-position: -200% 0;
        }
      }
      .sd-empty {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 20px;
        padding: 56px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 6px;
      }
      .sd-empty h3 {
        margin: 14px 0 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 24px;
      }
      .sd-empty p {
        margin: 0;
        color: #5b5870;
        font-size: 15px;
        max-width: 380px;
      }
      .sd-empty .sd-btn {
        margin-top: 16px;
        padding: 12px 26px;
      }

      /* Responsive */
      @media (max-width: 1000px) {
        .sd-grid {
          grid-template-columns: 1fr;
        }
        .sd-stats {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 560px) {
        .sd-title {
          font-size: 30px;
        }
        .sd-stats {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class SellerDashboardComponent {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected data = signal<SellerDashboard | null>(null);
  protected sales = signal<Purchase[]>([]);
  protected loading = signal(true);
  protected earnings = signal<SellerEarnings | null>(null);
  protected withdrawing = signal(false);

  protected firstName = computed(() => (this.auth.user()?.fullName ?? 'there').split(' ')[0]);
  protected chartData = computed(() => (this.data()?.salesChart ?? []).map((p) => p.revenue));
  protected chartLabels = computed(() => {
    const pts = this.data()?.salesChart ?? [];
    if (pts.length < 2) return [];
    const ticks = Math.min(5, pts.length);
    const out: string[] = [];
    for (let i = 0; i < ticks; i++) {
      const idx = Math.round((i * (pts.length - 1)) / (ticks - 1));
      out.push((pts[idx]?.date ?? '').slice(5));
    }
    return out;
  });
  protected moneyFmt = rupeeShort;

  constructor() {
    this.api
      .getSellerDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.data.set(r.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    this.api
      .getSellerSales(0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.sales.set(r.data?.content ?? []),
        error: () => {},
      });
    this.loadEarnings();
  }

  private loadEarnings() {
    this.api
      .getSellerEarnings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.earnings.set(r.data ?? null), error: () => {} });
  }

  protected withdraw() {
    if (this.withdrawing()) return;
    this.withdrawing.set(true);
    this.api
      .requestPayout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.withdrawing.set(false);
          this.toast.success('Withdrawal requested — admin will pay out to your UPI.');
          this.loadEarnings();
        },
        error: () => this.withdrawing.set(false),
      });
  }

  protected readonly initials = initials;
}
