import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { ConfirmService } from '@core/services/confirm.service';
import { PendingNote } from '@core/models';
import { initials, rupee } from '@shared/util/note-display';

type RiskLevel = 'low' | 'medium' | 'high';

@Component({
  selector: 'app-admin-note-approvals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="na">
      <header class="na-head">
        <div class="na-eyebrow">admin console</div>
        <div class="na-headrow">
          <h1 class="na-title">Note approvals</h1>
          <button class="na-refresh" (click)="refresh()" [disabled]="loading()" title="Refresh the queue">
            ⟳ Refresh
          </button>
        </div>
        <p class="na-sub">
          @if (loading()) {
            Loading…
          } @else {
            <b>{{ pending().length }}</b> {{ pending().length === 1 ? 'note' : 'notes' }} in queue.
            @if (pending().length) {
              <span class="na-hint">· <b>J</b>/<b>K</b> move · <b>A</b> approve · <b>R</b> reject</span>
            }
          }
        </p>
      </header>

      @if (loading()) {
        <div class="na-console">
          <div class="na-list">
            @for (s of [1, 2, 3, 4]; track s) {
              <div class="na-skel sm"></div>
            }
          </div>
          <div class="na-skel"></div>
        </div>
      } @else if (pending().length === 0) {
        <div class="na-empty">
          <div class="na-empty-ic">✓</div>
          <h3>No notes to review 🎉</h3>
          <p>When a seller uploads a note, it appears here for content review before going live.</p>
        </div>
      } @else {
        <!-- Toolbar: search · category · flagged · sort -->
        <div class="na-toolbar">
          <input
            class="na-search"
            type="search"
            placeholder="Search title or seller…"
            [ngModel]="q()"
            (ngModelChange)="q.set($event)"
          />
          <select class="na-sel" [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event)">
            <option value="">All categories</option>
            @for (c of categories(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
          <select class="na-sel" [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)">
            <option value="oldest">Oldest first</option>
            <option value="risk">Riskiest first</option>
          </select>
          <label class="na-flag">
            <input type="checkbox" [ngModel]="flaggedOnly()" (ngModelChange)="flaggedOnly.set($event)" />
            <span>🚩 Flagged only</span>
          </label>
        </div>

        <div class="na-console">
          <!-- LEFT: dense list -->
          <div class="na-list">
            @for (n of filtered(); track n.id) {
              <button class="na-item" [class.on]="selected()?.id === n.id" (click)="select(n)">
                <span class="na-dot" [class]="risk(n).level"></span>
                @if (n.thumbnailUrl) {
                  <img class="na-ithumb" [src]="n.thumbnailUrl" alt="" loading="lazy" />
                } @else {
                  <span class="na-ithumb ph">PDF</span>
                }
                <span class="na-itext">
                  <span class="na-ititle">{{ n.title }}</span>
                  <span class="na-iby">{{ n.sellerName }} · waiting {{ waitingLabel(n.createdAt) }}</span>
                </span>
                @if (risk(n).level === 'high') {
                  <span class="na-iflag">🚩</span>
                }
              </button>
            } @empty {
              <p class="na-nomatch">No notes match these filters.</p>
            }

            @if (hasMore() && !isFiltering()) {
              <button class="na-loadmore" [disabled]="loadingMore()" (click)="loadMore()">
                {{ loadingMore() ? 'Loading…' : 'Load more' }}
              </button>
            }
          </div>

          <!-- RIGHT: detail / review pane -->
          @if (selected(); as n) {
            <div class="na-detail">
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

              <div class="na-signals">
                @if (n.originalityDeclared) {
                  <span
                    class="na-sig ok"
                    [title]="
                      n.originalityDeclaredAt ? 'Declared ' + (n.originalityDeclaredAt | date: 'd MMM y, h:mm a') : ''
                    "
                    >✓ Originality declared</span
                  >
                } @else {
                  <span class="na-sig bad">✗ No originality declaration</span>
                }
                @if (n.sellerApprovedCount || n.sellerRejectedCount) {
                  <span class="na-sig" [class.warn]="n.sellerRejectedCount">
                    {{ n.sellerApprovedCount || 0 }} approved · {{ n.sellerRejectedCount || 0 }} rejected
                  </span>
                } @else {
                  <span class="na-sig">New seller · first submission</span>
                }
                @if (categoryMismatch(n)) {
                  <span class="na-sig bad">⚠ “{{ n.category }}” ≠ qualified “{{ n.sellerQualifiedCategory }}”</span>
                } @else if (n.sellerQualifiedCategory) {
                  <span class="na-sig ok">✓ Qualified in {{ n.sellerQualifiedCategory }}</span>
                }
              </div>

              @if (n.description) {
                <p class="na-desc">{{ n.description }}</p>
              }
              @if (riskTerms(n.description).length) {
                <div class="na-risk">
                  ⚠ Mentions <b>{{ riskTerms(n.description).join(', ') }}</b> — check it isn't copyrighted / coaching
                  material.
                </div>
              }

              <div class="na-meta">
                <span>{{ n.totalPages || '—' }} pages · {{ n.sellerEmail }}</span>
                <span class="na-wait" [class.urgent]="waitDays(n.createdAt) > 2">
                  waiting {{ waitingLabel(n.createdAt) }}
                </span>
              </div>

              @if (n.pdfUrl) {
                <div class="na-pdfbar">
                  <button class="na-open" [disabled]="previewLoading() === n.id" (click)="togglePreview(n)">
                    📄
                    {{
                      previewId() === n.id ? 'Hide preview' : previewLoading() === n.id ? 'Loading…' : 'Preview PDF'
                    }}
                  </button>
                  <button class="na-open ghost" (click)="openTab(n)">Open in new tab ↗</button>
                </div>
                @if (previewId() === n.id && previewSrc()) {
                  <iframe class="na-frame" [src]="previewSrc()" title="PDF preview"></iframe>
                }
              }

              <div class="na-actions">
                <button class="na-btn reject" [disabled]="busyId() === n.id" (click)="openReject(n)">Reject</button>
                <button class="na-btn approve" [disabled]="busyId() === n.id" (click)="approve(n)">
                  {{ busyId() === n.id ? 'Approving…' : 'Approve & publish' }}
                </button>
              </div>
            </div>
          } @else {
            <div class="na-detail na-detail-empty">
              <p>Select a note from the list to review it.</p>
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
          <div class="na-presets">
            @for (p of presets; track p) {
              <button class="na-preset" [class.on]="reason() === p" (click)="applyPreset(p)">{{ p }}</button>
            }
          </div>
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
        max-width: 1180px;
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
      .na-headrow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .na-title {
        margin: 2px 0 6px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 38px;
        letter-spacing: -0.03em;
      }
      .na-refresh {
        border: 1px solid #e2decf;
        background: #fff;
        border-radius: 99px;
        padding: 8px 16px;
        font: inherit;
        font-weight: 700;
        font-size: 13px;
        color: #4b4860;
        cursor: pointer;
      }
      .na-refresh:hover:not(:disabled) {
        background: #f6f4ec;
      }
      .na-refresh:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .na-sub {
        margin: 0 0 18px;
        font-size: 15px;
        color: #5b5870;
      }
      .na-hint {
        color: #8b879a;
        font-size: 13px;
      }
      .na-hint b {
        color: #5b5870;
        background: #f0ede4;
        border-radius: 5px;
        padding: 0 5px;
      }

      /* Toolbar */
      .na-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
      }
      .na-search,
      .na-sel,
      .na-flag {
        height: 42px;
        box-sizing: border-box;
        border: 1px solid #e2decf;
        border-radius: 10px;
        font: inherit;
        font-size: 14px;
        background: #fff;
        color: #16141e;
      }
      .na-search,
      .na-sel {
        padding: 0 12px;
      }
      .na-search {
        flex: 1 1 220px;
        min-width: 200px;
      }
      .na-sel {
        flex: 0 0 auto;
        min-width: 156px;
        padding-right: 34px;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b879a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
      }
      .na-search:focus,
      .na-sel:focus {
        outline: none;
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.1);
      }
      .na-flag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0 14px;
        font-size: 13.5px;
        font-weight: 600;
        color: #5b5870;
        cursor: pointer;
        white-space: nowrap;
      }
      .na-flag input {
        width: 15px;
        height: 15px;
        accent-color: #5840e0;
        cursor: pointer;
      }

      /* Two-pane console */
      .na-console {
        display: grid;
        grid-template-columns: minmax(320px, 380px) 1fr;
        gap: 20px;
        align-items: start;
      }
      .na-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: calc(100vh - 230px);
        overflow-y: auto;
        padding-right: 4px;
      }
      .na-item {
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        width: 100%;
        background: #fff;
        border: 1px solid #ece8da;
        border-radius: 12px;
        padding: 10px 12px;
        cursor: pointer;
        font: inherit;
      }
      .na-item:hover {
        background: #faf9f4;
      }
      .na-item.on {
        border-color: #5840e0;
        box-shadow: 0 0 0 2px rgba(88, 64, 224, 0.14);
      }
      .na-dot {
        width: 8px;
        height: 8px;
        border-radius: 99px;
        flex: none;
      }
      .na-dot.high {
        background: #e0463b;
      }
      .na-dot.medium {
        background: #e89a1c;
      }
      .na-dot.low {
        background: #1a9e5f;
      }
      .na-ithumb {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
        flex: none;
        background: #f0ede4;
      }
      .na-ithumb.ph {
        display: grid;
        place-items: center;
        font-size: 9px;
        font-weight: 800;
        color: #d8453b;
        background: #fdeceb;
      }
      .na-itext {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }
      .na-ititle {
        font-weight: 700;
        font-size: 13.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .na-iby {
        font-size: 11.5px;
        color: #8b879a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .na-iflag {
        font-size: 13px;
        flex: none;
      }
      .na-nomatch {
        color: #8b879a;
        font-size: 14px;
        padding: 16px 4px;
      }
      .na-loadmore {
        margin-top: 6px;
        border: 1px solid #e2decf;
        background: #f6f4ec;
        border-radius: 10px;
        padding: 10px;
        font: inherit;
        font-weight: 700;
        font-size: 13px;
        color: #4b4860;
        cursor: pointer;
      }

      /* Detail pane */
      .na-detail {
        position: sticky;
        top: 16px;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 18px;
        padding: 22px;
      }
      .na-detail-empty {
        display: grid;
        place-items: center;
        min-height: 280px;
        color: #8b879a;
        font-size: 15px;
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
        font-size: 18px;
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
      .na-signals {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 14px;
      }
      .na-sig {
        font-size: 11.5px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 8px;
        background: #f4f2ea;
        color: #5b5870;
      }
      .na-sig.ok {
        background: #eafaf0;
        color: #16864f;
      }
      .na-sig.bad {
        background: #fdeceb;
        color: #c5392f;
      }
      .na-sig.warn {
        background: #fff3e0;
        color: #b25b00;
      }
      .na-desc {
        margin: 14px 0 0;
        font-size: 13.5px;
        line-height: 1.55;
        color: #3e3b52;
        white-space: pre-wrap;
      }
      .na-risk {
        margin-top: 10px;
        font-size: 12.5px;
        line-height: 1.45;
        color: #b25b00;
        background: #fff3e0;
        border: 1px solid #ffe0b2;
        border-radius: 10px;
        padding: 9px 12px;
      }
      .na-meta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 12px;
        font-size: 12px;
        color: #8b879a;
      }
      .na-wait.urgent {
        color: #c5392f;
        font-weight: 700;
      }
      .na-pdfbar {
        display: flex;
        gap: 10px;
        margin-top: 12px;
      }
      .na-open {
        flex: 1;
        display: block;
        text-align: center;
        font-weight: 700;
        font-size: 13.5px;
        color: #2563eb;
        background: #eef4ff;
        border: 1px solid #cfe0ff;
        border-radius: 10px;
        padding: 10px;
        cursor: pointer;
        font-family: inherit;
      }
      .na-open:hover:not(:disabled) {
        background: #e3edff;
      }
      .na-open:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .na-open.ghost {
        flex: 0 0 auto;
        color: #5b5870;
        background: #f6f4ec;
        border-color: #e9e5d8;
      }
      .na-frame {
        width: 100%;
        height: 560px;
        margin-top: 10px;
        border: 1px solid #e9e5d8;
        border-radius: 12px;
        background: #f6f4ec;
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
        height: 300px;
        border-radius: 18px;
        background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%);
        background-size: 200% 100%;
        animation: naShimmer 1.3s infinite;
      }
      .na-skel.sm {
        height: 62px;
        border-radius: 12px;
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
      .na-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }
      .na-preset {
        font-size: 12px;
        font-weight: 600;
        padding: 6px 11px;
        border-radius: 99px;
        border: 1px solid #e2decf;
        background: #fff;
        color: #5b5870;
        cursor: pointer;
        font-family: inherit;
      }
      .na-preset:hover {
        background: #f6f4ec;
      }
      .na-preset.on {
        border-color: #5840e0;
        background: #efebff;
        color: #5840e0;
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
      @media (max-width: 820px) {
        .na-title {
          font-size: 30px;
        }
        .na-console {
          grid-template-columns: 1fr;
        }
        .na-list {
          max-height: none;
        }
        .na-detail {
          position: static;
        }
      }
    `,
  ],
})
export class AdminNoteApprovalsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);

  protected pending = signal<PendingNote[]>([]);
  protected loading = signal(true);
  protected loadingMore = signal(false);
  protected busyId = signal<number | null>(null);
  protected previewId = signal<number | null>(null);
  protected previewSrc = signal<SafeResourceUrl | null>(null);
  protected previewLoading = signal<number | null>(null);
  protected rejecting = signal<PendingNote | null>(null);
  protected reason = signal('');
  protected reasonError = signal(false);

  // Toolbar + selection state
  protected q = signal('');
  protected categoryFilter = signal('');
  protected flaggedOnly = signal(false);
  protected sortBy = signal<'oldest' | 'risk'>('oldest');
  protected selectedId = signal<number | null>(null);

  private page = signal(0);
  private totalPages = signal(1);
  protected hasMore = computed(() => this.page() + 1 < this.totalPages());
  protected isFiltering = computed(
    () => !!this.q().trim() || !!this.categoryFilter() || this.flaggedOnly() || this.sortBy() !== 'oldest',
  );

  protected categories = computed(() =>
    [...new Set(this.pending().map((n) => n.category).filter((c): c is string => !!c))].sort(),
  );

  protected filtered = computed(() => {
    let list = this.pending();
    const q = this.q().trim().toLowerCase();
    if (q)
      list = list.filter((n) =>
        `${n.title} ${n.sellerName} ${n.sellerEmail}`.toLowerCase().includes(q),
      );
    const cat = this.categoryFilter();
    if (cat) list = list.filter((n) => n.category === cat);
    if (this.flaggedOnly()) list = list.filter((n) => this.risk(n).level === 'high');
    const arr = [...list];
    if (this.sortBy() === 'risk') {
      arr.sort(
        (a, b) => this.risk(b).score - this.risk(a).score || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
      );
    }
    return arr; // 'oldest' keeps the backend's FIFO order
  });

  /** The note shown in the detail pane — falls back to the first in the filtered list. */
  protected selected = computed<PendingNote | null>(() => {
    const list = this.filtered();
    return list.find((n) => n.id === this.selectedId()) ?? list[0] ?? null;
  });

  /** Common rejection reasons — one click fills the textarea. */
  protected readonly presets = [
    'Looks like copyrighted / coaching material',
    'Not your own original work',
    'Blurry or low-quality scans',
    'Wrong category or mislabeled',
    'Incomplete — too few pages',
  ];

  /** Words in a description that warrant a closer copyright look. */
  private readonly RISK_TERMS = [
    'copyright',
    'all rights reserved',
    'publisher',
    'reproduced',
    'isbn',
    'coaching',
    'allen',
    'aakash',
    'byju',
    'unacademy',
    'physics wallah',
  ];

  /** Object URLs for fetched PDFs, keyed by note id (revoked on destroy). */
  private blobUrls = new Map<number, string>();

  protected readonly initials = initials;
  protected readonly rupee = rupee;

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => this.blobUrls.forEach((u) => URL.revokeObjectURL(u)));
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent) {
    if (this.rejecting()) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const cur = this.selected();
    if (!cur) return;
    const k = e.key.toLowerCase();
    if (k === 'j') {
      e.preventDefault();
      this.move(1);
    } else if (k === 'k') {
      e.preventDefault();
      this.move(-1);
    } else if (k === 'a' && !this.busyId()) {
      e.preventDefault();
      this.approve(cur);
    } else if (k === 'r' && !this.busyId()) {
      e.preventDefault();
      this.openReject(cur);
    }
  }

  private move(delta: number) {
    const list = this.filtered();
    if (!list.length) return;
    const cur = this.selected();
    const idx = cur ? list.findIndex((n) => n.id === cur.id) : -1;
    const next = list[Math.max(0, Math.min(list.length - 1, idx + delta))];
    if (next) this.select(next);
  }

  protected select(n: PendingNote) {
    this.selectedId.set(n.id);
    // Reset any open preview so the detail pane doesn't show a stale doc.
    this.previewId.set(null);
    this.previewSrc.set(null);
  }

  /** Risk heuristic used for the dot, the 🚩 flag and "riskiest first" sorting. */
  protected risk(n: PendingNote): { score: number; level: RiskLevel } {
    let score = 0;
    if (this.riskTerms(n.description).length) score += 2;
    if (!n.originalityDeclared) score += 2;
    if (this.categoryMismatch(n)) score += 2;
    if (!n.sellerApprovedCount) score += 1;
    if (n.sellerRejectedCount) score += 1;
    const level: RiskLevel = score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';
    return { score, level };
  }

  protected refresh() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.page.set(0);
    this.previewId.set(null);
    this.previewSrc.set(null);
    this.api
      .getPendingNotes(0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.pending.set(r.data?.content ?? []);
          this.totalPages.set(r.data?.totalPages ?? 1);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected loadMore() {
    const next = this.page() + 1;
    this.loadingMore.set(true);
    this.api
      .getPendingNotes(next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.pending.update((l) => [...l, ...(r.data?.content ?? [])]);
          this.page.set(next);
          this.totalPages.set(r.data?.totalPages ?? this.totalPages());
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }

  protected async approve(n: PendingNote) {
    const ok = await this.confirm.ask({
      title: 'Approve & publish?',
      message: `"${n.title}" will go live to buyers immediately.`,
      confirmText: 'Approve & publish',
    });
    if (!ok) return;
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
  protected applyPreset(p: string) {
    this.reason.set(p);
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

  /**
   * Fetch the PDF and hand back an object URL forced to `application/pdf`.
   * The stored Cloudinary file is a `raw` resource (octet-stream) which browsers
   * download instead of rendering — re-wrapping it as a typed blob makes both the
   * inline iframe and a new tab render it natively, with no repeated downloads.
   */
  private async blobUrl(n: PendingNote): Promise<string> {
    const cached = this.blobUrls.get(n.id);
    if (cached) return cached;
    const res = await fetch(n.pdfUrl!);
    if (!res.ok) throw new Error('PDF fetch failed');
    const url = URL.createObjectURL(new Blob([await res.blob()], { type: 'application/pdf' }));
    this.blobUrls.set(n.id, url);
    return url;
  }

  protected async togglePreview(n: PendingNote) {
    if (this.previewId() === n.id) {
      this.previewId.set(null);
      this.previewSrc.set(null);
      return;
    }
    this.previewLoading.set(n.id);
    try {
      const url = await this.blobUrl(n);
      this.previewSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      this.previewId.set(n.id);
    } catch {
      this.toast.error('Could not load the PDF.');
    } finally {
      this.previewLoading.set(null);
    }
  }

  protected async openTab(n: PendingNote) {
    const cached = this.blobUrls.get(n.id);
    if (cached) {
      window.open(cached, '_blank');
      return;
    }
    const w = window.open('', '_blank');
    try {
      const url = await this.blobUrl(n);
      if (w) w.location.href = url;
      else window.open(url, '_blank');
    } catch {
      w?.close();
      this.toast.error('Could not open the PDF.');
    }
  }

  /** Risky keywords present in a description (deduped, for the copyright nudge). */
  protected riskTerms(desc?: string): string[] {
    if (!desc) return [];
    const lower = desc.toLowerCase();
    return this.RISK_TERMS.filter((t) => lower.includes(t));
  }

  protected categoryMismatch(n: PendingNote): boolean {
    return (
      !!n.sellerQualifiedCategory &&
      !!n.category &&
      n.sellerQualifiedCategory.trim().toLowerCase() !== n.category.trim().toLowerCase()
    );
  }

  protected waitDays(createdAt?: string): number {
    if (!createdAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
  }
  protected waitingLabel(createdAt?: string): string {
    const d = this.waitDays(createdAt);
    return d <= 0 ? 'today' : d === 1 ? '1 day' : `${d} days`;
  }

  private remove(id: number) {
    // Pick the neighbour to auto-advance to before the list shrinks.
    const list = this.filtered();
    const idx = list.findIndex((n) => n.id === id);
    const next = list[idx + 1] ?? list[idx - 1] ?? null;

    this.pending.update((l) => l.filter((x) => x.id !== id));
    const u = this.blobUrls.get(id);
    if (u) {
      URL.revokeObjectURL(u);
      this.blobUrls.delete(id);
    }
    this.selectedId.set(next ? next.id : null);
    this.previewId.set(null);
    this.previewSrc.set(null);
  }
}
