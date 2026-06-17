import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { AdminDashboard, User } from '@core/models';
import { AreaChartComponent } from '@ui/area-chart/area-chart.component';
import { initials, rupeeShort } from '@shared/util/note-display';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AreaChartComponent],
  template: `
    <div class="ad">
      <header class="ad-head">
        <div class="ad-eyebrow">admin console</div>
        <h1 class="ad-title">Platform overview</h1>
        <p class="ad-sub">Monitor users, revenue, sales and pending approvals — all live.</p>
      </header>

      @if (loading()) {
        <div class="ad-stats">
          @for (s of [1, 2, 3, 4, 5]; track s) { <div class="ad-skel" style="height:104px"></div> }
        </div>
        <div class="ad-skel" style="height:320px;margin-top:18px"></div>
      } @else {
        @if (data(); as d) {
        <!-- Stat cards -->
        <div class="ad-stats">
          <div class="ad-stat">
            <span class="ad-ic" style="background:#efebff;color:#5840e0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 11a3 3 0 0 0 0-6M20.5 19c0-2.4-1.6-4.2-4-4.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            </span>
            <div>
              <div class="ad-label">Total users</div>
              <div class="ad-value">{{ d.totalUsers || 0 }}</div>
              <div class="ad-sub2">{{ d.totalBuyers || 0 }} buyers · {{ d.totalSellers || 0 }} sellers</div>
            </div>
          </div>
          <div class="ad-stat">
            <span class="ad-ic" style="background:#eef4ff;color:#2563eb">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13H7zM14 3v5h5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
            </span>
            <div>
              <div class="ad-label">Notes published</div>
              <div class="ad-value">{{ d.totalNotes || 0 }}</div>
              <div class="ad-sub2">live listings</div>
            </div>
          </div>
          <div class="ad-stat">
            <span class="ad-ic" style="background:#eafaf0;color:#1a9e5f">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 7h18v12H3zM3 7l3-3h12l3 3" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="2.4" stroke="currentColor" stroke-width="1.7"/></svg>
            </span>
            <div>
              <div class="ad-label">Total sales</div>
              <div class="ad-value">{{ d.totalPurchases || 0 }}</div>
              <div class="ad-sub2">completed purchases</div>
            </div>
          </div>
          <div class="ad-stat">
            <span class="ad-ic" style="background:#fff5e6;color:#c47f17">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M16.5 7.5c0-1.7-2-2.5-4.5-2.5S7.5 5.8 7.5 7.5 9.5 10 12 10.5s4.5 1.3 4.5 3-2 2.5-4.5 2.5-4.5-.8-4.5-2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            </span>
            <div>
              <div class="ad-label">Platform earnings</div>
              <div class="ad-value">{{ inr(d.platformRevenue) }}</div>
              <div class="ad-sub2">our cut · all time</div>
            </div>
          </div>
          <a routerLink="/admin/verifications" class="ad-stat ad-stat-action" [class.urgent]="(d.pendingSellerApprovals || 0) > 0">
            <div>
              <div class="ad-label">Pending approvals</div>
              <div class="ad-value">{{ d.pendingSellerApprovals || 0 }}</div>
              <div class="ad-sub2">{{ (d.pendingSellerApprovals || 0) > 0 ? 'Review now →' : 'all clear 🎉' }}</div>
            </div>
          </a>
        </div>

        <!-- Revenue + side -->
        <div class="ad-grid">
          <div class="ad-card ad-chart">
            <div class="ad-card-head">
              <div>
                <h3>Revenue</h3>
                <div class="ad-rev-total">{{ inr(d.totalRevenue) }} <span>all time</span></div>
              </div>
              <div class="ad-toggle">
                <button [class.on]="chartMode() === 'daily'" (click)="chartMode.set('daily')">30 days</button>
                <button [class.on]="chartMode() === 'monthly'" (click)="chartMode.set('monthly')">Monthly</button>
              </div>
            </div>
            <div class="ad-rev-mini">
              <span>Today <b>{{ inr(d.todayRevenue) }}</b></span>
              <span class="ad-dot">·</span>
              <span>This month <b>{{ inr(d.monthRevenue) }}</b></span>
              <span class="ad-dot">·</span>
              <span>This year <b>{{ inr(d.yearRevenue) }}</b></span>
            </div>
            @if (chartData().length > 1) {
              <app-area-chart [data]="chartData()" [labels]="chartLabels()" [fmt]="moneyFmt" />
            } @else {
              <p class="ad-chart-empty">Not enough data yet for a {{ chartMode() === 'daily' ? '30-day' : 'monthly' }} trend.</p>
            }
          </div>

          <div class="ad-side">
            <!-- Revenue split -->
            <div class="ad-card ad-card-pad">
              <h3 class="ad-h3">Revenue split</h3>
              <div class="ad-splitbar">
                <i class="platform" [style.width.%]="platformPct()"></i>
                <i class="seller" [style.width.%]="100 - platformPct()"></i>
              </div>
              <div class="ad-split-rows">
                <div><span class="ad-key"><i class="dot platform"></i> Platform cut</span><b>{{ inr(data()!.platformRevenue) }}</b></div>
                <div><span class="ad-key"><i class="dot seller"></i> Seller payouts</span><b>{{ inr(data()!.sellerRevenue) }}</b></div>
              </div>
            </div>

            <!-- Pending approvals -->
            <div class="ad-card ad-card-pad">
              <div class="ad-card-head">
                <h3 class="ad-h3">Pending approvals</h3>
                <a class="ad-link" routerLink="/admin/verifications">View all</a>
              </div>
              @for (p of pending(); track p.id) {
                <div class="ad-prow">
                  <span class="ad-av">{{ initials(p.fullName) }}</span>
                  <div class="ad-prow-body">
                    <div class="ad-prow-name">{{ p.fullName }}</div>
                    <div class="ad-prow-meta">{{ p.institution }}@if (p.testScore != null) { · {{ p.testScore }}% test }</div>
                  </div>
                  <a class="ad-btn outline sm" routerLink="/admin/verifications">Review</a>
                </div>
              } @empty {
                <p class="ad-empty">No pending approvals 🎉</p>
              }
            </div>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="ad-actions">
          @for (a of quickActions; track a.link) {
            <a class="ad-action" [routerLink]="a.link">
              <span class="ad-action-title">{{ a.title }}</span>
              <span class="ad-action-desc">{{ a.desc }}</span>
              <span class="ad-action-arrow">→</span>
            </a>
          }
        </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .ad { max-width: 1280px; margin: 0 auto; font-family: 'Instrument Sans', system-ui, sans-serif; color: #16141e; }
      .ad-eyebrow { font-family: 'Caveat', cursive; font-size: 22px; font-weight: 600; color: #5840e0; }
      .ad-title { margin: 2px 0 6px; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 38px; letter-spacing: -0.03em; }
      .ad-sub { margin: 0 0 24px; font-size: 15px; color: #5b5870; }

      .ad-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
      .ad-stat { display: flex; align-items: flex-start; gap: 12px; background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; padding: 18px; }
      .ad-ic { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; flex: none; }
      .ad-label { font-size: 12px; font-weight: 600; color: #8b879a; margin-bottom: 3px; }
      .ad-value { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
      .ad-sub2 { font-size: 11.5px; color: #a8a4b8; margin-top: 4px; }
      .ad-stat-action { text-decoration: none; color: inherit; background: #16141e; border-color: #16141e; }
      .ad-stat-action .ad-label, .ad-stat-action .ad-sub2 { color: rgba(255,255,255,.7); }
      .ad-stat-action .ad-value { color: #fff; }
      .ad-stat-action.urgent { background: #5840e0; border-color: #5840e0; }
      .ad-stat-action:hover { background: #5840e0; border-color: #5840e0; }

      .ad-grid { margin-top: 18px; display: grid; grid-template-columns: 1.7fr 1fr; gap: 16px; align-items: start; }
      .ad-side { display: flex; flex-direction: column; gap: 16px; }
      .ad-card { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; }
      .ad-card-pad { padding: 18px 20px; }
      .ad-chart { padding: 18px 20px 8px; }
      .ad-card-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; gap: 12px; }
      .ad-card-head h3, .ad-h3 { margin: 0; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 17px; font-weight: 700; }
      .ad-rev-total { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-top: 2px; }
      .ad-rev-total span { font-family: 'Instrument Sans'; font-size: 12px; font-weight: 600; color: #a8a4b8; }
      .ad-rev-mini { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #5b5870; margin-bottom: 8px; }
      .ad-rev-mini b { color: #16141e; }
      .ad-dot { color: #c5bfd8; }
      .ad-chart-empty { padding: 40px 0; text-align: center; color: #a8a4b8; font-size: 14px; }

      .ad-toggle { display: flex; gap: 4px; background: #f0ede4; border-radius: 99px; padding: 3px; flex: none; }
      .ad-toggle button { border: none; background: none; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 700; color: #8b879a; padding: 6px 12px; border-radius: 99px; }
      .ad-toggle button.on { background: #fff; color: #16141e; box-shadow: 0 1px 2px rgba(0,0,0,.06); }

      .ad-splitbar { display: flex; height: 12px; border-radius: 99px; overflow: hidden; margin: 6px 0 14px; background: #f0ede4; }
      .ad-splitbar i { display: block; height: 100%; }
      .ad-splitbar i.platform, .dot.platform { background: #5840e0; }
      .ad-splitbar i.seller, .dot.seller { background: #f0b429; }
      .ad-split-rows { display: flex; flex-direction: column; gap: 10px; }
      .ad-split-rows > div { display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
      .ad-key { display: inline-flex; align-items: center; gap: 8px; color: #5b5870; }
      .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
      .ad-split-rows b { font-weight: 700; }

      .ad-link { font-size: 13px; font-weight: 700; color: #5840e0; text-decoration: none; }
      .ad-link:hover { text-decoration: underline; }
      .ad-prow { display: flex; align-items: center; gap: 11px; padding: 11px 0; border-top: 1px solid #f0ede2; }
      .ad-prow:first-of-type { border-top: none; }
      .ad-av { width: 36px; height: 36px; border-radius: 99px; background: #efebff; color: #5840e0; display: grid; place-items: center; font-size: 12px; font-weight: 700; flex: none; }
      .ad-prow-body { flex: 1; min-width: 0; }
      .ad-prow-name { font-size: 14px; font-weight: 600; }
      .ad-prow-meta { font-size: 12.5px; color: #8b879a; }
      .ad-empty { font-size: 14px; color: #8b879a; margin: 4px 0; }

      .ad-btn { display: inline-flex; align-items: center; border: none; cursor: pointer; font: inherit; font-weight: 700; border-radius: 99px; text-decoration: none; }
      .ad-btn.outline { background: #fff; border: 1px solid #e2decf; color: #4b4860; }
      .ad-btn.outline:hover { border-color: #5840e0; color: #5840e0; }
      .ad-btn.sm { padding: 7px 13px; font-size: 13px; }

      .ad-actions { margin-top: 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .ad-action { position: relative; background: #fff; border: 1px solid #e9e5d8; border-radius: 14px; padding: 16px 18px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 3px; transition: border-color .16s, transform .16s; }
      .ad-action:hover { border-color: #5840e0; transform: translateY(-2px); }
      .ad-action-title { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 700; font-size: 15px; }
      .ad-action-desc { font-size: 12.5px; color: #8b879a; }
      .ad-action-arrow { position: absolute; top: 16px; right: 16px; color: #c5bfd8; font-weight: 700; }
      .ad-action:hover .ad-action-arrow { color: #5840e0; }

      .ad-skel { border-radius: 16px; background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%); background-size: 200% 100%; animation: adShimmer 1.3s infinite; }
      @keyframes adShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

      @media (max-width: 1100px) {
        .ad-stats { grid-template-columns: repeat(3, 1fr); }
        .ad-grid { grid-template-columns: 1fr; }
        .ad-actions { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 560px) {
        .ad-title { font-size: 30px; }
        .ad-stats { grid-template-columns: repeat(2, 1fr); }
        .ad-actions { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class AdminDashboardComponent {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  protected data = signal<AdminDashboard | null>(null);
  protected pending = signal<User[]>([]);
  protected loading = signal(true);
  protected chartMode = signal<'daily' | 'monthly'>('daily');

  protected readonly quickActions = [
    { title: 'Users', desc: 'Manage & suspend accounts', link: '/admin/users' },
    { title: 'Verifications', desc: 'Approve toppers', link: '/admin/verifications' },
    { title: 'Payouts', desc: 'Pay seller withdrawals', link: '/admin/payouts' },
    { title: 'Exam Taxonomy', desc: 'Categories & subjects', link: '/admin/taxonomy' },
    { title: 'Test Manager', desc: 'Verification quiz', link: '/admin/test' },
    { title: 'Landing', desc: 'Edit the public page', link: '/admin/landing' },
    { title: 'Config', desc: 'Platform settings', link: '/admin/config' },
  ];

  protected chartData = computed(() => {
    const d = this.data();
    if (!d) return [];
    const pts = this.chartMode() === 'daily' ? d.dailyRevenue ?? [] : d.monthlyRevenue ?? [];
    return pts.map((p) => p.revenue);
  });
  protected chartLabels = computed(() => {
    const d = this.data();
    if (!d) return [];
    if (this.chartMode() === 'daily') {
      const pts = d.dailyRevenue ?? [];
      if (pts.length < 2) return [];
      const ticks = Math.min(5, pts.length);
      return Array.from({ length: ticks }, (_, i) => {
        const idx = Math.round((i * (pts.length - 1)) / (ticks - 1));
        return (pts[idx]?.date ?? '').slice(5);
      });
    }
    return (d.monthlyRevenue ?? []).map((p) => MONTHS[(+(p.month ?? '1') - 1) % 12] ?? '');
  });
  protected platformPct = computed(() => {
    const d = this.data();
    const total = d?.totalRevenue ?? 0;
    return total > 0 ? Math.round(((d?.platformRevenue ?? 0) / total) * 100) : 0;
  });
  protected moneyFmt = rupeeShort;

  constructor() {
    this.api
      .getAdminDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.data.set(r.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    this.api
      .getPendingVerifications(0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.pending.set((r.data?.content ?? []).slice(0, 4)),
        error: () => {},
      });
  }

  protected inr(v?: number): string {
    return '₹' + Math.round(v ?? 0).toLocaleString('en-IN');
  }
  protected readonly initials = initials;
}
