import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { PendingNote } from '@core/models';
import { initials, rupee } from '@shared/util/note-display';

@Component({
  selector: 'app-admin-note-approvals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="na">
      <header class="na-head">
        <div class="na-eyebrow">admin console</div>
        <h1 class="na-title">Note approvals</h1>
        <p class="na-sub">
          @if (loading()) {
            Loading…
          } @else {
            <b>{{ pending().length }}</b> {{ pending().length === 1 ? 'note' : 'notes' }} awaiting content review.
          }
        </p>
      </header>

      @if (loading()) {
        <div class="na-grid">
          @for (s of [1, 2]; track s) {
            <div class="na-skel"></div>
          }
        </div>
      } @else if (pending().length === 0) {
        <div class="na-empty">
          <div class="na-empty-ic">✓</div>
          <h3>No notes to review 🎉</h3>
          <p>When a seller uploads a note, it appears here for content review before going live.</p>
        </div>
      } @else {
        <div class="na-grid">
          @for (n of pending(); track n.id) {
            <div class="na-card">
              <div class="na-top">
                @if (n.thumbnailUrl) {
                  <img class="na-thumb" [src]="n.thumbnailUrl" alt="" loading="lazy" />
                } @else {
                  <div class="na-thumb na-thumb-ph">PDF</div>
                }
                <div class="na-id">
                  <div class="na-name">{{ n.title }}</div>
                  <div class="na-by">
                    <span class="na-av">{{ initials(n.sellerName) }}</span> {{ n.sellerName }}
                  </div>
                  <div class="na-chips">
                    <span class="na-chip cat">{{ n.category }}</span>
                    @if (n.exam) {
                      <span class="na-chip">{{ n.exam }}</span>
                    }
                    @if (n.subject) {
                      <span class="na-chip">{{ n.subject }}</span>
                    }
                    <span class="na-chip">{{ rupee(n.price) }}</span>
                  </div>
                </div>
              </div>

              @if (n.description) {
                <p class="na-desc">{{ n.description }}</p>
              }

              <div class="na-meta">
                <span>{{ n.totalPages || '—' }} pages · {{ n.sellerEmail }}</span>
                <span>{{ n.createdAt ? (n.createdAt | date: 'd MMM y, h:mm a') : '' }}</span>
              </div>

              @if (n.pdfUrl) {
                <a class="na-open" [href]="n.pdfUrl" target="_blank" rel="noopener">📄 Open the full PDF to review</a>
              }

              <div class="na-actions">
                <button class="na-btn reject" [disabled]="busyId() === n.id" (click)="openReject(n)">Reject</button>
                <button class="na-btn approve" [disabled]="busyId() === n.id" (click)="approve(n)">
                  {{ busyId() === n.id ? 'Approving…' : 'Approve & publish' }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (rejecting(); as r) {
      <div class="na-scrim" (click)="rejecting.set(null)">
        <div class="na-modal" (click)="$event.stopPropagation()">
          <h3>Reject "{{ r.title }}"</h3>
          <p class="na-modal-sub">
            Rejecting <b>{{ r.sellerName }}</b
            >'s note. Give a reason — they'll see it and can edit & resubmit.
          </p>
          <textarea
            class="na-textarea"
            [class.err]="reasonError()"
            [value]="reason()"
            (input)="reason.set($any($event.target).value)"
            placeholder="e.g. Looks like copyrighted coaching material / not your own work / blurry scans…"
          ></textarea>
          @if (reasonError()) {
            <div class="na-err">A reason is required.</div>
          }
          <div class="na-modal-foot">
            <button class="na-btn ghost" (click)="rejecting.set(null)">Cancel</button>
            <button class="na-btn reject" (click)="confirmReject()">Reject note</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .na {
        max-width: 1100px;
        margin: 0 auto;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        color: #16141e;
      }
      .na-eyebrow {
        font-family: 'Caveat', cursive;
        font-size: 22px;
        font-weight: 600;
        color: #5840e0;
      }
      .na-title {
        margin: 2px 0 6px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 38px;
        letter-spacing: -0.03em;
      }
      .na-sub {
        margin: 0 0 24px;
        font-size: 15px;
        color: #5b5870;
      }
      .na-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
        gap: 20px;
      }
      .na-card {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 18px;
        padding: 20px;
      }
      .na-top {
        display: flex;
        gap: 14px;
      }
      .na-thumb {
        width: 76px;
        height: 76px;
        border-radius: 12px;
        object-fit: cover;
        flex: none;
        background: #f0ede4;
      }
      .na-thumb-ph {
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 800;
        color: #d8453b;
        background: #fdeceb;
      }
      .na-name {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 700;
        font-size: 16.5px;
        line-height: 1.25;
      }
      .na-by {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #5b5870;
        margin-top: 4px;
      }
      .na-av {
        width: 20px;
        height: 20px;
        border-radius: 99px;
        background: #efebff;
        color: #5840e0;
        display: grid;
        place-items: center;
        font-size: 9px;
        font-weight: 800;
      }
      .na-chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .na-chip {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 99px;
        background: #f0ede4;
        color: #5b5870;
      }
      .na-chip.cat {
        background: #efebff;
        color: #5840e0;
      }
      .na-desc {
        margin: 14px 0 0;
        font-size: 13.5px;
        line-height: 1.5;
        color: #3e3b52;
        max-height: 60px;
        overflow: hidden;
      }
      .na-meta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 12px;
        font-size: 12px;
        color: #8b879a;
      }
      .na-open {
        display: block;
        margin-top: 12px;
        text-align: center;
        text-decoration: none;
        font-weight: 700;
        font-size: 13.5px;
        color: #2563eb;
        background: #eef4ff;
        border: 1px solid #cfe0ff;
        border-radius: 10px;
        padding: 10px;
      }
      .na-open:hover {
        background: #e3edff;
      }
      .na-actions {
        display: flex;
        gap: 10px;
        margin-top: 16px;
      }
      .na-btn {
        flex: 1;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        border-radius: 99px;
        padding: 12px 18px;
        font-size: 14px;
      }
      .na-btn.approve {
        background: #1a9e5f;
        color: #fff;
      }
      .na-btn.approve:hover:not(:disabled) {
        background: #16864f;
      }
      .na-btn.reject {
        background: #fff;
        border: 1px solid #f0d9d6;
        color: #d8453b;
      }
      .na-btn.reject:hover:not(:disabled) {
        background: #fdeceb;
      }
      .na-btn.ghost {
        background: #f0ede4;
        color: #4b4860;
      }
      .na-btn:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .na-empty {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 20px;
        padding: 64px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 6px;
      }
      .na-empty-ic {
        width: 64px;
        height: 64px;
        border-radius: 18px;
        background: #eafaf0;
        color: #1a9e5f;
        display: grid;
        place-items: center;
        font-size: 28px;
        margin-bottom: 8px;
      }
      .na-empty h3 {
        margin: 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 24px;
      }
      .na-empty p {
        margin: 0;
        color: #5b5870;
        font-size: 15px;
        max-width: 420px;
      }
      .na-skel {
        height: 240px;
        border-radius: 18px;
        background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%);
        background-size: 200% 100%;
        animation: naShimmer 1.3s infinite;
      }
      @keyframes naShimmer {
        from {
          background-position: 200% 0;
        }
        to {
          background-position: -200% 0;
        }
      }
      .na-scrim {
        position: fixed;
        inset: 0;
        background: rgba(22, 20, 30, 0.5);
        display: grid;
        place-items: center;
        z-index: 100;
        padding: 24px;
      }
      .na-modal {
        background: #fff;
        border-radius: 18px;
        padding: 24px;
        width: min(460px, 100%);
      }
      .na-modal h3 {
        margin: 0 0 6px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 700;
        font-size: 19px;
      }
      .na-modal-sub {
        margin: 0 0 14px;
        font-size: 14px;
        color: #5b5870;
      }
      .na-textarea {
        width: 100%;
        box-sizing: border-box;
        min-height: 96px;
        border: 1px solid #e2decf;
        border-radius: 12px;
        padding: 12px 14px;
        font: inherit;
        font-size: 14px;
        resize: vertical;
      }
      .na-textarea:focus {
        outline: none;
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }
      .na-textarea.err {
        border-color: #f0b4ae;
      }
      .na-err {
        color: #d8453b;
        font-size: 12.5px;
        font-weight: 600;
        margin-top: 6px;
      }
      .na-modal-foot {
        display: flex;
        gap: 10px;
        margin-top: 18px;
      }
      @media (max-width: 560px) {
        .na-title {
          font-size: 30px;
        }
        .na-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminNoteApprovalsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected pending = signal<PendingNote[]>([]);
  protected loading = signal(true);
  protected busyId = signal<number | null>(null);
  protected rejecting = signal<PendingNote | null>(null);
  protected reason = signal('');
  protected reasonError = signal(false);

  protected readonly initials = initials;
  protected readonly rupee = rupee;

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api
      .getPendingNotes(0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.pending.set(r.data?.content ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected approve(n: PendingNote) {
    this.busyId.set(n.id);
    this.api
      .reviewNote(n.id, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.toast.success(`"${n.title}" approved & live`);
          this.remove(n.id);
        },
        error: () => this.busyId.set(null),
      });
  }

  protected openReject(n: PendingNote) {
    this.rejecting.set(n);
    this.reason.set('');
    this.reasonError.set(false);
  }
  protected confirmReject() {
    const n = this.rejecting();
    if (!n) return;
    if (!this.reason().trim()) {
      this.reasonError.set(true);
      return;
    }
    this.api
      .reviewNote(n.id, false, this.reason().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(`"${n.title}" rejected`);
          this.rejecting.set(null);
          this.remove(n.id);
        },
        error: () => {},
      });
  }

  private remove(id: number) {
    this.pending.update((l) => l.filter((x) => x.id !== id));
  }
}
