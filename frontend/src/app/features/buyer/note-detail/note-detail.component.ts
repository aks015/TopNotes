import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { load } from '@cashfreepayments/cashfree-js';
import { Note, PaymentOrder, Review, ReviewStats } from '@core/models';
import { TopNavComponent } from '@layout/top-nav/top-nav.component';
import { examLabel, initials, rupee, subjectLinedPaper, subjectPaper } from '@shared/util/note-display';

@Component({
  selector: 'app-note-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, TopNavComponent],
  template: `
    <app-top-nav />
    <div class="nd">
      <a class="nd-back" routerLink="/browse">← Back to browse</a>

      @if (loading()) {
        <div class="nd-grid">
          <div class="nd-skel" style="aspect-ratio: 1 / 0.92"></div>
          <div class="nd-skel" style="height: 320px"></div>
        </div>
      } @else {
        @if (note(); as n) {
          <div class="nd-grid">
            <!-- LEFT -->
            <div class="nd-main">
              <!-- Preview: real first-pages PDF when available, else a mock -->
              <div class="nd-preview">
                @if (previewSrc(); as src) {
                  <iframe class="nd-pdf" [src]="src" title="Note preview"></iframe>
                  <div class="nd-free">
                    Showing the first few pages of {{ n.totalPages || '—' }} · the rest unlocks on purchase
                  </div>
                } @else {
                  <div class="nd-paper" [style.--accent]="paper().accent">
                    <div class="nd-paper-body">
                      <i style="width: 58%"></i>
                      <i style="width: 90%"></i>
                      <i style="width: 82%"></i>
                      <i style="width: 70%"></i>
                      <span class="nd-paper-dia">Read-it box</span>
                      <i style="width: 64%"></i>
                      <i style="width: 44%"></i>
                    </div>
                    <span class="nd-paper-cap">🔖 {{ n.subject || 'Topic' }} — labeled notes</span>
                  </div>
                  <div class="nd-strip">
                    <span class="nd-thumb active">1</span>
                    <span class="nd-thumb locked">🔒</span>
                    <span class="nd-thumb locked">🔒</span>
                    <span class="nd-thumb locked">🔒</span>
                  </div>
                  <div class="nd-free">
                    1 of {{ n.totalPages || '—' }} pages free to preview · the rest unlocks on purchase
                  </div>
                }
              </div>

              <!-- Tags / title / rating / desc -->
              <div class="nd-tags">
                @if (n.subject) {
                  <span class="nd-tag" [style.background]="paper().chip" [style.color]="paper().accent">{{ n.subject }}</span>
                }
                @if (n.exam || n.examType) {
                  <span class="nd-tag muted">{{ examLabel() }}</span>
                }
                @if (n.category) {
                  <span class="nd-tag muted">{{ n.category }}</span>
                }
                @if (n.level || n.classLevel) {
                  <span class="nd-tag muted">{{ n.level || n.classLevel }}</span>
                }
              </div>

              <h1 class="nd-title">{{ n.title }}</h1>

              <div class="nd-rating">
                @if (reviewTotal()) {
                  <span class="nd-stars">
                    @for (f of starArr(); track $index) {
                      <span [class.on]="f">★</span>
                    }
                  </span>
                  <b>{{ reviewAvg().toFixed(1) }}</b>
                  <span class="nd-rating-count">({{ reviewTotal() }} reviews)</span>
                } @else {
                  <span class="nd-new">New</span>
                }
                @if (n.purchaseCount) {
                  <span class="nd-dot">·</span><span class="nd-rating-count">{{ n.purchaseCount }} students enrolled</span>
                }
              </div>

              <p class="nd-desc">{{ n.description }}</p>

              <div class="nd-facts">
                <div class="nd-fact"><span>Pages</span><b>{{ n.totalPages || '—' }}</b></div>
                <div class="nd-fact"><span>Format</span><b>PDF</b></div>
                <div class="nd-fact"><span>Exam</span><b>{{ examLabel() || '—' }}</b></div>
                <div class="nd-fact"><span>Level</span><b>{{ n.level || n.classLevel || '—' }}</b></div>
              </div>

              <!-- Seller -->
              @if (n.seller; as s) {
                <div class="nd-seller">
                  <div class="nd-seller-eyebrow">notes by a verified topper</div>
                  <a class="nd-seller-top" [routerLink]="['/u', s.id]" [attr.aria-label]="'View ' + s.fullName + '\\'s profile'">
                    <span class="nd-seller-av" [style.background]="paper().accent">{{ sellerInitials() }}</span>
                    <div>
                      <div class="nd-seller-name">
                        {{ s.fullName }}
                        @if (s.verified) {
                          <span class="nd-seller-badge">✓ Verified</span>
                        }
                      </div>
                      <div class="nd-seller-sub">
                        {{ s.institution }}@if (s.bio) { · {{ s.bio }} }
                      </div>
                    </div>
                    <span class="nd-seller-go">→</span>
                  </a>
                  <div class="nd-seller-stats">
                    @if (s.institution) {
                      <div class="nd-stat"><b>{{ s.institution }}</b><span>Institution</span></div>
                    }
                    @if (s.classLevel) {
                      <div class="nd-stat"><b>{{ s.classLevel }}</b><span>Teaches</span></div>
                    }
                    <div class="nd-stat"><b>{{ s.totalNotes ?? 0 }} sets</b><span>on TopNotes</span></div>
                  </div>
                  <a class="nd-seller-view" [routerLink]="['/u', s.id]">View full profile →</a>
                </div>
              }
            </div>

            <!-- RIGHT: purchase card -->
            <aside class="nd-aside">
              <div class="nd-buy">
                <div class="nd-price">{{ rupee(n.price) }} <small>one-time</small></div>
                <div class="nd-price-sub">Secure checkout · instant access</div>

                @if (isOwnNote()) {
                  <div class="nd-own">✓ This is your note — it's listed in the marketplace.</div>
                  <a class="nd-cta manage" routerLink="/seller/notes">Manage in My Notes</a>
                } @else if (isPurchased()) {
                  <a class="nd-cta read" [routerLink]="['/notes', n.id, 'view']">Read notes →</a>
                } @else {
                  <button class="nd-cta buy" [disabled]="purchasing()" (click)="buy()">
                    {{ purchasing() ? 'Opening checkout…' : 'Buy for ' + rupee(n.price) }}
                  </button>
                }

                <div class="nd-secure">🔒 View-only access · watermarked with your email · no download</div>
                <ul class="nd-includes">
                  @if (n.totalPages) {
                    <li>✓ {{ n.totalPages }} pages of handwritten notes</li>
                  }
                  <li>✓ Lifetime access in your library</li>
                  <li>✓ Read on any device, secure viewer</li>
                </ul>
              </div>

              @if (reviewTotal()) {
                <div class="nd-ratecard">
                  <span class="nd-stars sm">
                    @for (f of starArr(); track $index) {
                      <span [class.on]="f">★</span>
                    }
                  </span>
                  <span><b>{{ reviewTotal() }}</b> buyers rated this <b>{{ reviewAvg().toFixed(1) }}</b></span>
                </div>
              }
            </aside>
          </div>

          <!-- REVIEWS -->
          <section class="nd-reviews">
            <h2 class="nd-rev-h">Reviews</h2>
            <div class="nd-rev-wrap">
              <div class="nd-rev-summary">
                @if (reviewTotal()) {
                  <div class="nd-rev-big">{{ reviewAvg().toFixed(1) }}</div>
                  <span class="nd-stars lg">
                    @for (f of starArr(); track $index) {
                      <span [class.on]="f">★</span>
                    }
                  </span>
                  <div class="nd-rating-count">Based on {{ reviewTotal() }} reviews</div>
                  <div class="nd-dist">
                    @for (row of ratingRows(); track row.star) {
                      <div class="nd-dist-row">
                        <span class="nd-dist-star">{{ row.star }}</span>
                        <span class="nd-dist-bar"><i [style.width.%]="row.pct"></i></span>
                        <span class="nd-dist-count">{{ row.count }}</span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="nd-rev-none">No ratings yet</div>
                  <p class="nd-rating-count" style="margin: 6px 0 0">Be the first to review this note after purchase.</p>
                }
              </div>

              <div class="nd-rev-right">
                @if (canReview()) {
                  <div class="nd-write" id="nd-write">
                    <h4>{{ myReview() ? 'Edit your review' : 'Write a review' }}</h4>
                    <div class="nd-rate">
                      @for (i of [1, 2, 3, 4, 5]; track i) {
                        <span [class.on]="i <= myRating()" (click)="myRating.set(i)">★</span>
                      }
                    </div>
                    <textarea
                      class="nd-textarea"
                      placeholder="What did you think of these notes?"
                      [value]="myComment()"
                      (input)="myComment.set($any($event.target).value)"
                    ></textarea>
                    <button class="nd-cta buy" style="margin-top: 12px" [disabled]="submitting()" (click)="submitReview()">
                      {{ submitting() ? 'Saving…' : myReview() ? 'Update review' : 'Submit review' }}
                    </button>
                  </div>
                } @else if (isOwnNote()) {
                  <div class="nd-write-hint">✍️ Reviews from your buyers will appear here.</div>
                } @else {
                  <div class="nd-write-hint">
                    🔒 Only buyers can review. Purchase this note to share your experience.
                  </div>
                }

                <div class="nd-rev-list">
                  @for (r of reviews(); track r.id) {
                    <div class="nd-rev-item">
                      <div class="nd-rev-top">
                        <span class="nd-rev-av">{{ initials(r.buyerName) }}</span>
                        <div>
                          <div class="nd-rev-name">
                            {{ r.buyerName || 'Student' }}
                            @if (r.id === myReview()?.id) {
                              <span class="nd-rev-you">You</span>
                            }
                          </div>
                          <div class="nd-rev-vrf">✓ Verified purchase</div>
                        </div>
                        @if (r.id === myReview()?.id) {
                          <button class="nd-rev-edit" (click)="editReview()">Edit</button>
                        } @else {
                          <time>{{ r.createdAt | date: 'd MMM y' }}</time>
                        }
                      </div>
                      <span class="nd-stars sm">
                        @for (i of [1, 2, 3, 4, 5]; track i) {
                          <span [class.on]="i <= r.rating">★</span>
                        }
                      </span>
                      <p class="nd-rev-text">{{ r.comment }}</p>
                    </div>
                  } @empty {
                    <p class="nd-rev-empty">No reviews yet — be the first to review after purchase.</p>
                  }
                </div>
              </div>
            </div>
          </section>
        } @else {
          <div class="nd-empty">
            <h3>Note not found</h3>
            <p>This note may have been removed.</p>
            <a class="nd-cta buy" routerLink="/browse">Back to browse</a>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background: #fbfaf6;
        min-height: 100vh;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        color: #16141e;
      }
      .nd {
        max-width: 1120px;
        margin: 0 auto;
        padding: 28px 28px 96px;
      }
      .nd-back {
        display: inline-block;
        text-decoration: none;
        color: #4b4860;
        font-size: 14px;
        font-weight: 600;
        padding: 8px 14px;
        border: 1px solid #e2decf;
        border-radius: 99px;
        background: #fff;
        margin-bottom: 22px;
      }
      .nd-back:hover {
        color: #5840e0;
        border-color: #5840e0;
      }
      .nd-grid {
        display: grid;
        grid-template-columns: 1fr 350px;
        gap: 36px;
        align-items: start;
      }

      /* ---- Preview mock ---- */
      .nd-preview {
        margin-bottom: 26px;
      }
      .nd-pdf {
        width: 100%;
        height: 520px;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        background: #fff;
        display: block;
      }
      .nd-paper {
        position: relative;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        padding: 26px 26px 26px 46px;
        overflow: hidden;
        min-height: 300px;
      }
      .nd-paper::before {
        content: '';
        position: absolute;
        left: 30px;
        top: 0;
        bottom: 0;
        width: 1.5px;
        background: #f0b8b8;
      }
      .nd-paper-body {
        display: flex;
        flex-direction: column;
        gap: 22px;
        position: relative;
        background-image: repeating-linear-gradient(#fff, #fff 33px, #eef1f8 34px);
      }
      .nd-paper-body i {
        display: block;
        height: 11px;
        border-radius: 4px;
        background: #dde2ee;
      }
      .nd-paper-dia {
        position: absolute;
        right: 0;
        top: 70px;
        width: 38%;
        height: 92px;
        border: 1.5px dashed #c7cede;
        border-radius: 10px;
        display: grid;
        place-items: center;
        font-size: 11px;
        color: #a8aec2;
        background: #fafbff;
      }
      .nd-paper-cap {
        position: absolute;
        left: 26px;
        bottom: 18px;
        background: #16141e;
        color: #fff;
        font-size: 12.5px;
        font-weight: 600;
        padding: 8px 14px;
        border-radius: 99px;
      }
      .nd-strip {
        display: flex;
        gap: 10px;
        margin-top: 14px;
      }
      .nd-thumb {
        width: 46px;
        height: 58px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 700;
        flex: none;
      }
      .nd-thumb.active {
        border: 2px solid #5840e0;
        color: #5840e0;
        background: #fff;
      }
      .nd-thumb.locked {
        background: #eceae3;
        color: #b3afa2;
      }
      .nd-free {
        margin-top: 12px;
        font-size: 12.5px;
        color: #8b879a;
      }

      /* ---- Tags / title ---- */
      .nd-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .nd-tag {
        font-size: 12px;
        font-weight: 700;
        padding: 5px 12px;
        border-radius: 99px;
      }
      .nd-tag.muted {
        background: #f0ede2;
        color: #5b5870;
      }
      .nd-title {
        margin: 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 32px;
        line-height: 1.14;
        letter-spacing: -0.03em;
      }
      .nd-rating {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 12px;
        font-size: 14.5px;
      }
      .nd-rating-count {
        color: #8b879a;
      }
      .nd-new {
        font-size: 12.5px;
        font-weight: 700;
        color: #5840e0;
        background: #efebff;
        padding: 3px 11px;
        border-radius: 99px;
      }
      .nd-rev-none {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 22px;
        color: #16141e;
      }
      .nd-dot {
        color: #c8c2ad;
      }
      .nd-stars span {
        color: #d8d3c4;
        font-size: 16px;
      }
      .nd-stars span.on {
        color: #e8a317;
      }
      .nd-stars.lg span {
        font-size: 20px;
      }
      .nd-stars.sm span {
        font-size: 13px;
      }
      .nd-desc {
        margin: 16px 0 0;
        font-size: 15.5px;
        line-height: 1.7;
        color: #5b5870;
      }

      /* ---- Facts ---- */
      .nd-facts {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin: 24px 0;
      }
      .nd-fact {
        border: 1px solid #e9e5d8;
        border-radius: 12px;
        padding: 14px 16px;
        background: #fff;
      }
      .nd-fact span {
        display: block;
        font-size: 11.5px;
        font-weight: 600;
        color: #8b879a;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .nd-fact b {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 18px;
        font-weight: 700;
      }

      /* ---- Seller ---- */
      .nd-seller {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        padding: 18px 20px;
      }
      .nd-seller-eyebrow {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #8b879a;
        margin-bottom: 12px;
      }
      .nd-seller-top {
        display: flex;
        gap: 14px;
        align-items: center;
        text-decoration: none;
        color: inherit;
        border-radius: 12px;
        margin: -6px;
        padding: 6px;
        transition: background 0.12s;
      }
      .nd-seller-top:hover {
        background: #faf8f2;
      }
      .nd-seller-go {
        margin-left: auto;
        color: #8a8475;
        font-size: 18px;
        transition: transform 0.15s, color 0.15s;
      }
      .nd-seller-top:hover .nd-seller-go {
        color: #5840e0;
        transform: translateX(2px);
      }
      .nd-seller-view {
        display: inline-block;
        margin-top: 14px;
        font-size: 13.5px;
        font-weight: 700;
        color: #5840e0;
        text-decoration: none;
      }
      .nd-seller-view:hover {
        text-decoration: underline;
      }
      .nd-seller-av {
        width: 46px;
        height: 46px;
        border-radius: 99px;
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 15px;
        flex: none;
      }
      .nd-seller-name {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 15.5px;
      }
      .nd-seller-badge {
        font-size: 11px;
        font-weight: 700;
        color: #5840e0;
        background: #efebff;
        padding: 3px 9px;
        border-radius: 99px;
      }
      .nd-seller-sub {
        font-size: 13px;
        color: #5b5870;
        margin-top: 3px;
      }
      .nd-seller-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-top: 16px;
      }
      .nd-stat {
        background: #fbfaf6;
        border: 1px solid #ece8dd;
        border-radius: 12px;
        padding: 12px;
      }
      .nd-stat b {
        display: block;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
      }
      .nd-stat span {
        font-size: 11.5px;
        color: #8b879a;
      }

      /* ---- Purchase card ---- */
      .nd-aside {
        position: sticky;
        top: 96px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .nd-buy {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 18px 40px -28px rgba(22, 20, 30, 0.4);
      }
      .nd-price {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 34px;
        letter-spacing: -0.03em;
      }
      .nd-price small {
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 500;
        color: #8b879a;
      }
      .nd-price-sub {
        font-size: 12.5px;
        color: #8b879a;
        margin-top: 2px;
      }
      .nd-cta {
        display: block;
        width: 100%;
        text-align: center;
        text-decoration: none;
        font-size: 15.5px;
        font-weight: 700;
        padding: 14px;
        border-radius: 14px;
        border: none;
        cursor: pointer;
        margin-top: 16px;
        font-family: inherit;
      }
      .nd-cta.buy {
        background: #5840e0;
        color: #fff;
      }
      .nd-cta.buy:hover:not(:disabled) {
        background: #4733c4;
      }
      .nd-cta.buy:disabled {
        opacity: 0.7;
        cursor: default;
      }
      .nd-cta.read {
        background: #0e8a4d;
        color: #fff;
      }
      .nd-cta.read:hover {
        background: #0c7541;
      }
      .nd-cta.manage {
        background: #fff;
        color: #16141e;
        border: 1px solid #e2decf;
      }
      .nd-cta.manage:hover {
        border-color: #5840e0;
        color: #5840e0;
      }
      .nd-own {
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: 12px;
        background: #e9fbf0;
        border: 1px solid #b6e9cc;
        color: #0e8a4d;
        font-size: 13.5px;
        font-weight: 600;
        line-height: 1.4;
      }
      .nd-secure {
        margin-top: 14px;
        padding: 12px 14px;
        background: #fbfaf6;
        border: 1px solid #ece8dd;
        border-radius: 12px;
        font-size: 12.5px;
        color: #5b5870;
        line-height: 1.5;
      }
      .nd-includes {
        list-style: none;
        margin: 16px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .nd-includes li {
        font-size: 14px;
        color: #3e3b52;
      }
      .nd-ratecard {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 14px;
        padding: 14px 18px;
        font-size: 13.5px;
        color: #5b5870;
      }

      /* ---- Reviews ---- */
      .nd-reviews {
        margin-top: 44px;
      }
      .nd-rev-h {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 26px;
        margin: 0 0 16px;
      }
      .nd-rev-wrap {
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 22px;
        align-items: start;
      }
      .nd-rev-summary {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        padding: 24px;
        position: sticky;
        top: 96px;
      }
      .nd-rev-big {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 52px;
        line-height: 1;
      }
      .nd-rev-summary .nd-stars {
        display: block;
        margin: 6px 0;
      }
      .nd-dist {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .nd-dist-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #8b879a;
      }
      .nd-dist-star {
        width: 10px;
        text-align: right;
      }
      .nd-dist-bar {
        flex: 1;
        height: 6px;
        border-radius: 99px;
        background: #ece8dd;
        overflow: hidden;
      }
      .nd-dist-bar i {
        display: block;
        height: 100%;
        background: #e8a317;
        border-radius: 99px;
      }
      .nd-dist-count {
        width: 22px;
        text-align: right;
      }
      .nd-write {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        padding: 22px;
        margin-bottom: 12px;
      }
      .nd-write h4 {
        margin: 0 0 10px;
        font-size: 16px;
        font-weight: 700;
      }
      .nd-write-hint {
        background: #fff;
        border: 1px dashed #e2decf;
        border-radius: 14px;
        padding: 16px 18px;
        margin-bottom: 12px;
        font-size: 14px;
        font-weight: 600;
        color: #5b5870;
      }
      .nd-rate span {
        font-size: 28px;
        color: #d8d3c4;
        cursor: pointer;
      }
      .nd-rate span.on {
        color: #e8a317;
      }
      .nd-textarea {
        width: 100%;
        margin-top: 12px;
        min-height: 90px;
        padding: 12px 14px;
        border: 1px solid #e2decf;
        border-radius: 12px;
        font-family: inherit;
        font-size: 14.5px;
        resize: vertical;
        background: #fbfaf6;
        color: #16141e;
      }
      .nd-textarea:focus {
        outline: none;
        border-color: #5840e0;
        background: #fff;
      }
      .nd-rev-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .nd-rev-item {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        padding: 18px 20px;
      }
      .nd-rev-top {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .nd-rev-av {
        width: 36px;
        height: 36px;
        border-radius: 99px;
        background: #5840e0;
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 700;
        flex: none;
      }
      .nd-rev-name {
        font-weight: 700;
        font-size: 14px;
      }
      .nd-rev-vrf {
        font-size: 11.5px;
        font-weight: 600;
        color: #0e8a4d;
      }
      .nd-rev-you {
        font-size: 10.5px;
        font-weight: 700;
        color: #5840e0;
        background: #efebff;
        padding: 2px 8px;
        border-radius: 99px;
        margin-left: 6px;
      }
      .nd-rev-top time {
        margin-left: auto;
        font-size: 12.5px;
        color: #8b879a;
      }
      .nd-rev-edit {
        margin-left: auto;
        font-size: 13px;
        font-weight: 700;
        color: #5840e0;
        background: none;
        border: 1px solid #ddd5ff;
        border-radius: 99px;
        padding: 5px 14px;
        cursor: pointer;
      }
      .nd-rev-edit:hover {
        background: #efebff;
      }
      .nd-rev-item .nd-stars {
        display: block;
        margin: 10px 0 6px;
      }
      .nd-rev-text {
        margin: 0;
        font-size: 14.5px;
        line-height: 1.6;
        color: #3e3b52;
      }
      .nd-rev-empty {
        font-size: 14px;
        color: #8b879a;
      }
      .nd-empty {
        text-align: center;
        padding: 80px 20px;
      }
      .nd-empty h3 {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 24px;
        font-weight: 800;
      }
      .nd-empty .nd-cta {
        display: inline-block;
        width: auto;
        padding: 12px 26px;
        margin-top: 14px;
      }
      .nd-skel {
        border-radius: 20px;
        background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%);
        background-size: 200% 100%;
        animation: ndShimmer 1.3s infinite;
      }
      @keyframes ndShimmer {
        from {
          background-position: 200% 0;
        }
        to {
          background-position: -200% 0;
        }
      }

      @media (max-width: 860px) {
        .nd-grid {
          grid-template-columns: 1fr;
          gap: 24px;
        }
        .nd-aside {
          position: static;
        }
        .nd-rev-wrap {
          grid-template-columns: 1fr;
        }
        .nd-rev-summary {
          position: static;
        }
      }
      @media (max-width: 560px) {
        .nd {
          padding: 20px 16px 88px;
        }
        .nd-title {
          font-size: 26px;
        }
        .nd-facts {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .nd-seller-stats {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class NoteDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);

  /** Blob URL of the first-pages preview PDF; null → fall back to the mock. */
  protected previewSrc = signal<SafeResourceUrl | null>(null);
  private previewObjectUrl: string | null = null;

  protected note = signal<Note | null>(null);
  protected reviews = signal<Review[]>([]);
  protected stats = signal<ReviewStats | null>(null);
  protected myReview = signal<Review | null>(null);
  protected loading = signal(true);
  protected purchasing = signal(false);
  protected submitting = signal(false);
  protected purchasedLocal = signal(false);
  protected myRating = signal(5);
  protected myComment = signal('');

  private id = Number(this.route.snapshot.paramMap.get('id'));

  protected isPurchased = computed(() => this.purchasedLocal() || !!this.note()?.isPurchased);
  protected canReview = computed(() => this.isPurchased() && !this.isOwnNote());

  /** The logged-in user is the seller of this note → can't buy/review their own listing. */
  protected isOwnNote = computed(() => {
    const sid = this.note()?.seller?.id;
    return sid != null && sid === this.auth.user()?.userId;
  });

  protected examLabel = computed(() => this.note()?.exam || examLabel(this.note()?.examType));
  protected paper = computed(() => subjectPaper(this.note()?.subject));
  protected cover = computed(() => subjectLinedPaper(this.note()?.subject));
  protected glyph = computed(() => (this.note()?.subject ?? '?').charAt(0).toUpperCase());
  protected sellerInitials = computed(() => this.initials(this.note()?.seller?.fullName));
  // Review summary driven by the backend aggregate (real rows), with the note's
  // denormalised values as a pre-load fallback.
  protected reviewAvg = computed(() => this.stats()?.average ?? this.note()?.averageRating ?? 0);
  protected reviewTotal = computed(() => this.stats()?.total ?? this.note()?.reviewCount ?? 0);
  protected starArr = computed(() => {
    const r = Math.round(this.reviewAvg());
    return Array.from({ length: 5 }, (_, i) => i < r);
  });
  /** Per-star rows for the distribution bars (from the real aggregate). */
  protected ratingRows = computed(() => {
    const counts = this.stats()?.counts ?? {};
    const total = this.stats()?.total ?? 0;
    return [5, 4, 3, 2, 1].map((star) => {
      const count = counts[String(star)] ?? 0;
      return { star, count, pct: total ? Math.round((count / total) * 100) : 0 };
    });
  });

  protected readonly initials = initials;
  protected readonly rupee = rupee;

  constructor() {
    this.api
      .getNote(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.note.set(r.data);
          this.loading.set(false);
          // Only fetch a preview when there's a real (uploaded) PDF — dummy seed
          // notes have placeholder paths, so we skip the request and show the mock.
          if (r.data?.previewUrl?.startsWith('http')) this.loadPreview();
        },
        error: () => {
          this.note.set(null);
          this.loading.set(false);
        },
      });
    this.refreshReviews();
    this.loadMyReview();

    this.destroyRef.onDestroy(() => {
      if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    });
  }

  /** Embed the real first-pages PDF preview; on any error the mock stays. */
  private loadPreview() {
    this.api
      .getNotePreview(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          if (!blob || blob.size === 0) return;
          this.previewObjectUrl = URL.createObjectURL(blob);
          // #toolbar=0&navpanes=0 hides the browser's native PDF toolbar
          // (download/print/zoom) — keeps the embed clean and view-only.
          const src = this.previewObjectUrl + '#toolbar=0&navpanes=0&statusbar=0';
          this.previewSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(src));
        },
        error: () => {},
      });
  }

  protected buy() {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    if (this.purchasing()) return;
    this.purchasing.set(true);

    // 1) Create a Cashfree order on the backend → get a payment_session_id.
    this.api
      .createPaymentOrder(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => void this.openCheckout(r.data),
        error: () => this.purchasing.set(false),
      });
  }

  private async openCheckout(order: PaymentOrder) {
    try {
      // 2) Open Cashfree Checkout (modal).
      const cashfree = await load({ mode: order.mode === 'production' ? 'production' : 'sandbox' });
      const result = await cashfree.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: '_modal',
      });

      if (result?.error) {
        this.purchasing.set(false);
        this.toast.error('Payment was cancelled or failed.');
        return;
      }
      if (!result?.paymentDetails) {
        // user closed the modal without completing
        this.purchasing.set(false);
        return;
      }

      // 3) Verify with the backend (source of truth) → records the purchase + split.
      this.api
        .verifyPayment(this.id, order.orderId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.purchasing.set(false);
            this.purchasedLocal.set(true);
            this.toast.success('Payment successful — happy studying!');
          },
          error: () => this.purchasing.set(false),
        });
    } catch {
      this.purchasing.set(false);
      this.toast.error('Could not open the payment window.');
    }
  }

  protected submitReview() {
    if (this.submitting()) return;
    this.submitting.set(true);
    const editing = !!this.myReview();
    this.api
      .submitReview(this.id, this.myRating(), this.myComment().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success(editing ? 'Your review was updated.' : 'Thanks for your review!');
          this.refreshReviews();
          this.loadMyReview();
        },
        error: () => this.submitting.set(false),
      });
  }

  /** Pre-fills the form with the user's existing review and scrolls to it. */
  protected editReview() {
    const mine = this.myReview();
    if (mine) {
      this.myRating.set(mine.rating);
      this.myComment.set(mine.comment ?? '');
    }
    document.getElementById('nd-write')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private refreshReviews() {
    this.api
      .getNoteReviews(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.reviews.set(r.data?.content ?? []), error: () => {} });
    this.api
      .getReviewStats(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.stats.set(r.data ?? null), error: () => {} });
  }

  private loadMyReview() {
    if (!this.auth.isLoggedIn()) return;
    this.api
      .getMyReview(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const mine = r.data ?? null;
          this.myReview.set(mine);
          if (mine) {
            this.myRating.set(mine.rating);
            this.myComment.set(mine.comment ?? '');
          }
        },
        error: () => {},
      });
  }
}
