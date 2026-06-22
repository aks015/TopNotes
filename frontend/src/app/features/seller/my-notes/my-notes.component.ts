import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { ConfirmService } from '@core/services/confirm.service';
import { Note } from '@core/models';
import { IllustrationComponent } from '@ui/illustration/illustration.component';
import { rupee, subjectGradientFlat } from '@shared/util/note-display';

@Component({
  selector: 'app-my-notes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, FormsModule, IllustrationComponent],
  template: `
    <div class="mn">
      <header class="mn-head">
        <div>
          <div class="mn-eyebrow">seller studio</div>
          <h1 class="mn-title">My notes</h1>
          <p class="mn-sub">Manage your catalogue, pricing, visibility and performance.</p>
        </div>
        <div class="mn-head-actions">
          @if (notes().length) {
            <button class="mn-btn outline" (click)="exportCsv()">Export CSV</button>
          }
          <a class="mn-btn primary" routerLink="/seller/upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            Upload new
          </a>
        </div>
      </header>

      <!-- View tabs -->
      <div class="mn-tabs">
        <button class="mn-tab" [class.on]="view() === 'catalogue'" (click)="setView('catalogue')">
          Catalogue <span class="mn-tab-n">{{ total() }}</span>
        </button>
        <button class="mn-tab" [class.on]="view() === 'trash'" (click)="setView('trash')">Trash</button>
      </div>

      @if (view() === 'catalogue') {
        <!-- Toolbar (only once the catalogue grows) -->
        @if (!loading() && total() > 5) {
          <div class="mn-tools">
            <input
              class="mn-search"
              type="search"
              placeholder="Search your notes…"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
            />
            <select
              class="mn-sel"
              [ngModel]="statusFilter()"
              (ngModelChange)="statusFilter.set($event)"
              aria-label="Status"
            >
              <option value="">All statuses</option>
              <option value="PENDING_REVIEW">In review</option>
              <option value="REJECTED">Rejected</option>
              <option value="ACTIVE">Live</option>
              <option value="INACTIVE">Hidden</option>
            </select>
            <select class="mn-sel" [ngModel]="sort()" (ngModelChange)="sort.set($event)" aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="sales">Most sales</option>
              <option value="revenue">Top revenue</option>
              <option value="views">Most views</option>
              <option value="priceHigh">Price: high → low</option>
              <option value="priceLow">Price: low → high</option>
            </select>
          </div>
        }

        @if (loading()) {
          <div class="mn-card">
            @for (s of [1, 2, 3]; track s) {
              <div class="mn-skel"></div>
            }
          </div>
        } @else if (notes().length === 0) {
          <div class="mn-empty">
            <app-illustration name="study" />
            <h3>No notes yet</h3>
            <p>Upload your first set of notes to start selling.</p>
            <a class="mn-btn primary" routerLink="/seller/upload">Upload a note</a>
          </div>
        } @else {
          <!-- Needs-attention strip -->
          @if (pendingCount() || rejectedCount()) {
            <div class="mn-attention">
              <span class="mn-att-label">Needs your attention</span>
              @if (rejectedCount()) {
                <button
                  class="mn-att-chip rej"
                  [class.on]="statusFilter() === 'REJECTED'"
                  (click)="toggleAttention('REJECTED')"
                >
                  {{ rejectedCount() }} rejected
                </button>
              }
              @if (pendingCount()) {
                <button
                  class="mn-att-chip wait"
                  [class.on]="statusFilter() === 'PENDING_REVIEW'"
                  (click)="toggleAttention('PENDING_REVIEW')"
                >
                  {{ pendingCount() }} in review
                </button>
              }
            </div>
          }

          <!-- Bulk action bar -->
          @if (selected().size) {
            <div class="mn-bulk">
              <span
                ><b>{{ selected().size }}</b> selected</span
              >
              <button class="mn-btn outline sm" [disabled]="bulkBusy()" (click)="bulkVisibility(true)">
                Publish / Submit
              </button>
              <button class="mn-btn outline sm" [disabled]="bulkBusy()" (click)="bulkVisibility(false)">Hide</button>
              <button class="mn-btn danger sm" [disabled]="bulkBusy()" (click)="bulkDelete()">Delete</button>
              <button class="mn-btn ghost sm" (click)="clearSel()">Clear</button>
            </div>
          }

          <div class="mn-card">
            <div class="mn-selrow">
              <label class="mn-check">
                <input type="checkbox" [checked]="allSelected()" (change)="toggleAll($event)" />
                <span>Select all</span>
              </label>
            </div>
            @for (n of displayed(); track n.id) {
              <div
                class="mn-row"
                [class.hidden]="n.status === 'INACTIVE'"
                [class.sel]="selected().has(n.id)"
                [class.row-review]="n.status === 'PENDING_REVIEW'"
                [class.row-rejected]="n.status === 'REJECTED'"
              >
                <label class="mn-check">
                  <input type="checkbox" [checked]="selected().has(n.id)" (change)="toggleSel(n.id)" />
                </label>
                <a
                  class="mn-cover"
                  [class.img]="n.thumbnailUrl"
                  [style.background]="n.thumbnailUrl ? null : cover(n)"
                  [routerLink]="['/notes', n.id]"
                >
                  @if (n.thumbnailUrl) {
                    <img [src]="n.thumbnailUrl" [alt]="n.title" loading="lazy" />
                  } @else {
                    <span>{{ glyph(n) }}</span>
                  }
                </a>

                <div class="mn-main">
                  <div class="mn-row-title">{{ n.title }}</div>
                  <div class="mn-meta">
                    @if (n.exam) {
                      <span>{{ n.exam }}</span>
                    }
                    @if (n.subject) {
                      <span class="mn-dot">·</span><span>{{ n.subject }}</span>
                    }
                    @if (underpriced(n)) {
                      <span class="mn-nudge" title="Similar notes sell higher"
                        >↑ underpriced · try {{ rupee(n.suggestedPrice!) }}</span
                      >
                    }
                  </div>
                  <div class="mn-status" [class]="statusClass(n.status)">
                    <span class="mn-status-dot"></span>
                    <b>{{ statusLabel(n.status) }}</b>
                    <span class="mn-status-note">{{ statusNote(n.status) }}</span>
                  </div>
                  @if (n.status === 'REJECTED' && n.rejectionReason) {
                    <div class="mn-reject-reason"><b>Reason:</b> {{ n.rejectionReason }}</div>
                  }
                  <div class="mn-analytics">
                    <span
                      ><b>{{ n.purchaseCount || 0 }}</b> sales</span
                    >
                    <span class="mn-dot">·</span>
                    <span
                      ><b>{{ n.viewCount || 0 }}</b> views</span
                    >
                    <span class="mn-dot">·</span>
                    <span>{{ conversion(n) }} conv.</span>
                    <span class="mn-dot">·</span>
                    <span
                      ><b>{{ rupee(n.revenue || 0) }}</b> earned</span
                    >
                    <span class="mn-dot">·</span>
                    <span>{{ n.reviewCount ? '★ ' + (n.averageRating || 0).toFixed(1) : 'New' }}</span>
                    @if (n.lastSoldAt) {
                      <span class="mn-dot">·</span><span>last sold {{ n.lastSoldAt | date: 'd MMM' }}</span>
                    }
                  </div>
                </div>

                <div class="mn-right">
                  @if (hasTrend(n)) {
                    <svg class="mn-spark" viewBox="0 0 88 22" preserveAspectRatio="none" aria-label="30-day sales">
                      <polyline
                        [attr.points]="spark(n.salesTrend)"
                        fill="none"
                        stroke="#5840e0"
                        stroke-width="1.6"
                        stroke-linejoin="round"
                      />
                    </svg>
                  } @else {
                    <span class="mn-spark-empty">no sales yet</span>
                  }
                  <div class="mn-price">
                    <span>₹</span>
                    <input
                      type="number"
                      [value]="n.price"
                      #pi
                      [disabled]="n.status === 'PENDING_REVIEW'"
                      (keyup.enter)="savePrice(n, pi.value)"
                      aria-label="Price"
                      [title]="n.status === 'PENDING_REVIEW' ? 'Locked while awaiting admin review' : ''"
                    />
                    <button
                      class="mn-btn ghost sm"
                      [disabled]="busyId() === n.id || n.status === 'PENDING_REVIEW'"
                      (click)="savePrice(n, pi.value)"
                    >
                      Save
                    </button>
                  </div>
                  <div class="mn-buttons">
                    @if (n.status === 'PENDING_REVIEW') {
                      <button
                        class="mn-btn outline sm"
                        disabled
                        title="Editing is locked while this note is awaiting admin review"
                      >
                        Edit
                      </button>
                    } @else {
                      <a class="mn-btn outline sm" [routerLink]="['/seller/notes', n.id, 'edit']">Edit</a>
                    }
                    @if (n.status === 'ACTIVE' || n.status === 'INACTIVE') {
                      <button class="mn-btn outline sm" [disabled]="busyId() === n.id" (click)="toggleVisibility(n)">
                        {{ n.status === 'ACTIVE' ? 'Hide' : 'Publish' }}
                      </button>
                    }
                    <button class="mn-btn danger sm" [disabled]="busyId() === n.id" (click)="remove(n)">Delete</button>
                  </div>
                </div>
              </div>
            } @empty {
              <p class="mn-nomatch">No notes match your search.</p>
            }
          </div>

          @if (hasMore() && !isFiltering()) {
            <div class="mn-more">
              <button class="mn-btn primary" [disabled]="loadingMore()" (click)="loadMore()">
                {{ loadingMore() ? 'Loading…' : 'Load more' }}
              </button>
            </div>
          }
        }
      } @else {
        <!-- Trash -->
        @if (trashLoading()) {
          <div class="mn-card">
            <div class="mn-skel"></div>
            <div class="mn-skel"></div>
          </div>
        } @else if (trash().length === 0) {
          <div class="mn-empty">
            <app-illustration name="study" />
            <h3>Trash is empty</h3>
            <p>Deleted notes appear here and can be restored.</p>
          </div>
        } @else {
          <div class="mn-card">
            @for (n of trash(); track n.id) {
              <div class="mn-row">
                <div class="mn-cover" [style.background]="cover(n)">
                  <span>{{ glyph(n) }}</span>
                </div>
                <div class="mn-main">
                  <div class="mn-row-title">{{ n.title }}</div>
                  <div class="mn-meta">
                    @if (n.exam) {
                      <span>{{ n.exam }}</span>
                    }
                    @if (n.subject) {
                      <span class="mn-dot">·</span><span>{{ n.subject }}</span>
                    }
                    <span class="mn-pill del">Deleted</span>
                  </div>
                </div>
                <div class="mn-right">
                  <button class="mn-btn primary sm" [disabled]="busyId() === n.id" (click)="restore(n)">Restore</button>
                </div>
              </div>
            }
          </div>
          <p class="mn-trash-note">Restored notes return as <b>Hidden</b> — publish them again from your catalogue.</p>
        }
      }
    </div>
  `,
  styles: [
    `
      .mn {
        max-width: 1180px;
        margin: 0 auto;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        color: #16141e;
      }
      .mn-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }
      .mn-head-actions {
        display: flex;
        gap: 10px;
      }
      .mn-eyebrow {
        font-family: 'Caveat', cursive;
        font-size: 22px;
        font-weight: 600;
        color: #5840e0;
      }
      .mn-title {
        margin: 2px 0 6px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 38px;
        letter-spacing: -0.03em;
      }
      .mn-sub {
        margin: 0;
        font-size: 15px;
        color: #5b5870;
      }

      .mn-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 16px;
        border-bottom: 1px solid #e9e5d8;
      }
      .mn-tab {
        border: none;
        background: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        font-size: 14px;
        color: #8b879a;
        padding: 10px 4px;
        margin-right: 18px;
        border-bottom: 2px solid transparent;
      }
      .mn-tab.on {
        color: #16141e;
        border-bottom-color: #5840e0;
      }
      .mn-tab-n {
        font-size: 12px;
        color: #8b879a;
      }

      .mn-tools {
        display: flex;
        gap: 10px;
        margin-bottom: 14px;
        flex-wrap: wrap;
      }
      .mn-search {
        flex: 1;
        min-width: 200px;
        border: 1px solid #e2decf;
        border-radius: 99px;
        padding: 10px 16px;
        font: inherit;
        font-size: 14px;
        background: #fff;
      }
      .mn-search:focus,
      .mn-sel:focus {
        outline: none;
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }
      .mn-sel {
        border: 1px solid #e2decf;
        border-radius: 99px;
        padding: 10px 16px;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        background: #fff;
        cursor: pointer;
      }

      .mn-bulk {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #efebff;
        border: 1px solid #ddd5ff;
        border-radius: 12px;
        padding: 10px 16px;
        margin-bottom: 12px;
        font-size: 14px;
        color: #4b4860;
      }

      .mn-card {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        overflow: hidden;
      }
      .mn-selrow {
        padding: 10px 18px;
        border-bottom: 1px solid #f0ede2;
        background: #fbfaf6;
      }
      .mn-check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #8b879a;
        cursor: pointer;
      }
      .mn-check input {
        width: 16px;
        height: 16px;
        accent-color: #5840e0;
      }

      .mn-row {
        display: grid;
        grid-template-columns: auto 56px 1fr auto;
        gap: 14px;
        align-items: center;
        padding: 16px 18px;
        border-top: 1px solid #f0ede2;
      }
      .mn-row:first-child {
        border-top: none;
      }
      .mn-row.hidden {
        opacity: 0.62;
      }
      .mn-row.sel {
        background: #faf9ff;
      }
      .mn-cover {
        width: 56px;
        height: 70px;
        border-radius: 9px;
        overflow: hidden;
        flex: none;
        display: grid;
        place-items: center;
        color: #fff;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 22px;
        text-decoration: none;
      }
      .mn-cover.img {
        background: #f0ede4;
      }
      .mn-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .mn-main {
        min-width: 0;
      }
      .mn-row-title {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 700;
        font-size: 16px;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .mn-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 13px;
        color: #8b879a;
        margin-bottom: 5px;
      }
      .mn-dot {
        color: #c5bfd8;
      }
      .mn-pill {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 9px;
        border-radius: 99px;
      }
      .mn-pill.ok {
        background: #eafaf0;
        color: #1a9e5f;
      }
      .mn-pill.off {
        background: #fff3e0;
        color: #c47f17;
      }
      .mn-pill.wait {
        background: #eef4ff;
        color: #2563eb;
      }
      .mn-pill.rej {
        background: #fdeceb;
        color: #d8453b;
      }
      .mn-pill.del {
        background: #f3f0e7;
        color: #8b879a;
      }

      .mn-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 12px 5px 10px;
        border-radius: 99px;
        font-size: 12px;
        margin-bottom: 6px;
        border: 1px solid transparent;
      }
      .mn-status b {
        font-weight: 800;
        letter-spacing: 0.01em;
      }
      .mn-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
      }
      .mn-status-note {
        font-weight: 600;
        opacity: 0.85;
      }
      .mn-status-note:empty {
        display: none;
      }
      .mn-status.ok {
        background: #eafaf0;
        color: #15894f;
        border-color: #bdebd0;
      }
      .mn-status.ok .mn-status-dot {
        background: #1a9e5f;
      }
      .mn-status.off {
        background: #fff3e0;
        color: #b0710f;
        border-color: #f3dcae;
      }
      .mn-status.off .mn-status-dot {
        background: #c47f17;
      }
      .mn-status.wait {
        background: #eef4ff;
        color: #1f54c9;
        border-color: #c9dbff;
      }
      .mn-status.wait .mn-status-dot {
        background: #2563eb;
        animation: mn-pulse 1.8s ease-out infinite;
      }
      .mn-status.rej {
        background: #fdeceb;
        color: #c63b32;
        border-color: #f6cbc7;
      }
      .mn-status.rej .mn-status-dot {
        background: #d8453b;
      }
      .mn-status.del {
        background: #f3f0e7;
        color: #8b879a;
        border-color: #e6e1d3;
      }
      .mn-status.del .mn-status-dot {
        background: #8b879a;
      }
      @keyframes mn-pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
        }
        70% {
          box-shadow: 0 0 0 6px rgba(37, 99, 235, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
        }
      }
      .mn-row.row-review {
        background: linear-gradient(90deg, #f4f7ff 0%, transparent 55%);
        box-shadow: inset 3px 0 0 #2563eb;
      }
      .mn-row.row-rejected {
        background: linear-gradient(90deg, #fff6f5 0%, transparent 55%);
        box-shadow: inset 3px 0 0 #d8453b;
      }
      .mn-reject-reason {
        font-size: 12.5px;
        line-height: 1.4;
        color: #c63b32;
        background: #fdeceb;
        border: 1px solid #f6cbc7;
        border-radius: 8px;
        padding: 6px 10px;
        margin-bottom: 6px;
        max-width: 520px;
      }
      .mn-reject-reason b {
        font-weight: 800;
      }

      .mn-attention {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .mn-att-label {
        font-size: 13px;
        font-weight: 700;
        color: #5b5870;
      }
      .mn-att-chip {
        font: inherit;
        font-size: 12.5px;
        font-weight: 700;
        padding: 5px 12px;
        border-radius: 99px;
        border: 1px solid transparent;
        cursor: pointer;
        transition:
          transform 0.08s ease,
          box-shadow 0.12s ease;
      }
      .mn-att-chip:hover {
        transform: translateY(-1px);
      }
      .mn-att-chip.rej {
        background: #fdeceb;
        color: #c63b32;
        border-color: #f6cbc7;
      }
      .mn-att-chip.rej.on {
        box-shadow: 0 0 0 2px #f6cbc7;
      }
      .mn-att-chip.wait {
        background: #eef4ff;
        color: #1f54c9;
        border-color: #c9dbff;
      }
      .mn-att-chip.wait.on {
        box-shadow: 0 0 0 2px #c9dbff;
      }
      .mn-nudge {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 9px;
        border-radius: 99px;
        background: #fff3e0;
        color: #c47f17;
      }
      .mn-analytics {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 13px;
        color: #5b5870;
      }
      .mn-analytics b {
        color: #16141e;
      }

      .mn-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }
      .mn-spark {
        width: 88px;
        height: 22px;
      }
      .mn-spark-empty {
        font-size: 11px;
        color: #c5bfd8;
        height: 22px;
        display: flex;
        align-items: center;
      }
      .mn-price {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #8b879a;
      }
      .mn-price input {
        width: 76px;
        border: 1px solid #e2decf;
        border-radius: 8px;
        padding: 7px 9px;
        font: inherit;
        font-size: 14px;
        color: #16141e;
      }
      .mn-price input:focus {
        outline: none;
        border-color: #5840e0;
      }
      .mn-buttons {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .mn-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        border-radius: 99px;
        padding: 10px 18px;
        font-size: 14px;
        text-decoration: none;
        transition:
          background 0.16s,
          color 0.16s,
          border-color 0.16s;
      }
      .mn-btn.sm {
        padding: 7px 13px;
        font-size: 13px;
      }
      .mn-btn.primary {
        background: #16141e;
        color: #fbfaf6;
      }
      .mn-btn.primary:hover:not(:disabled) {
        background: #5840e0;
      }
      .mn-btn.ghost {
        background: #f0ede4;
        color: #4b4860;
      }
      .mn-btn.outline {
        background: #fff;
        border: 1px solid #e2decf;
        color: #4b4860;
      }
      .mn-btn.outline:hover:not(:disabled) {
        border-color: #5840e0;
        color: #5840e0;
      }
      .mn-btn.danger {
        background: #fff;
        border: 1px solid #f0d9d6;
        color: #d8453b;
      }
      .mn-btn.danger:hover:not(:disabled) {
        background: #fdeceb;
      }
      .mn-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .mn-more {
        display: flex;
        justify-content: center;
        margin-top: 22px;
      }
      .mn-nomatch,
      .mn-trash-note {
        padding: 24px 18px;
        font-size: 14px;
        color: #8b879a;
      }
      .mn-trash-note {
        padding: 14px 4px;
      }
      .mn-skel {
        height: 70px;
        margin: 16px 18px;
        border-radius: 12px;
        background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%);
        background-size: 200% 100%;
        animation: mnShimmer 1.3s infinite;
      }
      @keyframes mnShimmer {
        from {
          background-position: 200% 0;
        }
        to {
          background-position: -200% 0;
        }
      }
      .mn-empty {
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
      .mn-empty h3 {
        margin: 14px 0 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 24px;
      }
      .mn-empty p {
        margin: 0;
        color: #5b5870;
        font-size: 15px;
      }
      .mn-empty .mn-btn {
        margin-top: 16px;
      }

      @media (max-width: 820px) {
        .mn-title {
          font-size: 30px;
        }
        .mn-row {
          grid-template-columns: auto 56px 1fr;
        }
        .mn-right {
          grid-column: 1 / -1;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          border-top: 1px dashed #f0ede2;
          padding-top: 12px;
        }
      }
    `,
  ],
})
export class MyNotesComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private destroyRef = inject(DestroyRef);

  protected view = signal<'catalogue' | 'trash'>('catalogue');
  protected notes = signal<Note[]>([]);
  protected trash = signal<Note[]>([]);
  protected loading = signal(true);
  protected trashLoading = signal(false);
  protected loadingMore = signal(false);
  protected busyId = signal<number | null>(null);
  protected bulkBusy = signal(false);
  private page = signal(0);
  protected total = signal(0);

  protected query = signal('');
  protected statusFilter = signal('');
  protected sort = signal('newest');
  protected selected = signal<Set<number>>(new Set());

  protected readonly rupee = rupee;

  constructor() {
    this.fetch(0);
  }

  protected isFiltering = computed(() => !!this.query().trim() || !!this.statusFilter());

  protected pendingCount = computed(() => this.notes().filter((n) => n.status === 'PENDING_REVIEW').length);
  protected rejectedCount = computed(() => this.notes().filter((n) => n.status === 'REJECTED').length);

  /** Toggle the status filter from an attention chip (click again to clear). */
  protected toggleAttention(status: string) {
    this.statusFilter.set(this.statusFilter() === status ? '' : status);
  }

  protected displayed = computed(() => {
    let list = this.notes();
    const st = this.statusFilter();
    if (st) list = list.filter((n) => n.status === st);
    const q = this.query().trim().toLowerCase();
    if (q)
      list = list.filter(
        (n) => (n.title ?? '').toLowerCase().includes(q) || (n.subject ?? '').toLowerCase().includes(q),
      );
    const arr = [...list];
    switch (this.sort()) {
      case 'sales':
        arr.sort((a, b) => (b.purchaseCount ?? 0) - (a.purchaseCount ?? 0));
        break;
      case 'revenue':
        arr.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
        break;
      case 'views':
        arr.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
        break;
      case 'priceHigh':
        arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case 'priceLow':
        arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        break;
      default:
        break; // newest = backend order
    }
    return arr;
  });

  protected setView(v: 'catalogue' | 'trash') {
    this.view.set(v);
    this.clearSel();
    if (v === 'trash' && this.trash().length === 0) this.loadTrash();
  }

  protected hasMore(): boolean {
    return this.notes().length < this.total();
  }

  private fetch(page: number) {
    const initial = page === 0;
    initial ? this.loading.set(true) : this.loadingMore.set(true);
    this.api
      .getSellerNotes(page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const content = r.data?.content ?? [];
          this.notes.update((cur) => (initial ? content : [...cur, ...content]));
          this.total.set(r.data?.totalElements ?? 0);
          this.page.set(page);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }
  protected loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.fetch(this.page() + 1);
  }
  private loadTrash() {
    this.trashLoading.set(true);
    this.api
      .getSellerTrash(0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.trash.set(r.data?.content ?? []);
          this.trashLoading.set(false);
        },
        error: () => this.trashLoading.set(false),
      });
  }

  // ── Selection ─────────────────────────────────────────────
  protected toggleSel(id: number) {
    this.selected.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  protected allSelected(): boolean {
    const d = this.displayed();
    return d.length > 0 && d.every((n) => this.selected().has(n.id));
  }
  protected toggleAll(e: Event) {
    const on = (e.target as HTMLInputElement).checked;
    this.selected.set(on ? new Set(this.displayed().map((n) => n.id)) : new Set());
  }
  protected clearSel() {
    this.selected.set(new Set());
  }

  // ── Single-row actions ────────────────────────────────────
  protected savePrice(n: Note, value: string) {
    const price = Number(value);
    if (!price || price === n.price) return;
    this.busyId.set(n.id);
    this.api
      .updateNotePrice(n.id, price)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Price updated');
          this.patchRow(n.id, { price });
          this.busyId.set(null);
        },
        error: () => this.busyId.set(null),
      });
  }
  protected toggleVisibility(n: Note) {
    const active = n.status !== 'ACTIVE';
    this.busyId.set(n.id);
    this.api
      .setNoteVisibility(n.id, active)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const status = r.data?.status ?? (active ? 'ACTIVE' : 'INACTIVE');
          this.patchRow(n.id, { status });
          this.toast.success(
            !active ? 'Hidden' : status === 'PENDING_REVIEW' ? 'Submitted for admin review' : 'Published',
          );
          this.busyId.set(null);
        },
        error: () => this.busyId.set(null),
      });
  }
  protected async remove(n: Note) {
    const ok = await this.confirm.ask({
      title: 'Delete note?',
      message: `"${n.title}" moves to Trash — you can restore it later.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.busyId.set(n.id);
    this.api
      .deleteNote(n.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Moved to Trash');
          this.notes.update((l) => l.filter((x) => x.id !== n.id));
          this.total.update((t) => Math.max(0, t - 1));
          this.trash.set([]);
          this.busyId.set(null);
        },
        error: () => this.busyId.set(null),
      });
  }
  protected restore(n: Note) {
    this.busyId.set(n.id);
    this.api
      .restoreNote(n.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Restored (hidden)');
          this.trash.update((l) => l.filter((x) => x.id !== n.id));
          this.fetch(0);
          this.busyId.set(null);
        },
        error: () => this.busyId.set(null),
      });
  }

  // ── Bulk actions ──────────────────────────────────────────
  protected bulkVisibility(active: boolean) {
    const ids = [...this.selected()];
    if (!ids.length) return;
    this.bulkBusy.set(true);
    forkJoin(ids.map((id) => this.api.setNoteVisibility(id, active)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          if (active) {
            const live = results.filter((r) => r.data?.status === 'ACTIVE').length;
            const review = results.length - live;
            const parts: string[] = [];
            if (live) parts.push(`${live} published`);
            if (review) parts.push(`${review} sent for review`);
            this.toast.success(parts.join(' · ') || 'Updated');
          } else {
            this.toast.success(`${ids.length} hidden`);
          }
          this.clearSel();
          this.bulkBusy.set(false);
          this.fetch(0);
        },
        error: () => this.bulkBusy.set(false),
      });
  }
  protected async bulkDelete() {
    const ids = [...this.selected()];
    if (!ids.length) return;
    const ok = await this.confirm.ask({
      title: `Delete ${ids.length} notes?`,
      message: 'They move to Trash and can be restored.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.bulkBusy.set(true);
    forkJoin(ids.map((id) => this.api.deleteNote(id)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(`${ids.length} moved to Trash`);
          this.clearSel();
          this.bulkBusy.set(false);
          this.trash.set([]);
          this.fetch(0);
        },
        error: () => this.bulkBusy.set(false),
      });
  }

  // ── CSV export ────────────────────────────────────────────
  protected exportCsv() {
    const head = ['Title', 'Exam', 'Subject', 'Status', 'Price', 'Sales', 'Views', 'Revenue', 'Rating', 'Last sold'];
    const rows = this.notes().map((n) => [
      n.title ?? '',
      n.exam ?? '',
      n.subject ?? '',
      this.statusLabel(n.status),
      String(n.price ?? ''),
      String(n.purchaseCount ?? 0),
      String(n.viewCount ?? 0),
      String(n.revenue ?? 0),
      n.reviewCount ? String((n.averageRating ?? 0).toFixed(1)) : '',
      n.lastSoldAt ? n.lastSoldAt.slice(0, 10) : '',
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topnotes-catalogue.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Helpers ───────────────────────────────────────────────
  private patchRow(id: number, patch: Partial<Note>) {
    this.notes.update((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  protected conversion(n: Note): string {
    const v = n.viewCount ?? 0;
    return v > 0 ? Math.round(((n.purchaseCount ?? 0) / v) * 100) + '%' : '—';
  }
  protected underpriced(n: Note): boolean {
    return !!n.suggestedPrice && (n.price ?? 0) > 0 && (n.price ?? 0) < n.suggestedPrice * 0.7;
  }
  protected hasTrend(n: Note): boolean {
    return (n.salesTrend ?? []).some((v) => v > 0);
  }
  protected spark(trend?: number[]): string {
    const t = trend ?? [];
    if (!t.length) return '';
    const max = Math.max(1, ...t);
    const step = 88 / (t.length - 1 || 1);
    return t.map((v, i) => `${(i * step).toFixed(1)},${(22 - (v / max) * 20 - 1).toFixed(1)}`).join(' ');
  }
  protected cover(n: Note): string {
    return subjectGradientFlat(n.subject);
  }
  protected glyph(n: Note): string {
    return (n.subject ?? n.title ?? '?').charAt(0).toUpperCase();
  }
  protected statusClass(s?: string): string {
    switch (s) {
      case 'ACTIVE':
        return 'ok';
      case 'INACTIVE':
        return 'off';
      case 'PENDING_REVIEW':
        return 'wait';
      case 'REJECTED':
        return 'rej';
      default:
        return 'del';
    }
  }
  protected statusLabel(s?: string): string {
    switch (s) {
      case 'ACTIVE':
        return 'Live';
      case 'INACTIVE':
        return 'Hidden';
      case 'PENDING_REVIEW':
        return 'In review';
      case 'REJECTED':
        return 'Rejected';
      default:
        return 'Deleted';
    }
  }
  protected statusNote(s?: string): string {
    switch (s) {
      case 'ACTIVE':
        return 'Visible to buyers';
      case 'INACTIVE':
        return 'Hidden from store';
      case 'PENDING_REVIEW':
        return 'Awaiting admin approval';
      case 'REJECTED':
        return 'Needs changes — edit & resubmit';
      default:
        return '';
    }
  }
}
