import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { QualificationReview } from '@core/models';
import { initials } from '@shared/util/note-display';

@Component({
  selector: 'app-admin-verifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="vf">
      <header class="vf-head">
        <div class="vf-eyebrow">admin console</div>
        <h1 class="vf-title">Verifications</h1>
        <p class="vf-sub">
          @if (loading()) {
            Loading…
          } @else {
            <b>{{ pending().length }}</b> per-category {{ pending().length === 1 ? 'qualification' : 'qualifications' }} awaiting review.
          }
        </p>
      </header>

      @if (loading()) {
        <div class="vf-grid">
          @for (s of [1, 2]; track s) { <div class="vf-skel"></div> }
        </div>
      } @else if (pending().length === 0) {
        <div class="vf-empty">
          <div class="vf-empty-ic">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="m5 13 4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h3>No pending verifications 🎉</h3>
          <p>You're all caught up. When a seller passes a category test and uploads a marksheet, it appears here.</p>
        </div>
      } @else {
        <div class="vf-grid">
          @for (p of pending(); track p.id) {
            <div class="vf-card">
              <div class="vf-top">
                <span class="vf-av">{{ initials(p.sellerName) }}</span>
                <div class="vf-id">
                  <div class="vf-name">{{ p.sellerName }}</div>
                  <div class="vf-inst">{{ p.institution || 'No institution given' }}</div>
                  <div class="vf-chips">
                    <span class="vf-chip cat">Qualifying: {{ p.categoryName }}</span>
                    <span class="vf-chip" [class.ok]="p.bestScore >= 60">Scored {{ p.bestScore }}%</span>
                  </div>
                </div>
              </div>

              <div class="vf-meta">
                <div><span>Email</span><b>{{ p.email }}</b></div>
                <div><span>Submitted</span><b>{{ p.submittedAt ? (p.submittedAt | date: 'd MMM y, h:mm a') : '—' }}</b></div>
              </div>

              <div class="vf-ms-label">Marksheet</div>
              @if (p.marksheetUrl) {
                <button type="button" class="vf-ms" (click)="lightbox.set(p.marksheetUrl!)">
                  <img [src]="p.marksheetUrl" alt="Marksheet for {{ p.sellerName }}" loading="lazy" />
                  <span class="vf-ms-zoom">Click to enlarge</span>
                </button>
              } @else {
                <div class="vf-ms vf-ms-missing">No marksheet uploaded</div>
              }

              <div class="vf-actions">
                <button class="vf-btn reject" [disabled]="busyId() === p.id" (click)="openReject(p)">Reject</button>
                <button class="vf-btn approve" [disabled]="busyId() === p.id" (click)="approve(p)">
                  {{ busyId() === p.id ? 'Approving…' : 'Approve for ' + p.categoryName }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (lightbox(); as url) {
      <div class="vf-lb" (click)="lightbox.set(null)">
        <img [src]="url" alt="Marksheet full view" (click)="$event.stopPropagation()" />
        <button class="vf-lb-x" (click)="lightbox.set(null)">×</button>
      </div>
    }

    @if (rejecting(); as r) {
      <div class="vf-modal-scrim" (click)="rejecting.set(null)">
        <div class="vf-modal" (click)="$event.stopPropagation()">
          <h3>Reject {{ r.categoryName }} qualification</h3>
          <p class="vf-modal-sub">Rejecting <b>{{ r.sellerName }}</b>. Give a reason — they'll see it and can re-submit.</p>
          <textarea class="vf-textarea" [class.err]="reasonError()" [value]="reason()" (input)="reason.set($any($event.target).value)"
            placeholder="e.g. Marksheet image is blurry / doesn't match the category…"></textarea>
          @if (reasonError()) { <div class="vf-err">A reason is required.</div> }
          <div class="vf-modal-foot">
            <button class="vf-btn ghost" (click)="rejecting.set(null)">Cancel</button>
            <button class="vf-btn reject" (click)="confirmReject()">Reject</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .vf { max-width: 1100px; margin: 0 auto; font-family: 'Instrument Sans', system-ui, sans-serif; color: #16141e; }
      .vf-eyebrow { font-family: 'Caveat', cursive; font-size: 22px; font-weight: 600; color: #5840e0; }
      .vf-title { margin: 2px 0 6px; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 38px; letter-spacing: -0.03em; }
      .vf-sub { margin: 0 0 24px; font-size: 15px; color: #5b5870; }
      .vf-sub b { color: #16141e; }

      .vf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px; }
      .vf-card { background: #fff; border: 1px solid #e9e5d8; border-radius: 18px; padding: 22px; }
      .vf-top { display: flex; gap: 14px; margin-bottom: 16px; }
      .vf-av { width: 52px; height: 52px; border-radius: 99px; background: #efebff; color: #5840e0; display: grid; place-items: center; font-weight: 800; font-size: 17px; flex: none; }
      .vf-name { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 700; font-size: 18px; }
      .vf-inst { font-size: 13.5px; color: #8b879a; margin-top: 1px; }
      .vf-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
      .vf-chip { font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: #f0ede4; color: #5b5870; }
      .vf-chip.cat { background: #efebff; color: #5840e0; }
      .vf-chip.ok { background: #eafaf0; color: #1a9e5f; }

      .vf-meta { display: flex; flex-direction: column; gap: 7px; padding: 12px 14px; background: #fbfaf6; border-radius: 12px; margin-bottom: 14px; }
      .vf-meta > div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
      .vf-meta span { color: #8b879a; }
      .vf-meta b { color: #16141e; font-weight: 600; text-align: right; word-break: break-all; }

      .vf-ms-label { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8b879a; margin-bottom: 8px; }
      .vf-ms { display: block; width: 100%; border: 1px solid #e9e5d8; border-radius: 12px; overflow: hidden; padding: 0; cursor: pointer; position: relative; background: #fbfaf6; }
      .vf-ms img { width: 100%; max-height: 260px; object-fit: cover; display: block; }
      .vf-ms-zoom { position: absolute; bottom: 8px; right: 8px; background: rgba(22,20,30,.78); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; }
      .vf-ms-missing { display: grid; place-items: center; height: 120px; color: #c47f17; font-weight: 600; font-size: 13.5px; cursor: default; background: #fff6e6; border-color: #f3e0b8; }

      .vf-actions { display: flex; gap: 10px; margin-top: 18px; }
      .vf-btn { flex: 1; border: none; cursor: pointer; font: inherit; font-weight: 700; border-radius: 99px; padding: 12px 18px; font-size: 14px; transition: background .16s, color .16s, border-color .16s; }
      .vf-btn.approve { background: #1a9e5f; color: #fff; }
      .vf-btn.approve:hover:not(:disabled) { background: #16864f; }
      .vf-btn.reject { background: #fff; border: 1px solid #f0d9d6; color: #d8453b; }
      .vf-btn.reject:hover:not(:disabled) { background: #fdeceb; }
      .vf-btn.ghost { background: #f0ede4; color: #4b4860; }
      .vf-btn:disabled { opacity: .55; cursor: default; }

      .vf-empty { background: #fff; border: 1px solid #e9e5d8; border-radius: 20px; padding: 64px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; }
      .vf-empty-ic { width: 64px; height: 64px; border-radius: 18px; background: #eafaf0; color: #1a9e5f; display: grid; place-items: center; margin-bottom: 8px; }
      .vf-empty h3 { margin: 0; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 24px; }
      .vf-empty p { margin: 0; color: #5b5870; font-size: 15px; max-width: 420px; }
      .vf-skel { height: 360px; border-radius: 18px; background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%); background-size: 200% 100%; animation: vfShimmer 1.3s infinite; }
      @keyframes vfShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

      .vf-lb { position: fixed; inset: 0; background: rgba(22,20,30,.85); display: grid; place-items: center; z-index: 100; padding: 32px; }
      .vf-lb img { max-width: min(900px, 92vw); max-height: 88vh; border-radius: 10px; box-shadow: 0 30px 80px rgba(0,0,0,.5); }
      .vf-lb-x { position: fixed; top: 20px; right: 24px; width: 44px; height: 44px; border-radius: 99px; border: none; background: rgba(255,255,255,.15); color: #fff; font-size: 26px; cursor: pointer; }

      .vf-modal-scrim { position: fixed; inset: 0; background: rgba(22,20,30,.5); display: grid; place-items: center; z-index: 100; padding: 24px; }
      .vf-modal { background: #fff; border-radius: 18px; padding: 24px; width: min(460px, 100%); }
      .vf-modal h3 { margin: 0 0 6px; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 700; font-size: 19px; }
      .vf-modal-sub { margin: 0 0 14px; font-size: 14px; color: #5b5870; }
      .vf-textarea { width: 100%; box-sizing: border-box; min-height: 96px; border: 1px solid #e2decf; border-radius: 12px; padding: 12px 14px; font: inherit; font-size: 14px; resize: vertical; }
      .vf-textarea:focus { outline: none; border-color: #5840e0; box-shadow: 0 0 0 3px rgba(88,64,224,.12); }
      .vf-textarea.err { border-color: #f0b4ae; }
      .vf-err { color: #d8453b; font-size: 12.5px; font-weight: 600; margin-top: 6px; }
      .vf-modal-foot { display: flex; gap: 10px; margin-top: 18px; }

      @media (max-width: 560px) { .vf-title { font-size: 30px; } .vf-grid { grid-template-columns: 1fr; } }
    `,
  ],
})
export class AdminVerificationsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected pending = signal<QualificationReview[]>([]);
  protected loading = signal(true);
  protected busyId = signal<number | null>(null);
  protected rejecting = signal<QualificationReview | null>(null);
  protected reason = signal('');
  protected reasonError = signal(false);
  protected lightbox = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api.getPendingQualifications(0).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.pending.set(r.data?.content ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected approve(p: QualificationReview) {
    this.busyId.set(p.id);
    this.api.reviewQualification(p.id, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busyId.set(null); this.toast.success(`${p.sellerName} approved for ${p.categoryName}`); this.remove(p.id); },
      error: () => this.busyId.set(null),
    });
  }
  protected openReject(p: QualificationReview) { this.rejecting.set(p); this.reason.set(''); this.reasonError.set(false); }
  protected confirmReject() {
    const p = this.rejecting();
    if (!p) return;
    if (!this.reason().trim()) { this.reasonError.set(true); return; }
    this.api.reviewQualification(p.id, false, this.reason().trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.toast.success(`${p.sellerName}'s ${p.categoryName} qualification rejected`); this.rejecting.set(null); this.remove(p.id); },
      error: () => {},
    });
  }
  private remove(id: number) { this.pending.update((l) => l.filter((x) => x.id !== id)); }

  protected readonly initials = initials;
}
