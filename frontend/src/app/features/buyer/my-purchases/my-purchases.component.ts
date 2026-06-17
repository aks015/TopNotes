import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { ReadingProgressService, ReadingEntry } from '@core/services/reading-progress.service';
import { Purchase } from '@core/models';
import { IllustrationComponent } from '@ui/illustration/illustration.component';
import { TopNavComponent } from '@layout/top-nav/top-nav.component';
import { examLabel, initials, rupee, subjectLinedPaper, subjectPaper } from '@shared/util/note-display';

@Component({
  selector: 'app-my-purchases',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, FormsModule, IllustrationComponent, TopNavComponent],
  template: `
    <app-top-nav />
    <div class="lib">
      <!-- Header -->
      <header class="lib-head">
        <div class="lib-eyebrow">your library</div>
        <h1 class="lib-title">My purchases</h1>
        <p class="lib-sub">
          @if (loading()) {
            Loading your library…
          } @else if (isFiltering()) {
            <b>{{ displayed().length }}</b> of {{ total() }} {{ total() === 1 ? 'note' : 'notes' }} match.
          } @else {
            <b>{{ total() }}</b> {{ total() === 1 ? 'note' : 'notes' }} in your library.
          }
        </p>
      </header>

      <!-- Continue reading -->
      @if (reading().length) {
        <section class="lib-cont">
          <div class="lib-cont-head">
            <h2>Continue reading</h2>
            <button type="button" class="lib-link" (click)="clearReading()">Clear</button>
          </div>
          <div class="lib-cont-strip">
            @for (r of reading(); track r.noteId) {
              <a class="lib-cont-card" [routerLink]="['/notes', r.noteId, 'view']">
                <span class="lib-cont-thumb" [style.background]="crThumb(r)">{{ crGlyph(r) }}</span>
                <span class="lib-cont-info">
                  <span class="lib-cont-name">{{ r.title }}</span>
                  <span class="lib-cont-prog">Page {{ r.lastPage }} / {{ r.totalPages }}</span>
                  <span class="lib-cont-bar"><i [style.width.%]="crPct(r)"></i></span>
                </span>
              </a>
            }
          </div>
        </section>
      }

      <!-- Toolbar: search + sort + subject chips (only once the library grows) -->
      @if (!loading() && showTools()) {
        <section class="lib-tools">
          <div class="lib-tools-row">
            <label class="lib-search">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Search by title or seller…"
                [ngModel]="query()"
                (ngModelChange)="query.set($event)"
                aria-label="Search your purchases"
              />
              @if (query()) {
                <button type="button" class="lib-search-x" (click)="query.set('')" aria-label="Clear search">×</button>
              }
            </label>
            <label class="lib-sort">
              <span>Sort</span>
              <select [ngModel]="sort()" (ngModelChange)="sort.set($event)" aria-label="Sort purchases">
                <option value="recent">Recently bought</option>
                <option value="title">Title A–Z</option>
                <option value="price-high">Price: high → low</option>
                <option value="price-low">Price: low → high</option>
              </select>
            </label>
          </div>
          @if (subjects().length > 1) {
            <div class="lib-chips">
              <button
                type="button"
                class="lib-chip"
                [class.on]="!subjectFilter()"
                (click)="subjectFilter.set('')"
              >
                All
              </button>
              @for (s of subjects(); track s) {
                <button type="button" class="lib-chip" [class.on]="subjectFilter() === s" (click)="toggleSubject(s)">
                  {{ s }}
                </button>
              }
            </div>
          }
        </section>
      }

      <!-- Library -->
      @if (loading()) {
        <div class="lib-grid">
          @for (s of skeletons; track s) {
            <div class="lib-skel"></div>
          }
        </div>
      } @else if (purchases().length === 0) {
        <div class="lib-empty">
          <app-illustration name="purchases" />
          <h3>You haven't bought any notes yet</h3>
          <p>Browse verified topper notes for your exam and start your library.</p>
          <a class="lib-btn primary" routerLink="/browse">Browse notes</a>
        </div>
      } @else if (displayed().length === 0) {
        <div class="lib-empty">
          <app-illustration name="purchases" />
          <h3>No notes match your search</h3>
          <p>Try a different keyword or clear the filters to see your whole library.</p>
          <button type="button" class="lib-btn primary lib-btn-reset" (click)="resetFilters()">Clear filters</button>
        </div>
      } @else {
        <div class="lib-grid">
          @for (p of displayed(); track p.id) {
            <div class="lib-card">
              <a
                class="lib-cover"
                [class.img]="p.note?.thumbnailUrl"
                [style.background]="p.note?.thumbnailUrl ? null : cover(p)"
                [routerLink]="['/notes', p.note?.id, 'view']"
              >
                @if (p.note?.thumbnailUrl) {
                  <img class="lib-cover-img" [src]="p.note?.thumbnailUrl" [alt]="p.note?.title" loading="lazy" />
                }
                <div class="lib-cover-row">
                  @if (p.note?.subject) {
                    <span class="lib-tag" [style.background]="paper(p).accent">{{ (p.note?.subject ?? '').toUpperCase() }}</span>
                  }
                  @if (p.note?.exam || p.note?.examType) {
                    <span class="lib-exam">{{ p.note?.exam || examLabel(p.note?.examType) }}</span>
                  }
                </div>
                <div class="lib-cover-title" [style.color]="p.note?.thumbnailUrl ? '#fff' : paper(p).ink">
                  {{ p.note?.title }}
                </div>
              </a>

              <div class="lib-body">
                <div class="lib-seller">
                  <span class="lib-avatar" [style.background]="paper(p).accent">{{ initials(p.note?.seller?.fullName) }}</span>
                  <span class="lib-seller-name">{{ p.note?.seller?.fullName }}</span>
                  @if (p.note?.seller?.verified) {
                    <span class="lib-vrf" [style.background]="paper(p).accent" title="Verified topper">✓</span>
                  }
                </div>
                <div class="lib-meta">Bought {{ p.purchasedAt | date: 'd MMM y' }} · {{ rupee(p.amount) }}</div>
                @if (prog(p); as e) {
                  <div class="lib-prog" [title]="'Page ' + e.lastPage + ' of ' + e.totalPages">
                    <span class="lib-prog-bar"><i [style.width.%]="pct(e)"></i></span>
                    <span class="lib-prog-txt">Page {{ e.lastPage }} / {{ e.totalPages }}</span>
                  </div>
                }
                <div class="lib-actions">
                  <a class="lib-btn primary" [routerLink]="['/notes', p.note?.id, 'view']">
                    {{ prog(p) ? 'Resume' : 'Read' }}
                  </a>
                  <a class="lib-btn ghost" [routerLink]="['/notes', p.note?.id]">Review</a>
                </div>
              </div>
            </div>
          }
        </div>

        @if (hasMore()) {
          <div class="lib-more">
            @if (isFiltering()) {
              <p class="lib-more-hint">Showing matches from {{ purchases().length }} loaded notes — load more to search your whole library.</p>
            }
            <button type="button" class="lib-btn primary lib-more-btn" [disabled]="loadingMore()" (click)="loadMore()">
              {{ loadingMore() ? 'Loading…' : 'Load more' }}
            </button>
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
      .lib {
        max-width: 1280px;
        margin: 0 auto;
        padding: 36px 28px 96px;
      }

      /* Header */
      .lib-eyebrow {
        font-family: 'Caveat', cursive;
        font-size: 22px;
        font-weight: 600;
        color: #5840e0;
      }
      .lib-title {
        margin: 2px 0 6px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 40px;
        letter-spacing: -0.03em;
      }
      .lib-sub {
        margin: 0;
        font-size: 15px;
        color: #5b5870;
      }
      .lib-sub b {
        color: #16141e;
        font-weight: 700;
      }

      /* Continue reading */
      .lib-cont {
        margin: 30px 0 8px;
      }
      .lib-cont-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .lib-cont-head h2 {
        margin: 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 700;
        font-size: 19px;
      }
      .lib-link {
        font-size: 13px;
        font-weight: 700;
        color: #5840e0;
        background: none;
        border: none;
        cursor: pointer;
      }
      .lib-link:hover {
        text-decoration: underline;
      }
      .lib-cont-strip {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 14px;
      }
      .lib-cont-card {
        display: flex;
        gap: 14px;
        align-items: center;
        padding: 14px;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        text-decoration: none;
        color: inherit;
        transition:
          transform 0.2s,
          box-shadow 0.2s,
          border-color 0.2s;
      }
      .lib-cont-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 18px 36px -22px rgba(22, 20, 30, 0.4);
        border-color: #ddd7c6;
      }
      .lib-cont-thumb {
        width: 52px;
        height: 64px;
        border-radius: 10px;
        flex: none;
        display: grid;
        place-items: center;
        color: #fff;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 22px;
      }
      .lib-cont-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .lib-cont-name {
        font-weight: 700;
        font-size: 14.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .lib-cont-prog {
        font-size: 12.5px;
        color: #8b879a;
      }
      .lib-cont-bar {
        height: 5px;
        border-radius: 99px;
        background: #ece8dd;
        overflow: hidden;
      }
      .lib-cont-bar i {
        display: block;
        height: 100%;
        background: #5840e0;
        border-radius: 99px;
      }

      /* Toolbar */
      .lib-tools {
        margin-top: 28px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .lib-tools-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .lib-search {
        flex: 1;
        min-width: 220px;
        display: flex;
        align-items: center;
        gap: 9px;
        background: #fff;
        border: 1px solid #e2decf;
        border-radius: 99px;
        padding: 0 16px;
        color: #8b879a;
        transition:
          border-color 0.18s,
          box-shadow 0.18s;
      }
      .lib-search:focus-within {
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }
      .lib-search input {
        flex: 1;
        border: none;
        background: none;
        outline: none;
        padding: 12px 0;
        font: inherit;
        font-size: 14.5px;
        color: #16141e;
      }
      .lib-search-x {
        border: none;
        background: none;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        color: #a8a4b8;
        padding: 0 2px;
      }
      .lib-search-x:hover {
        color: #16141e;
      }
      .lib-sort {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13.5px;
        font-weight: 600;
        color: #5b5870;
      }
      .lib-sort select {
        appearance: none;
        -webkit-appearance: none;
        background:
          #fff
          url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235b5870' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")
          no-repeat right 14px center;
        border: 1px solid #e2decf;
        border-radius: 99px;
        padding: 11px 38px 11px 16px;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        color: #16141e;
        cursor: pointer;
      }
      .lib-sort select:focus-visible {
        outline: none;
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }
      .lib-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .lib-chip {
        border: 1px solid #e2decf;
        background: #fff;
        color: #4b4860;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        padding: 7px 15px;
        border-radius: 99px;
        cursor: pointer;
        transition:
          background 0.16s,
          color 0.16s,
          border-color 0.16s;
      }
      .lib-chip:hover {
        border-color: #c9c2ad;
      }
      .lib-chip.on {
        background: #16141e;
        color: #fbfaf6;
        border-color: #16141e;
      }

      /* Library grid */
      .lib-grid {
        margin-top: 26px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 20px;
      }
      .lib-card {
        display: flex;
        flex-direction: column;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        overflow: hidden;
        transition:
          transform 0.22s,
          box-shadow 0.22s,
          border-color 0.22s;
      }
      .lib-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 20px 40px -20px rgba(22, 20, 30, 0.25);
        border-color: #ddd7c6;
      }
      .lib-cover {
        height: 128px;
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        text-decoration: none;
      }
      .lib-cover.img {
        padding: 0;
      }
      .lib-cover-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .lib-cover.img::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(22, 20, 30, 0.66), rgba(22, 20, 30, 0) 58%);
      }
      .lib-cover-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .lib-cover.img .lib-cover-row {
        position: absolute;
        top: 14px;
        left: 18px;
        right: 18px;
        z-index: 2;
      }
      .lib-tag {
        color: #fff;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        padding: 4px 10px;
        border-radius: 6px;
        white-space: nowrap;
      }
      .lib-exam {
        font-size: 11px;
        font-weight: 700;
        color: #8b879a;
        background: rgba(255, 255, 255, 0.78);
        padding: 4px 10px;
        border-radius: 99px;
        white-space: nowrap;
      }
      .lib-cover-title {
        position: relative;
        z-index: 2;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 16.5px;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .lib-body {
        padding: 14px 18px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
      }
      .lib-seller {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lib-avatar {
        width: 24px;
        height: 24px;
        border-radius: 99px;
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
        flex: none;
      }
      .lib-seller-name {
        font-size: 13.5px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .lib-vrf {
        width: 15px;
        height: 15px;
        border-radius: 99px;
        color: #fff;
        font-size: 9px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
      }
      .lib-meta {
        font-size: 12.5px;
        color: #8b879a;
        margin-top: auto;
      }
      .lib-actions {
        display: flex;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid #f0ede2;
      }
      .lib-btn {
        flex: 1;
        text-align: center;
        text-decoration: none;
        font-size: 13.5px;
        font-weight: 700;
        padding: 9px 14px;
        border-radius: 99px;
        transition:
          background 0.18s,
          color 0.18s,
          border-color 0.18s;
      }
      .lib-btn.primary {
        background: #16141e;
        color: #fbfaf6;
      }
      .lib-btn.primary:hover {
        background: #5840e0;
      }
      .lib-btn.ghost {
        flex: 0 0 auto;
        color: #4b4860;
        border: 1px solid #e2decf;
        background: #fff;
      }
      .lib-btn.ghost:hover {
        border-color: #5840e0;
        color: #5840e0;
      }

      /* Per-card reading progress */
      .lib-prog {
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .lib-prog-bar {
        flex: 1;
        height: 5px;
        border-radius: 99px;
        background: #ece8dd;
        overflow: hidden;
      }
      .lib-prog-bar i {
        display: block;
        height: 100%;
        background: #5840e0;
        border-radius: 99px;
      }
      .lib-prog-txt {
        font-size: 11.5px;
        font-weight: 600;
        color: #8b879a;
        white-space: nowrap;
      }

      /* Load more */
      .lib-more {
        margin-top: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .lib-more-hint {
        margin: 0;
        font-size: 13px;
        color: #8b879a;
        text-align: center;
      }
      .lib-more-btn {
        flex: 0 0 auto;
        padding: 12px 34px;
      }
      .lib-more-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .lib-btn-reset {
        border: none;
        cursor: pointer;
        font: inherit;
      }

      /* Skeleton + empty */
      .lib-skel {
        height: 250px;
        border-radius: 16px;
        background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%);
        background-size: 200% 100%;
        animation: libShimmer 1.3s infinite;
      }
      @keyframes libShimmer {
        from {
          background-position: 200% 0;
        }
        to {
          background-position: -200% 0;
        }
      }
      .lib-empty {
        margin-top: 26px;
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
      .lib-empty h3 {
        margin: 14px 0 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 24px;
      }
      .lib-empty p {
        margin: 0;
        color: #5b5870;
        font-size: 15px;
        max-width: 360px;
      }
      .lib-empty .lib-btn {
        flex: 0 0 auto;
        margin-top: 16px;
        padding: 12px 26px;
      }

      @media (max-width: 560px) {
        .lib {
          padding: 24px 16px 88px;
        }
        .lib-title {
          font-size: 32px;
        }
      }
    `,
  ],
})
export class MyPurchasesComponent {
  private api = inject(ApiService);
  private readingService = inject(ReadingProgressService);
  private destroyRef = inject(DestroyRef);

  private readonly PAGE_SIZE = 24;
  /** Below this many notes the search/sort toolbar is hidden — keeps small libraries clean. */
  private readonly TOOLS_THRESHOLD = 8;

  /** All purchases loaded so far (accumulates across "Load more"). */
  protected purchases = signal<Purchase[]>([]);
  protected total = signal(0);
  protected loading = signal(true);
  protected loadingMore = signal(false);
  private page = signal(0);
  /** Raw recently-opened entries from localStorage (may include non-owned notes). */
  private rawReading = signal<ReadingEntry[]>(this.readingService.list());

  // Client-side filter / sort state (operates on the loaded set).
  protected query = signal('');
  protected sort = signal<'recent' | 'title' | 'price-high' | 'price-low'>('recent');
  protected subjectFilter = signal('');

  protected readonly skeletons = Array.from({ length: 6 });
  protected readonly examLabel = examLabel;
  protected readonly initials = initials;
  protected readonly rupee = rupee;

  /** Show the toolbar only once the library is large enough to need it. */
  protected showTools = computed(() => this.total() > this.TOOLS_THRESHOLD);
  protected hasMore = computed(() => this.purchases().length < this.total());
  protected isFiltering = computed(() => !!this.subjectFilter() || !!this.query().trim());

  /** Set of note IDs the buyer actually owns (from loaded purchases). */
  private ownedIds = computed(() => {
    const set = new Set<number>();
    for (const p of this.purchases()) {
      const id = p.note?.id;
      if (id != null) set.add(id);
    }
    return set;
  });

  /** Continue-reading entries limited to notes actually in the library. */
  protected reading = computed(() => {
    const owned = this.ownedIds();
    return this.rawReading().filter((e) => owned.has(e.noteId));
  });

  /** Distinct subjects in the loaded library (for the filter chips). */
  protected subjects = computed(() => {
    const set = new Set<string>();
    for (const p of this.purchases()) {
      const s = p.note?.subject;
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  /** noteId → reading progress, for the per-card resume bar. */
  private progressMap = computed(() => {
    const m: Record<number, ReadingEntry> = {};
    for (const e of this.reading()) m[e.noteId] = e;
    return m;
  });

  /** The purchases actually rendered: subject filter → search → sort. */
  protected displayed = computed(() => {
    let list = this.purchases();
    const subj = this.subjectFilter();
    if (subj) list = list.filter((p) => p.note?.subject === subj);
    const q = this.query().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.note?.title ?? '').toLowerCase().includes(q) ||
          (p.note?.seller?.fullName ?? '').toLowerCase().includes(q),
      );
    }
    const arr = [...list];
    switch (this.sort()) {
      case 'title':
        arr.sort((a, b) => (a.note?.title ?? '').localeCompare(b.note?.title ?? ''));
        break;
      case 'price-high':
        arr.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
        break;
      case 'price-low':
        arr.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0));
        break;
      default:
        arr.sort((a, b) => this.time(b) - this.time(a));
    }
    return arr;
  });

  constructor() {
    this.fetch(0);
  }

  private fetch(page: number): void {
    const initial = page === 0;
    initial ? this.loading.set(true) : this.loadingMore.set(true);
    this.api
      .getMyPurchases(page, this.PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const content = r.data?.content ?? [];
          this.purchases.update((cur) => (initial ? content : [...cur, ...content]));
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

  protected loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.fetch(this.page() + 1);
  }

  protected toggleSubject(s: string): void {
    this.subjectFilter.update((cur) => (cur === s ? '' : s));
  }
  protected resetFilters(): void {
    this.query.set('');
    this.subjectFilter.set('');
    this.sort.set('recent');
  }

  private time(p: Purchase): number {
    return p.purchasedAt ? new Date(p.purchasedAt).getTime() : 0;
  }
  protected prog(p: Purchase): ReadingEntry | undefined {
    const id = p.note?.id;
    return id != null ? this.progressMap()[id] : undefined;
  }
  protected pct(e: ReadingEntry): number {
    return e.totalPages ? Math.min(100, Math.round((e.lastPage / e.totalPages) * 100)) : 0;
  }

  protected paper(p: Purchase) {
    return subjectPaper(p.note?.subject);
  }
  protected cover(p: Purchase): string {
    return subjectLinedPaper(p.note?.subject);
  }

  protected crThumb(r: ReadingEntry): string {
    return subjectPaper(r.subject).accent;
  }
  protected crGlyph(r: ReadingEntry): string {
    return (r.subject ?? r.title ?? '?').charAt(0).toUpperCase();
  }
  protected crPct(r: ReadingEntry): number {
    return r.totalPages ? Math.round((r.lastPage / r.totalPages) * 100) : 0;
  }
  protected clearReading(): void {
    const visible = this.reading();
    for (const r of visible) this.readingService.remove(r.noteId);
    const ids = new Set(visible.map((r) => r.noteId));
    this.rawReading.update((cur) => cur.filter((e) => !ids.has(e.noteId)));
  }
}
