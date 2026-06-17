import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { Note, SocialStats } from '@core/models';
import { examLabel } from '@shared/util/note-display';
import { LogoComponent } from '@ui/logo/logo.component';

/**
 * Shared auth layout — dark ink brand panel (left) + cream card panel (right).
 * The brand panel content is fixed (same for login & register); pages project
 * only their card body:
 *   <div card>…the auth card content…</div>
 */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LogoComponent, DecimalPipe],
  template: `
    <div class="shell">
      <aside class="brand">
        <a class="logo" routerLink="/" aria-label="TopNotes home"><app-logo [size]="34" [wordSize]="20" /></a>

        <div class="brand-body">
          <div class="script" aria-hidden="true">verified toppers only &rarr;</div>
          <h1 class="headline">The marketplace built on <em>real ranks.</em></h1>

          <ul class="ticks">
            <li><span class="tick">&check;</span> Buy handwritten notes from verified rank-holders</li>
            <li><span class="tick">&check;</span> Sellers earn on every download, paid to UPI</li>
            <li><span class="tick">&check;</span> Subject-wise notes for JEE, NEET &amp; Boards</li>
          </ul>

          @if (note(); as n) {
            <a class="note-card" [routerLink]="['/notes', n.id]">
              <div class="nc-head">
                <span class="nc-tag">{{ n.subject }}@if (n.examType) { &middot; {{ examLabel(n.examType) }} }</span>
                @if (n.totalPages) { <span class="nc-page">{{ n.totalPages }} pages</span> }
              </div>
              <div class="nc-body">
                <div class="nc-title">{{ n.title }}</div>
                @if (n.description) { <div class="nc-line">{{ n.description }}</div> }
              </div>
              <div class="nc-foot">
                <span class="nc-avatar">{{ initials(n.seller?.fullName) }}</span>
                <span class="nc-name">{{ n.seller?.fullName || 'Verified topper' }} <span class="nc-badge">&check;</span></span>
                <span class="nc-price">&#8377;{{ n.price }}</span>
              </div>
            </a>
          }
        </div>

        <div class="brand-foot">
          @if (stats(); as s) {
            @if (s.reviewCount > 0) {
              <span class="stars" aria-hidden="true">
                @for (on of stars(s.averageRating); track $index) { <span [class.dim]="!on">&starf;</span> }
              </span>
              <span><strong>{{ s.averageRating | number: '1.1-1' }}</strong> &middot; {{ s.reviewCount }} {{ s.reviewCount === 1 ? 'review' : 'reviews' }} from verified toppers</span>
            } @else if (s.learners > 0) {
              <span class="stars" aria-hidden="true">&starf;&starf;&starf;&starf;&starf;</span>
              <span><strong>{{ s.learners }}</strong> {{ s.learners === 1 ? 'learner' : 'learners' }} &middot; {{ s.verifiedSellers }} verified toppers</span>
            } @else {
              <span class="stars" aria-hidden="true">&check;</span>
              <span>Verified toppers only &middot; {{ s.notesCount }} {{ s.notesCount === 1 ? 'note' : 'notes' }} and counting</span>
            }
          }
        </div>
      </aside>

      <main class="auth">
        <div class="auth-top">
          <a class="home-link" routerLink="/">&larr; Back to home</a>
          <a class="guest-cta" routerLink="/browse">Browse as guest &rarr;</a>
        </div>

        <div class="mobile-head">
          <a class="logo" routerLink="/" aria-label="TopNotes home"><app-logo [size]="34" [wordSize]="20" /></a>
          <p class="tagline">The marketplace built on <em>real ranks.</em></p>
        </div>

        <div class="auth-center">
          <div class="card anim-slide-up"><ng-content select="[card]" /></div>
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        --ink: #16141e;
        --cream: #fbfaf6;
        --indigo: #5840e0;
        --yellow: #ffe25a;
        --amber: #ffd84d;
        --gold: #b8860b;
        display: block;
        font-family: 'Instrument Sans', sans-serif;
        color: var(--ink);
        -webkit-font-smoothing: antialiased;
      }

      .shell {
        height: 100vh;
        overflow: hidden;
        display: grid;
        grid-template-columns: 1fr 1.1fr;
        background: var(--cream);
      }

      /* ── Brand panel (left, dark ink) ─────────────────────── */
      .brand {
        position: sticky;
        top: 0;
        height: 100vh;
        background: var(--ink);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 44px 52px;
        overflow: hidden;
      }
      .brand::before {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 0px,
          rgba(0, 0, 0, 0) 43px,
          rgba(255, 255, 255, 0.035) 44px
        );
        pointer-events: none;
      }
      .brand > * {
        position: relative;
      }

      .logo {
        display: inline-flex;
        align-items: center;
        text-decoration: none;
        color: var(--cream);
      }

      .brand-body {
        display: flex;
        flex-direction: column;
        gap: 26px;
        max-width: 440px;
      }
      .script {
        font-family: 'Caveat', cursive;
        font-size: 25px;
        font-weight: 600;
        color: var(--yellow);
        transform: rotate(-1.5deg);
      }
      .headline {
        margin: 0;
        font-family: 'Bricolage Grotesque', sans-serif;
        font-weight: 800;
        font-size: 44px;
        line-height: 1.08;
        letter-spacing: -0.03em;
        color: var(--cream);
        text-wrap: balance;
      }
      .headline em {
        font-style: normal;
        color: var(--amber);
      }

      .ticks {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .ticks li {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 15.5px;
        color: #c9c6d4;
      }
      .tick {
        width: 22px;
        height: 22px;
        border-radius: 99px;
        background: rgba(255, 216, 77, 0.15);
        color: var(--amber);
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
      }

      /* ── Floating note-card preview ───────────────────────── */
      .note-card {
        display: block;
        text-decoration: none;
        width: 320px;
        margin-top: 10px;
        background: #fff;
        border-radius: 14px;
        transform: rotate(-2.5deg);
        box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .note-card:hover {
        transform: rotate(-1deg) translateY(-3px);
      }
      .nc-head {
        padding: 12px 16px;
        border-bottom: 1px solid #f0ede2;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .nc-tag {
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--indigo);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nc-page {
        font-size: 10.5px;
        font-weight: 600;
        color: #9b97a8;
      }
      .nc-body {
        padding: 14px 16px;
        background: repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff 23px, #eff3fa 24px);
      }
      .nc-title {
        font-family: 'Caveat', cursive;
        font-size: 23px;
        font-weight: 700;
        color: #23304a;
        line-height: 24px;
      }
      .nc-line {
        font-family: 'Caveat', cursive;
        font-size: 18px;
        font-weight: 600;
        color: #3e4b66;
        line-height: 24px;
        margin-top: 8px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nc-foot {
        padding: 10px 16px;
        border-top: 1px solid #f0ede2;
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .nc-avatar {
        width: 26px;
        height: 26px;
        border-radius: 99px;
        background: var(--indigo);
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
      }
      .nc-name {
        font-size: 12px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--ink);
      }
      .nc-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        border-radius: 99px;
        background: var(--indigo);
        color: #fff;
        font-size: 9px;
      }
      .nc-price {
        margin-left: auto;
        font-family: 'Bricolage Grotesque', sans-serif;
        font-weight: 700;
        font-size: 14px;
        color: var(--ink);
      }

      .brand-foot {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13.5px;
        color: #6e6a80;
      }
      .brand-foot .stars {
        color: var(--amber);
        letter-spacing: 1px;
      }
      .brand-foot .stars .dim {
        color: #4a4658;
      }
      .brand-foot strong {
        color: #a8a4b8;
      }

      /* ── Auth panel (right, cream) ────────────────────────── */
      .auth {
        display: flex;
        flex-direction: column;
        height: 100vh;
        min-height: 0;
      }
      .auth-top {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 20px 36px 0;
      }
      .home-link {
        text-decoration: none;
        color: var(--muted, #5b5870);
        font-size: 14px;
        font-weight: 600;
        padding: 10px 4px;
        border-radius: 8px;
        transition: color 0.2s;
      }
      .home-link:hover {
        color: var(--ink);
      }
      .guest-cta {
        text-decoration: none;
        background: #fff;
        border: 1px solid #e2decf;
        color: var(--ink);
        font-size: 14px;
        font-weight: 600;
        padding: 10px 20px;
        border-radius: 99px;
        transition:
          border-color 0.2s,
          transform 0.12s;
      }
      .guest-cta:hover {
        border-color: var(--ink);
        transform: translateY(-1px);
      }

      .auth-center {
        flex: 1;
        min-height: 0;
        display: flex;
        padding: 10px 40px 24px;
        /* safety net: if the card ever exceeds the viewport, only this
           area scrolls — the page itself never does */
        overflow-y: auto;
      }
      .card {
        width: 480px;
        max-width: 100%;
        margin: auto; /* centers, and degrades gracefully when overflowing */
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 22px;
        padding: 34px 40px 28px;
        box-shadow: 0 24px 48px -32px rgba(22, 20, 30, 0.18);
      }

      .mobile-head {
        display: none;
      }

      /* Short desktop viewports: tighten further so the card fits */
      @media (min-width: 981px) and (max-height: 820px) {
        .auth-top {
          padding-top: 12px;
        }
        .guest-cta {
          font-size: 13px;
          padding: 7px 16px;
        }
        .auth-center {
          padding: 6px 32px 16px;
        }
        .card {
          padding: 24px 34px 20px;
          border-radius: 18px;
        }
        .brand {
          padding: 32px 44px;
        }
        .headline {
          font-size: 36px;
        }
        .note-card {
          display: none;
        }
      }

      /* ── Responsive ───────────────────────────────────────── */
      @media (max-width: 980px) {
        .shell {
          grid-template-columns: 1fr;
          height: auto;
          min-height: 100vh;
          overflow: visible;
        }
        .brand {
          display: none;
        }
        .auth {
          position: relative;
          height: auto;
          min-height: 100vh;
        }
        .auth-center {
          overflow: visible;
        }
        .auth-top {
          position: absolute;
          top: 18px;
          right: 16px;
          padding: 0;
          z-index: 2;
        }
        /* the mobile head's logo already links home */
        .auth-top .home-link {
          display: none;
        }
        .auth-top .guest-cta {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
          color: var(--cream);
          font-size: 13px;
          padding: 8px 16px;
        }
        .mobile-head {
          display: block;
          background: var(--ink);
          padding: 22px 24px 26px;
        }
        .mobile-head .tagline {
          margin: 16px 0 0;
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 700;
          font-size: 22px;
          letter-spacing: -0.02em;
          line-height: 1.2;
          color: var(--cream);
          max-width: 340px;
        }
        .mobile-head .tagline em {
          font-style: normal;
          color: var(--amber);
        }
        .auth-center {
          padding: 28px 16px 56px;
        }
        .card {
          padding: 32px 24px 30px;
        }
      }
    `,
  ],
})
export class AuthShellComponent {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  protected stats = signal<SocialStats | null>(null);
  protected note = signal<Note | null>(null);
  protected readonly examLabel = examLabel;

  constructor() {
    this.api
      .getSocialStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.stats.set(r.data ?? null), error: () => {} });

    // A real featured note powers the floating preview card — no fabricated sample.
    this.api
      .getNotes({ page: 0, size: 1, sort: 'featured' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.note.set(r.data?.content?.[0] ?? null), error: () => {} });
  }

  protected initials(name?: string): string {
    return (name || 'T').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }
  protected stars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(rating || 0));
  }
}
