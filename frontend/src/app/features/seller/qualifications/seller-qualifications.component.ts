import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { Qualification, SellerTest, TestResult } from '@core/models';

@Component({
  selector: 'app-seller-qualifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="ql">
      <header class="ql-head">
        <div class="ql-eyebrow">seller studio</div>
        <h1 class="ql-title">Qualifications</h1>
        <p class="ql-sub">Qualify per exam category — pass its test and get your marksheet approved to sell notes there.</p>
      </header>

      @if (view() === 'test' && test(); as t) {
        <!-- ───────── Test mode ───────── -->
        <div class="ql-test">
          <div class="ql-test-bar">
            <div><div class="ql-test-cat">{{ t.categoryName }} qualification test</div><div class="ql-test-meta">{{ t.questions.length }} questions · pass {{ t.passScore }}%</div></div>
            <div class="ql-timer" [class.low]="timeLeft() <= 60">⏱ {{ mmss() }}</div>
          </div>
          <div class="ql-progress"><i [style.width.%]="answeredPct()"></i></div>
          <div class="ql-test-prog">{{ answeredCount() }} of {{ t.questions.length }} answered</div>

          @for (q of t.questions; track q.id; let i = $index) {
            <div class="ql-q">
              <div class="ql-q-num">{{ i + 1 }}@if (q.subject) { <span>· {{ q.subject }}</span> }</div>
              <div class="ql-q-text">{{ q.questionText }}</div>
              @for (o of q.options; track o.optionKey) {
                <label class="ql-opt" [class.on]="answers()[q.id] === o.optionKey">
                  <input type="radio" [name]="'q' + q.id" [checked]="answers()[q.id] === o.optionKey" (change)="pick(q.id, o.optionKey)" />
                  <span class="ql-opt-k">{{ o.optionKey }}</span><span>{{ o.optionText }}</span>
                </label>
              }
            </div>
          }
          <div class="ql-test-foot">
            <button class="ql-btn ghost" (click)="cancelTest()">Cancel</button>
            <button class="ql-btn primary" [disabled]="submitting()" (click)="submit()">
              {{ submitting() ? 'Submitting…' : 'Submit test' }}
            </button>
          </div>
        </div>
      } @else {
        <!-- ───────── List mode ───────── -->
        @if (loading()) {
          <div class="ql-grid"><div class="ql-skel"></div><div class="ql-skel"></div><div class="ql-skel"></div></div>
        } @else {
          <div class="ql-grid">
            @for (q of quals(); track q.categoryId) {
              <div class="ql-card" [class]="cardClass(q.status)">
                <div class="ql-card-top">
                  <span class="ql-card-name">{{ q.categoryName }}</span>
                  <span class="ql-badge" [class]="badgeClass(q.status, q.testAvailable)">{{ statusLabel(q.status, q.testAvailable) }}</span>
                </div>
                <div class="ql-card-meta">
                  @if (q.bestScore > 0) { <span>Best {{ q.bestScore }}%</span><span class="ql-dot">·</span> }
                  <span>Pass {{ q.passScore }}%</span>
                  @if (q.attemptsLeft !== null) { <span class="ql-dot">·</span><span>{{ q.attemptsLeft }} attempts left</span> }
                </div>
                @if (q.status === 'REJECTED' && q.rejectionReason) {
                  <div class="ql-reject">Rejected: {{ q.rejectionReason }}</div>
                }
                <div class="ql-card-action">
                  @switch (q.status) {
                    @case ('APPROVED') { <span class="ql-done">✓ You can sell here</span> }
                    @case ('PENDING_REVIEW') { <span class="ql-muted">Marksheet under admin review…</span> }
                    @case ('AWAITING_MARKSHEET') {
                      <button class="ql-btn primary sm" [disabled]="busyId() === q.categoryId" (click)="pickMarksheet(q.categoryId)">Upload marksheet</button>
                    }
                    @case ('REJECTED') {
                      <button class="ql-btn primary sm" [disabled]="busyId() === q.categoryId" (click)="pickMarksheet(q.categoryId)">Re-upload marksheet</button>
                    }
                    @default {
                      @if (!q.testAvailable) {
                        <span class="ql-muted">Test not available yet</span>
                      } @else if (q.attemptsLeft === 0) {
                        <span class="ql-muted">No attempts left</span>
                      } @else {
                        <button class="ql-btn primary sm" (click)="startTest(q)">{{ q.status === 'TEST_FAILED' ? 'Retake test' : 'Take test' }}</button>
                      }
                    }
                  }
                </div>
              </div>
            } @empty {
              <p class="ql-none">No exam categories available yet.</p>
            }
          </div>
        }
      }
    </div>

    <input #ms type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden (change)="onMarksheet($any($event.target).files)" />

    <!-- Result modal -->
    @if (result(); as r) {
      <div class="ql-scrim" (click)="closeResult()">
        <div class="ql-modal" (click)="$event.stopPropagation()">
          <div class="ql-result-ic" [class.pass]="r.passed" [class.fail]="!r.passed">{{ r.passed ? '🎉' : '✗' }}</div>
          <h3>{{ r.passed ? 'Passed!' : 'Not quite' }}</h3>
          <div class="ql-result-score">{{ r.score }}%</div>
          <p class="ql-result-msg">{{ r.message }}</p>
          <button class="ql-btn primary" (click)="closeResult()">{{ r.passed ? 'Continue' : 'Back' }}</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .ql { max-width: 1080px; margin: 0 auto; font-family: 'Instrument Sans', system-ui, sans-serif; color: #16141e; }
      .ql-eyebrow { font-family: 'Caveat', cursive; font-size: 22px; font-weight: 600; color: #5840e0; }
      .ql-title { margin: 2px 0 6px; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 38px; letter-spacing: -0.03em; }
      .ql-sub { margin: 0 0 24px; font-size: 15px; color: #5b5870; }

      .ql-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
      .ql-card { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; padding: 18px 20px; }
      .ql-card.approved { border-color: #c4ecd5; background: #f6fdf9; }
      .ql-card.review { border-color: #cfe0ff; }
      .ql-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
      .ql-card-name { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 700; font-size: 17px; }
      .ql-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; white-space: nowrap; }
      .ql-badge.ok { background: #eafaf0; color: #1a9e5f; }
      .ql-badge.review { background: #eef4ff; color: #2563eb; }
      .ql-badge.wait { background: #fff3e0; color: #c47f17; }
      .ql-badge.fail { background: #fdeceb; color: #d8453b; }
      .ql-badge.new { background: #efebff; color: #5840e0; }
      .ql-badge.lock { background: #f0ede4; color: #8b879a; }
      .ql-card-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 13px; color: #8b879a; margin-bottom: 12px; }
      .ql-dot { color: #c5bfd8; }
      .ql-reject { font-size: 12.5px; color: #d8453b; background: #fdeceb; border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; }
      .ql-card-action { margin-top: 6px; }
      .ql-done { font-size: 13.5px; font-weight: 700; color: #1a9e5f; }
      .ql-muted { font-size: 13px; color: #a8a4b8; }

      .ql-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; cursor: pointer; font: inherit; font-weight: 700; border-radius: 99px; padding: 11px 22px; font-size: 14px; transition: background .16s, border-color .16s, color .16s; }
      .ql-btn.sm { padding: 9px 18px; font-size: 13.5px; }
      .ql-btn.primary { background: #16141e; color: #fff; }
      .ql-btn.primary:hover:not(:disabled) { background: #5840e0; }
      .ql-btn.ghost { background: #fff; border: 1px solid #e2decf; color: #4b4860; }
      .ql-btn.ghost:hover:not(:disabled) { border-color: #5840e0; color: #5840e0; }
      .ql-btn:disabled { opacity: .55; cursor: default; }
      .ql-none { color: #8b879a; font-size: 15px; }

      /* Test mode */
      .ql-test { background: #fff; border: 1px solid #e9e5d8; border-radius: 18px; padding: 22px 24px; }
      .ql-test-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .ql-test-cat { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 700; font-size: 18px; }
      .ql-test-meta { font-size: 13px; color: #8b879a; margin-top: 2px; }
      .ql-timer { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 20px; background: #f0ede4; padding: 8px 16px; border-radius: 99px; }
      .ql-timer.low { background: #fdeceb; color: #d8453b; }
      .ql-progress { height: 6px; border-radius: 99px; background: #ece8dd; overflow: hidden; margin: 16px 0 6px; }
      .ql-progress i { display: block; height: 100%; background: #5840e0; transition: width .2s; }
      .ql-test-prog { font-size: 12.5px; color: #8b879a; margin-bottom: 18px; }
      .ql-q { border-top: 1px solid #f0ede2; padding: 18px 0; }
      .ql-q-num { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #8b879a; margin-bottom: 8px; }
      .ql-q-num span { color: #5840e0; }
      .ql-q-text { font-size: 16px; font-weight: 600; margin-bottom: 14px; }
      .ql-opt { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid #e9e5d8; border-radius: 12px; margin-bottom: 8px; cursor: pointer; font-size: 14.5px; transition: border-color .14s, background .14s; }
      .ql-opt:hover { border-color: #c9c2ad; }
      .ql-opt.on { border-color: #5840e0; background: #f7f5ff; }
      .ql-opt input { accent-color: #5840e0; width: 16px; height: 16px; }
      .ql-opt-k { width: 24px; height: 24px; border-radius: 7px; background: #ece8dd; display: grid; place-items: center; font-size: 12px; font-weight: 700; flex: none; }
      .ql-opt.on .ql-opt-k { background: #5840e0; color: #fff; }
      .ql-test-foot { display: flex; justify-content: space-between; margin-top: 18px; }

      .ql-skel { height: 150px; border-radius: 16px; background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%); background-size: 200% 100%; animation: qlShimmer 1.3s infinite; }
      @keyframes qlShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

      .ql-scrim { position: fixed; inset: 0; background: rgba(22,20,30,.55); display: grid; place-items: center; z-index: 100; padding: 24px; }
      .ql-modal { background: #fff; border-radius: 20px; padding: 32px; width: min(420px, 100%); text-align: center; }
      .ql-result-ic { width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center; font-size: 30px; margin: 0 auto 12px; }
      .ql-result-ic.pass { background: #eafaf0; }
      .ql-result-ic.fail { background: #fdeceb; }
      .ql-modal h3 { margin: 0 0 4px; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 24px; }
      .ql-result-score { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 40px; letter-spacing: -0.02em; }
      .ql-result-msg { margin: 6px 0 20px; font-size: 14.5px; color: #5b5870; }

      @media (max-width: 560px) { .ql-title { font-size: 30px; } }
    `,
  ],
})
export class SellerQualificationsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected quals = signal<Qualification[]>([]);
  protected loading = signal(true);
  protected busyId = signal<number | null>(null);

  protected view = signal<'list' | 'test'>('list');
  protected test = signal<SellerTest | null>(null);
  protected answers = signal<Record<number, string>>({});
  protected submitting = signal(false);
  protected result = signal<TestResult | null>(null);
  protected timeLeft = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;
  private marksheetCatId: number | null = null;

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  private load() {
    this.loading.set(true);
    this.api.getMyQualifications().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.quals.set(r.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── Take test ─────────────────────────────────────────────
  protected startTest(q: Qualification) {
    this.api.startCategoryTest(q.categoryId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        const t = r.data;
        if (!t) return;
        this.test.set(t);
        this.answers.set({});
        this.view.set('test');
        this.startTimer(t.timeLimitMinutes * 60);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {},
    });
  }
  protected pick(qId: number, key: string) {
    this.answers.update((a) => ({ ...a, [qId]: key }));
  }
  protected answeredCount() { return Object.keys(this.answers()).length; }
  protected answeredPct() {
    const total = this.test()?.questions.length || 1;
    return Math.round((this.answeredCount() / total) * 100);
  }
  protected mmss() {
    const s = this.timeLeft();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  protected cancelTest() {
    this.stopTimer();
    this.test.set(null);
    this.view.set('list');
  }
  protected submit() {
    const t = this.test();
    if (!t || this.submitting()) return;
    this.submitting.set(true);
    this.stopTimer();
    this.api.submitCategoryTest(t.categoryId, this.answers()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.submitting.set(false);
        this.result.set(r.data ?? null);
        this.test.set(null);
        this.view.set('list');
        this.load();
      },
      error: () => this.submitting.set(false),
    });
  }
  protected closeResult() {
    const r = this.result();
    this.result.set(null);
    if (r?.passed) this.toast.success('Now upload your marksheet to finish qualifying.');
  }

  private startTimer(seconds: number) {
    this.stopTimer();
    this.timeLeft.set(seconds > 0 ? seconds : 0);
    if (seconds <= 0) return; // 0 = no limit
    this.timer = setInterval(() => {
      this.timeLeft.update((s) => s - 1);
      if (this.timeLeft() <= 0) { this.stopTimer(); this.submit(); }
    }, 1000);
  }
  private stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  // ── Marksheet ─────────────────────────────────────────────
  protected pickMarksheet(categoryId: number) {
    this.marksheetCatId = categoryId;
    (document.querySelector('input[type=file]') as HTMLInputElement)?.click();
  }
  protected onMarksheet(files: FileList | null) {
    const f = files?.[0];
    const catId = this.marksheetCatId;
    if (!f || catId == null) return;
    if (f.size > 5 * 1048576) { this.toast.error('Marksheet must be under 5MB.'); return; }
    const fd = new FormData();
    fd.append('marksheet', f);
    this.busyId.set(catId);
    this.api.uploadQualificationMarksheet(catId, fd).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.toast.success('Marksheet uploaded — awaiting admin review.'); this.busyId.set(null); this.load(); },
      error: () => this.busyId.set(null),
    });
  }

  // ── Display helpers ───────────────────────────────────────
  protected statusLabel(status: string | null, testAvailable: boolean): string {
    switch (status) {
      case 'APPROVED': return 'Qualified';
      case 'PENDING_REVIEW': return 'In review';
      case 'AWAITING_MARKSHEET': return 'Passed — upload marksheet';
      case 'REJECTED': return 'Rejected';
      case 'TEST_FAILED': return 'Retake available';
      default: return testAvailable ? 'Not started' : 'Locked';
    }
  }
  protected badgeClass(status: string | null, testAvailable: boolean): string {
    switch (status) {
      case 'APPROVED': return 'ok';
      case 'PENDING_REVIEW': return 'review';
      case 'AWAITING_MARKSHEET': return 'wait';
      case 'REJECTED': case 'TEST_FAILED': return 'fail';
      default: return testAvailable ? 'new' : 'lock';
    }
  }
  protected cardClass(status: string | null): string {
    return status === 'APPROVED' ? 'approved' : status === 'PENDING_REVIEW' ? 'review' : '';
  }
}
