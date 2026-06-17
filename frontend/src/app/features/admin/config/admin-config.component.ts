import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-admin-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="cfg">
      <header class="cfg-head">
        <div class="cfg-eyebrow">marketplace settings</div>
        <h1 class="cfg-title">Platform config</h1>
        <p class="cfg-sub">Live levers for the marketplace — changes apply to new activity immediately.</p>
      </header>

      @if (loading()) {
        <div class="skel" style="height:280px;border-radius:16px;max-width:720px"></div>
      } @else {
        <div class="cfg-cols">
          <!-- Live, editable money levers -->
          <div class="cfg-col">
          <!-- Revenue split -->
          <section class="cfg-card">
            <div class="cfg-card-head">
              <div>
                <h3>Revenue split</h3>
                <p>How each sale is divided between the platform and the seller.</p>
              </div>
              <span class="cfg-live">● Live</span>
            </div>

            <div class="cfg-bar">
              <div class="cfg-bar-p" [style.width.%]="platform()">{{ platform() }}%</div>
              <div class="cfg-bar-s" [style.width.%]="100 - platform()">{{ 100 - platform() }}%</div>
            </div>

            <div class="cfg-slider-row">
              <span class="cfg-key"><i class="sw plat"></i> Platform</span>
              <input
                type="range" min="5" max="60" step="1"
                [value]="platform()"
                (input)="platform.set(+$any($event.target).value)" />
              <span class="cfg-key"><i class="sw sell"></i> Seller</span>
            </div>

            <div class="cfg-example">
              <span>On a <b>₹100</b> sale</span>
              <span class="cfg-ex-split">
                platform earns <b>₹{{ platform() }}</b> · seller earns <b>₹{{ 100 - platform() }}</b>
              </span>
            </div>
            <p class="cfg-note">New sales use this split instantly. Past purchases keep the split they were sold at.</p>

            <div class="cfg-actions">
              <button class="cfg-btn primary" [disabled]="!splitDirty() || savingSplit()" (click)="saveSplit()">
                {{ savingSplit() ? 'Saving…' : 'Save split' }}
              </button>
              @if (splitDirty()) { <button class="cfg-btn ghost" (click)="resetSplit()">Cancel</button> }
            </div>
          </section>

          <!-- Payout rules -->
          <section class="cfg-card">
            <div class="cfg-card-head">
              <div>
                <h3>Payout rules</h3>
                <p>Controls when sellers can cash out their earnings.</p>
              </div>
              <span class="cfg-live">● Live</span>
            </div>

            <div class="cfg-field">
              <label for="minw">Minimum withdrawal</label>
              <div class="cfg-input-wrap">
                <span class="cfg-prefix">₹</span>
                <input
                  id="minw" type="number" min="1" step="1"
                  [value]="minWithdraw()"
                  (input)="minWithdraw.set(+$any($event.target).value)" />
              </div>
            </div>
            <p class="cfg-note">Sellers can't request a withdrawal until their available balance reaches this amount.</p>

            <div class="cfg-actions">
              <button class="cfg-btn primary" [disabled]="!payoutDirty() || savingPayout()" (click)="savePayout()">
                {{ savingPayout() ? 'Saving…' : 'Save rules' }}
              </button>
              @if (payoutDirty()) { <button class="cfg-btn ghost" (click)="resetPayout()">Cancel</button> }
            </div>
          </section>
          </div>

          <!-- Reference / non-editable -->
          <div class="cfg-col">
          <!-- Currency (fixed) -->
          <section class="cfg-card">
            <div class="cfg-card-head">
              <div>
                <h3>Currency</h3>
                <p>Display, payments and payouts.</p>
              </div>
              <span class="cfg-chip">Fixed</span>
            </div>
            <div class="cfg-readonly">
              <span class="cfg-cur">₹ INR — Indian Rupee</span>
              <span class="cfg-readonly-sub">Payments via UPI &amp; cards, payouts to UPI — India only.</span>
            </div>
          </section>

          <!-- Seller qualification → Test Manager -->
          <section class="cfg-card cfg-link-card">
            <div class="cfg-card-head">
              <div>
                <h3>Seller qualification</h3>
                <p>Pass scores &amp; questions are now set <b>per exam category</b>.</p>
              </div>
            </div>
            <p class="cfg-note">
              Each category (Engineering, Medical, Banking…) has its own test and passing score. Manage them in the
              Test Manager.
            </p>
            <div class="cfg-actions">
              <a class="cfg-btn primary" routerLink="/admin/test">Open Test Manager →</a>
            </div>
          </section>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .cfg-head { margin-bottom: 22px; }
      .cfg-eyebrow { font-family: 'Caveat', cursive; font-size: 22px; color: #5840e0; line-height: 1; }
      .cfg-title { font-size: 30px; letter-spacing: -0.02em; margin: 2px 0 4px; }
      .cfg-sub { color: #6b6657; font-size: 15px; }

      /* Two independent columns so a tall card never forces a gap beside a short one.
         Left = live, editable levers · right = fixed/reference. */
      .cfg-cols { display: flex; gap: 18px; max-width: 920px; align-items: flex-start; }
      .cfg-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
      @media (max-width: 760px) { .cfg-cols { flex-direction: column; } }

      .cfg-card { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; padding: 22px; }
      .cfg-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
      .cfg-card-head h3 { font-size: 17px; letter-spacing: -0.01em; }
      .cfg-card-head p { color: #6b6657; font-size: 13.5px; margin-top: 3px; }
      .cfg-live { flex: none; font-size: 11.5px; font-weight: 700; color: #1a9e5f; background: #eafaf0; border: 1px solid #c9efd8; border-radius: 999px; padding: 4px 10px; }
      .cfg-chip { flex: none; font-size: 11.5px; font-weight: 700; color: #8a8475; background: #f1efe7; border: 1px solid #e9e5d8; border-radius: 999px; padding: 4px 10px; }

      /* Split bar */
      .cfg-bar { display: flex; height: 44px; border-radius: 11px; overflow: hidden; font-weight: 800; font-size: 14px; color: #fff; }
      .cfg-bar-p { background: #5840e0; display: grid; place-items: center; min-width: 40px; }
      .cfg-bar-s { background: #e8a13a; display: grid; place-items: center; min-width: 40px; }
      .cfg-slider-row { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
      .cfg-slider-row input[type='range'] { flex: 1; accent-color: #5840e0; }
      .cfg-key { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #6b6657; white-space: nowrap; }
      .sw { width: 11px; height: 11px; border-radius: 3px; }
      .sw.plat { background: #5840e0; }
      .sw.sell { background: #e8a13a; }
      .cfg-example { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-top: 16px; padding: 12px 14px; background: #faf8f2; border: 1px solid #f1efe7; border-radius: 11px; font-size: 13.5px; color: #6b6657; }
      .cfg-example b { color: #16141e; }

      .cfg-note { font-size: 12.5px; color: #8a8475; margin-top: 12px; line-height: 1.5; }

      /* Field */
      .cfg-field { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .cfg-field label { font-size: 14px; font-weight: 600; color: #16141e; }
      .cfg-input-wrap { display: flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #d8d3c4; border-radius: 10px; padding: 0 12px; height: 42px; }
      .cfg-input-wrap:focus-within { border-color: #5840e0; box-shadow: 0 0 0 3px rgba(88,64,224,.12); }
      .cfg-prefix { color: #8a8475; font-weight: 600; }
      .cfg-input-wrap input { border: none; outline: none; font: inherit; font-size: 15px; font-weight: 600; color: #16141e; width: 90px; background: none; }

      /* Read-only currency */
      .cfg-readonly { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; background: #faf8f2; border: 1px solid #f1efe7; border-radius: 11px; }
      .cfg-cur { font-size: 16px; font-weight: 700; color: #16141e; }
      .cfg-readonly-sub { font-size: 12.5px; color: #8a8475; }

      .cfg-link-card { display: flex; flex-direction: column; }

      /* Buttons */
      .cfg-actions { display: flex; align-items: center; gap: 10px; margin-top: 18px; }
      .cfg-btn { font: inherit; font-size: 14px; font-weight: 700; border-radius: 10px; padding: 10px 18px; cursor: pointer; border: 1px solid transparent; text-decoration: none; display: inline-block; transition: background .15s, border-color .15s, color .15s; }
      .cfg-btn.primary { background: #5840e0; color: #fff; }
      .cfg-btn.primary:hover:not(:disabled) { background: #4733c2; }
      .cfg-btn.primary:disabled { opacity: .5; cursor: default; }
      .cfg-btn.ghost { background: #fff; color: #6b6657; border-color: #e9e5d8; }
      .cfg-btn.ghost:hover { border-color: #d8d3c4; color: #16141e; }
    `,
  ],
})
export class AdminConfigComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected loading = signal(true);

  protected platform = signal(35);
  protected minWithdraw = signal(100);

  // Loaded baselines, for dirty detection + cancel.
  private origPlatform = signal(35);
  private origMinWithdraw = signal(100);

  protected savingSplit = signal(false);
  protected savingPayout = signal(false);

  protected splitDirty = computed(() => this.platform() !== this.origPlatform());
  protected payoutDirty = computed(() => this.minWithdraw() !== this.origMinWithdraw());

  constructor() {
    this.api
      .getConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const c = r.data ?? {};
          const p = +(c['platform-commission-percent'] ?? 35);
          const m = +(c['min-withdraw'] ?? 100);
          this.platform.set(p);
          this.origPlatform.set(p);
          this.minWithdraw.set(m);
          this.origMinWithdraw.set(m);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected resetSplit() {
    this.platform.set(this.origPlatform());
  }
  protected resetPayout() {
    this.minWithdraw.set(this.origMinWithdraw());
  }

  protected saveSplit() {
    this.savingSplit.set(true);
    const p = this.platform();
    forkJoin([
      this.api.updateConfig('platform-commission-percent', String(p)),
      this.api.updateConfig('seller-commission-percent', String(100 - p)),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingSplit.set(false);
          this.origPlatform.set(p);
          this.toast.success(`Split saved — platform ${p}% · seller ${100 - p}%`);
        },
        error: () => this.savingSplit.set(false),
      });
  }

  protected savePayout() {
    const m = this.minWithdraw();
    if (!(m >= 1)) {
      this.toast.error('Minimum withdrawal must be at least ₹1');
      return;
    }
    this.savingPayout.set(true);
    this.api
      .updateConfig('min-withdraw', String(m))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingPayout.set(false);
          this.origMinWithdraw.set(m);
          this.toast.success(`Minimum withdrawal set to ₹${m.toLocaleString('en-IN')}`);
        },
        error: () => this.savingPayout.set(false),
      });
  }
}
