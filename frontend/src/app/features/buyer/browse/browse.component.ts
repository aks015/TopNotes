import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { Note, PageResponse } from '@core/models';
import { NoteCardComponent } from '@ui/note-card/note-card.component';
import { TopNavComponent } from '@layout/top-nav/top-nav.component';

const PAGE_SIZE = 12;

type FilterKey = 'category' | 'exam' | 'subject';

@Component({
  selector: 'app-browse',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NoteCardComponent, LucideAngularModule, TopNavComponent],
  template: `
    <app-top-nav />

    <div class="b-page">
      <!-- Header -->
      <header class="b-head">
        <div class="b-head-row">
          <div>
            <h1 class="b-title">Browse notes</h1>
            <p class="b-sub">Verified, handwritten notes from real toppers — for every major Indian exam.</p>
          </div>
          <div class="b-accent">every page is rank-checked ✓</div>
        </div>
      </header>

      <!-- Mobile filter toggle -->
      <button class="b-filter-toggle" (click)="filtersOpen.set(!filtersOpen())">
        <lucide-icon name="sliders-horizontal" [size]="16" [strokeWidth]="1.8" />
        Filters
        @if (activeChips().length) {
          <span class="b-toggle-count">{{ activeChips().length }}</span>
        }
      </button>

      <div class="b-layout">
        <!-- Filters sidebar -->
        <aside class="b-side" [class.open]="filtersOpen()" aria-label="Filters">
          <div class="b-side-head">
            <span class="b-side-title">Filters</span>
            @if (activeChips().length) {
              <button class="b-clear" (click)="clearAll()">Clear all</button>
            }
          </div>

          <div class="b-group-label">CATEGORY</div>
          <div class="b-group">
            @for (c of categories(); track c) {
              <button
                type="button"
                class="b-opt"
                [class.on]="fCategory().includes(c)"
                [attr.aria-pressed]="fCategory().includes(c)"
                (click)="toggleFilter('category', c)"
              >
                <span class="b-box">✓</span><span class="b-opt-label">{{ c }}</span>
              </button>
            }
          </div>

          <div class="b-divider"></div>
          <div class="b-group-label">EXAM</div>
          <div class="b-group">
            @for (e of exams(); track e) {
              <button
                type="button"
                class="b-opt"
                [class.on]="fExam().includes(e)"
                [attr.aria-pressed]="fExam().includes(e)"
                (click)="toggleFilter('exam', e)"
              >
                <span class="b-box">✓</span><span class="b-opt-label">{{ e }}</span>
              </button>
            }
          </div>

          <div class="b-divider"></div>
          <div class="b-group-label">SUBJECT</div>
          <div class="b-group">
            @for (s of subjects(); track s) {
              <button
                type="button"
                class="b-opt"
                [class.on]="fSubject().includes(s)"
                [attr.aria-pressed]="fSubject().includes(s)"
                (click)="toggleFilter('subject', s)"
              >
                <span class="b-box">✓</span><span class="b-opt-label">{{ s }}</span>
              </button>
            }
          </div>
        </aside>

        <!-- Results -->
        <main>
          <div class="b-result-row">
            <div class="b-count">
              @if (loading()) {
                Loading…
              } @else {
                <b>{{ total() }}</b> {{ total() === 1 ? 'note' : 'notes' }} found
              }
            </div>
            <select class="b-sort" [value]="sort()" (change)="patch({ sort: $any($event.target).value || null })">
              <option value="">Sort: Most popular</option>
              <option value="rating">Sort: Top rated</option>
              <option value="priceAsc">Sort: Price — low to high</option>
              <option value="priceDesc">Sort: Price — high to low</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </div>

          @if (activeChips().length) {
            <div class="b-chips">
              @for (chip of activeChips(); track chip.key + chip.value) {
                <button class="b-chip" (click)="toggleFilter(chip.key, chip.value)" [attr.aria-label]="'Remove ' + chip.label">
                  {{ chip.label }} <span class="b-chip-x">×</span>
                </button>
              }
              <button class="b-chip-clear" (click)="clearAll()">Clear all</button>
            </div>
          }

          @if (loading()) {
            <div class="b-grid">
              @for (s of skeletons; track s) {
                <div class="b-skel-card">
                  <div class="b-skel" style="height:138px;border-radius:0"></div>
                  <div class="b-skel-body">
                    <div class="b-skel" style="height:14px;width:60%"></div>
                    <div class="b-skel" style="height:13px;width:80%"></div>
                    <div class="b-skel" style="height:22px;width:45%;margin-top:6px"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (error()) {
            <div class="b-empty">
              <div class="b-empty-scribble">something went wrong…</div>
              <h3>Couldn't load notes</h3>
              <p>Please check your connection and try again.</p>
              <button class="b-empty-btn" (click)="reload()">Retry</button>
            </div>
          } @else if (notes().length === 0) {
            <div class="b-empty">
              <div class="b-empty-scribble">nothing here yet…</div>
              <h3>No notes match those filters</h3>
              <p>Try removing a filter or searching for something else.</p>
              <button class="b-empty-btn" (click)="clearAll()">Clear all filters</button>
            </div>
          } @else {
            <div class="b-grid">
              @for (n of notes(); track n.id) {
                <app-note-card [note]="n" />
              }
            </div>
            @if (totalPages() > 1) {
              <div class="b-pager-wrap">
                <div class="b-pager">
                  <button [disabled]="page() === 0" (click)="patch({ page: page() - 1 })" aria-label="Previous">
                    ‹
                  </button>
                  @for (p of pageList(); track $index) {
                    @if (p === -1) {
                      <span class="b-pager-gap">…</span>
                    } @else {
                      <button
                        [class.on]="p === page()"
                        [attr.aria-current]="p === page() ? 'true' : null"
                        (click)="patch({ page: p })"
                      >
                        {{ p + 1 }}
                      </button>
                    }
                  }
                  <button
                    [disabled]="page() >= totalPages() - 1"
                    (click)="patch({ page: page() + 1 })"
                    aria-label="Next"
                  >
                    ›
                  </button>
                </div>
              </div>
            }
          }
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        color: #16141e;
        background: #fbfaf6;
        min-height: 100vh;
      }

      /* ---- Page container ---- */
      .b-page {
        max-width: 1280px;
        margin: 0 auto;
        padding: 44px 28px 96px;
      }

      /* ---- Header ---- */
      .b-head {
        margin-bottom: 28px;
      }
      .b-crumb {
        font-size: 13px;
        font-weight: 600;
        color: #8b879a;
        margin-bottom: 10px;
      }
      .b-head-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .b-title {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 40px;
        letter-spacing: -0.03em;
        margin: 0 0 8px;
      }
      .b-sub {
        margin: 0;
        font-size: 16.5px;
        color: #5b5870;
      }
      .b-accent {
        font-family: 'Caveat', cursive;
        font-size: 23px;
        font-weight: 600;
        color: #5840e0;
        transform: rotate(-1.5deg);
        white-space: nowrap;
      }

      /* ---- Layout ---- */
      .b-layout {
        display: grid;
        grid-template-columns: 248px 1fr;
        gap: 28px;
        align-items: start;
      }

      /* ---- Filter sidebar ---- */
      .b-side {
        position: sticky;
        top: 88px;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 18px;
        padding: 22px 22px 26px;
      }
      .b-side-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 18px;
      }
      .b-side-title {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 700;
        font-size: 17px;
      }
      .b-clear {
        font-size: 12.5px;
        font-weight: 700;
        color: #5840e0;
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px;
      }
      .b-clear:hover {
        text-decoration: underline;
      }
      .b-group-label {
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: #8b879a;
        margin-bottom: 12px;
      }
      .b-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 20px;
      }
      .b-divider {
        height: 1px;
        background: #f0ede2;
        margin-bottom: 20px;
      }
      .b-opt {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 0;
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
        font: inherit;
        width: 100%;
      }
      .b-box {
        width: 19px;
        height: 19px;
        border-radius: 6px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        background: #fff;
        color: transparent;
        border: 1.5px solid #d8d4c6;
        transition: all 0.15s ease;
      }
      .b-opt:hover .b-box {
        border-color: #b9b3eb;
      }
      .b-opt.on .b-box {
        background: #5840e0;
        border-color: #5840e0;
        color: #fff;
      }
      .b-opt-label {
        font-size: 14.5px;
        color: #3e3b52;
        font-weight: 500;
      }

      /* ---- Results header ---- */
      .b-result-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }
      .b-count {
        font-size: 15px;
        color: #5b5870;
      }
      .b-count b {
        color: #16141e;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 17px;
      }
      .b-sort {
        appearance: none;
        -webkit-appearance: none;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #16141e;
        background-color: #fff;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238b879a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 16px center;
        border: 1.5px solid #e2decf;
        border-radius: 99px;
        padding: 10px 42px 10px 18px;
        cursor: pointer;
        transition:
          border-color 0.18s,
          box-shadow 0.18s;
      }
      .b-sort:hover {
        border-color: #c8c2ad;
      }
      .b-sort:focus {
        outline: none;
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }

      /* ---- Active filter chips ---- */
      .b-chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 20px;
      }
      .b-chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        color: #5840e0;
        background: #efebff;
        border: 1px solid #ddd5ff;
        border-radius: 99px;
        padding: 6px 12px;
        cursor: pointer;
      }
      .b-chip:hover {
        background: #e4ddff;
      }
      .b-chip-x {
        font-size: 16px;
        line-height: 1;
        color: #5840e0;
      }
      .b-chip-clear {
        font-size: 13px;
        font-weight: 700;
        color: #8b879a;
        background: none;
        border: none;
        cursor: pointer;
        padding: 6px 4px;
      }
      .b-chip-clear:hover {
        color: #16141e;
        text-decoration: underline;
      }

      /* ---- Grid ---- */
      .b-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }

      /* ---- Skeleton ---- */
      .b-skel-card {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        overflow: hidden;
      }
      .b-skel-body {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .b-skel {
        border-radius: 6px;
        background: linear-gradient(90deg, #f2efe6 25%, #eae6da 37%, #f2efe6 63%);
        background-size: 400% 100%;
        animation: b-shimmer 1.4s ease infinite;
      }
      @keyframes b-shimmer {
        0% {
          background-position: 100% 0;
        }
        100% {
          background-position: 0 0;
        }
      }

      /* ---- Empty / error ---- */
      .b-empty {
        background: #fff;
        border: 1px dashed #d8d4c6;
        border-radius: 18px;
        padding: 64px 32px;
        text-align: center;
      }
      .b-empty-scribble {
        font-family: 'Caveat', cursive;
        font-size: 28px;
        font-weight: 600;
        color: #8b879a;
        margin-bottom: 8px;
      }
      .b-empty h3 {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 700;
        font-size: 22px;
        margin: 0 0 8px;
      }
      .b-empty p {
        font-size: 15px;
        color: #5b5870;
        margin: 0 0 24px;
      }
      .b-empty-btn {
        background: #5840e0;
        color: #fff;
        font-size: 14.5px;
        font-weight: 700;
        padding: 12px 26px;
        border-radius: 12px;
        border: none;
        cursor: pointer;
        transition: background 0.2s;
      }
      .b-empty-btn:hover {
        background: #4630c8;
      }

      /* ---- Pager ---- */
      .b-pager-wrap {
        display: flex;
        justify-content: center;
        margin-top: 32px;
      }
      .b-pager {
        display: flex;
        gap: 6px;
      }
      .b-pager button {
        min-width: 40px;
        height: 40px;
        padding: 0 12px;
        border-radius: 99px;
        border: 1.5px solid #e2decf;
        background: #fff;
        color: #16141e;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
      }
      .b-pager button:hover:not(:disabled):not(.on) {
        border-color: #b9b3eb;
      }
      .b-pager button.on {
        background: #16141e;
        border-color: #16141e;
        color: #fbfaf6;
      }
      .b-pager button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .b-pager-gap {
        min-width: 28px;
        height: 40px;
        display: inline-flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 8px;
        color: #a8a4b8;
        user-select: none;
      }

      /* ---- Mobile filter toggle ---- */
      .b-filter-toggle {
        display: none;
        align-items: center;
        gap: 8px;
        background: #fff;
        border: 1.5px solid #e2decf;
        border-radius: 99px;
        padding: 9px 18px;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #16141e;
        cursor: pointer;
        margin-bottom: 16px;
      }
      .b-toggle-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 99px;
        background: #5840e0;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
      }

      /* ---- Responsive ---- */
      @media (max-width: 1080px) {
        .b-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 920px) {
        .b-title {
          font-size: 32px;
        }
        .b-layout {
          grid-template-columns: 1fr;
        }
        .b-side {
          position: static;
          display: none;
        }
        .b-side.open {
          display: block;
          margin-bottom: 16px;
        }
        .b-filter-toggle {
          display: inline-flex;
        }
      }
      @media (max-width: 720px) {
        .b-page {
          padding: 28px 18px 80px;
        }
      }
      @media (max-width: 560px) {
        .b-grid {
          grid-template-columns: 1fr;
        }
        .b-accent {
          display: none;
        }
      }
    `,
  ],
})
export class BrowseComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  protected auth = inject(AuthService);

  // Filter options — the live distinct values from the backend (only options
  // that actually have notes), populated from getFilterOptions().
  protected categories = signal<string[]>([]);
  protected exams = signal<string[]>([]);
  protected subjects = signal<string[]>([]);
  protected readonly skeletons = Array.from({ length: 8 });

  protected keyword = signal('');
  // Multi-select filters — each holds the list of selected values.
  protected fCategory = signal<string[]>([]);
  protected fExam = signal<string[]>([]);
  protected fSubject = signal<string[]>([]);
  protected sort = signal('');
  protected page = signal(0);

  protected notes = signal<Note[]>([]);
  protected total = signal(0);
  protected totalPages = signal(0);
  protected loading = signal(true);
  protected error = signal(false);
  protected filtersOpen = signal(false);

  private cache = new Map<string, PageResponse<Note>>();
  private req$ = new Subject<Record<string, string | number>>();

  constructor() {
    // Single request pipeline: switchMap cancels stale requests; cache short-circuits repeats.
    this.req$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
        }),
        switchMap((params) => {
          const key = JSON.stringify(params);
          const cached = this.cache.get(key);
          if (cached) return of(cached);
          return this.api.getNotes(params).pipe(
            map((r) => r.data),
            tap((d) => this.cache.set(key, d)),
            catchError(() => {
              this.error.set(true);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        if (data) {
          this.notes.set(data.content ?? []);
          this.total.set(data.totalElements ?? 0);
          this.totalPages.set(data.totalPages ?? 0);
        }
        this.loading.set(false);
      });

    // URL is the source of truth — read filters from query params, then fetch.
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      this.keyword.set(q['keyword'] ?? '');
      this.fCategory.set(this.parseList(q['category']));
      this.fExam.set(this.parseList(q['exam']));
      this.fSubject.set(this.parseList(q['subject']));
      this.sort.set(q['sort'] ?? '');
      this.page.set(+(q['page'] ?? 0));
      this.req$.next(this.buildParams());
    });

    // Live filter options — only show facets that actually have notes.
    this.api
      .getFilterOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const d = r.data;
          if (d?.categories?.length) this.categories.set(d.categories);
          if (d?.exams?.length) this.exams.set(d.exams);
          if (d?.subjects?.length) this.subjects.set(d.subjects);
        },
        error: () => {},
      });
  }

  /** Update the URL (merge); the queryParams subscription reloads. Resets page unless paging. */
  protected patch(changes: Params) {
    const resetPage = !('page' in changes);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: resetPage ? { ...changes, page: null } : changes,
      queryParamsHandling: 'merge',
    });
  }

  protected clearAll() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: null, exam: null, subject: null, sort: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected reload() {
    this.req$.next(this.buildParams());
  }

  private buildParams(): Record<string, string | number> {
    const p: Record<string, string | number> = { page: this.page(), size: PAGE_SIZE };
    if (this.keyword()) p['keyword'] = this.keyword();
    if (this.fCategory().length) p['category'] = this.fCategory().join(',');
    if (this.fExam().length) p['exam'] = this.fExam().join(',');
    if (this.fSubject().length) p['subject'] = this.fSubject().join(',');
    if (this.sort()) p['sort'] = this.sort();
    return p;
  }

  /** Selected-values signal for a given filter key. */
  private listFor(key: FilterKey) {
    return key === 'category' ? this.fCategory : key === 'exam' ? this.fExam : this.fSubject;
  }

  /** Add/remove a value from a multi-select filter and reflect it into the URL. */
  protected toggleFilter(key: FilterKey, value: string) {
    const cur = this.listFor(key)();
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    this.patch({ [key]: next.length ? next.join(',') : null });
  }

  /** Active filters as removable chips (also drives the mobile filter count). */
  protected activeChips(): { key: FilterKey; value: string; label: string }[] {
    const chips: { key: FilterKey; value: string; label: string }[] = [];
    for (const c of this.fCategory()) chips.push({ key: 'category', value: c, label: c });
    for (const e of this.fExam()) chips.push({ key: 'exam', value: e, label: e });
    for (const s of this.fSubject()) chips.push({ key: 'subject', value: s, label: s });
    return chips;
  }

  private parseList(v: unknown): string[] {
    return v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : [];
  }

  /**
   * Windowed page list: first, last, current ±1, with -1 marking an ellipsis
   * gap. Keeps the pager small (~9 items) even with thousands of pages.
   */
  protected pageList(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);

    const wanted = new Set<number>([0, total - 1, cur, cur - 1, cur + 1]);
    const shown = [...wanted].filter((p) => p >= 0 && p < total).sort((a, b) => a - b);

    const out: number[] = [];
    let prev = -2;
    for (const p of shown) {
      if (p - prev > 1) out.push(-1); // ellipsis gap
      out.push(p);
      prev = p;
    }
    return out;
  }
}
