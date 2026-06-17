import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { Note, SellerFullProfile } from '@core/models';
import { TopNavComponent } from '@layout/top-nav/top-nav.component';
import { NoteCardComponent } from '@ui/note-card/note-card.component';
import { initials } from '@shared/util/note-display';

type SortKey = 'newest' | 'price' | 'popular';

interface SubjectGroup {
  subject: string;
  notes: Note[];
  exams: string;
}

@Component({
  selector: 'app-seller-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, LucideAngularModule, TopNavComponent, NoteCardComponent],
  template: `
    <app-top-nav />

    <main class="sp-page">
      <a class="sp-back" routerLink="/browse">← Back to browse</a>

      @if (loading()) {
        <div class="sp-skel sp-skel-head"></div>
        <div class="sp-skel" style="height:280px"></div>
      } @else if (profile()) {
        @if (profile(); as p) {
        <!-- Header -->
        <header class="sp-hero">
          <span class="sp-avatar">
            @if (p.profileImageUrl) {
              <img [src]="p.profileImageUrl" [alt]="p.fullName" />
            } @else {
              {{ ini(p.fullName) }}
            }
          </span>

          <div class="sp-id">
            <div class="sp-name-row">
              <h1>
                {{ p.fullName }}
                @if (p.verified) { <lucide-icon class="sp-verify" name="badge-check" [size]="22" /> }
              </h1>
              <button type="button" class="sp-share" (click)="share()" title="Copy profile link">
                <lucide-icon name="share-2" [size]="15" [strokeWidth]="2" /> Share
              </button>
            </div>
            <div class="sp-meta">
              @if (p.institution) { <span>{{ p.institution }}</span> }
              @if (p.classLevel) { <span class="sp-dot">·</span><span>{{ p.classLevel }}</span> }
              @if (p.joinedAt) { <span class="sp-dot">·</span><span>Joined {{ p.joinedAt | date: 'MMM y' }}</span> }
            </div>
            @if (p.bio) { <p class="sp-bio">{{ p.bio }}</p> }

            <!-- Teaches: domain + exams + subjects at a glance -->
            @if (p.domains.length || p.exams.length || p.subjects.length) {
              <div class="sp-teaches">
                <span class="sp-teaches-lbl">Teaches</span>
                @for (d of p.domains; track d) { <span class="sp-chip dom">{{ d }}</span> }
                @for (e of p.exams; track e) { <span class="sp-chip exam">{{ e }}</span> }
                @for (s of p.subjects; track s) { <span class="sp-chip subj">{{ s }}</span> }
              </div>
            }
          </div>

          <div class="sp-stats">
            <div class="sp-stat"><b>{{ p.totalNotes }}</b><small>{{ p.totalNotes === 1 ? 'note' : 'notes' }}</small></div>
            <div class="sp-stat"><b>{{ p.totalSales | number }}</b><small>sold</small></div>
            <div class="sp-stat"><b>{{ p.learners | number }}</b><small>{{ p.learners === 1 ? 'learner' : 'learners' }}</small></div>
            @if (p.reviewCount > 0) {
              <div class="sp-stat"><b>★ {{ p.averageRating | number: '1.1-1' }}</b><small>{{ p.reviewCount }} {{ p.reviewCount === 1 ? 'review' : 'reviews' }}</small></div>
            } @else {
              <div class="sp-stat new"><b>New</b><small>no reviews yet</small></div>
            }
          </div>
        </header>

        <!-- Catalogue -->
        <section class="sp-catalogue">
          <div class="sp-cat-head">
            <h2>Notes <span class="sp-count">{{ notes().length }}</span></h2>
            <div class="sp-controls">
              @if (p.domains.length > 1) {
                <div class="sp-filter">
                  <button class="sp-pill" [class.on]="domain() === ''" (click)="domain.set('')">All</button>
                  @for (d of p.domains; track d) {
                    <button class="sp-pill" [class.on]="domain() === d" (click)="domain.set(d)">{{ d }}</button>
                  }
                </div>
              }
              @if (notes().length > 1) {
                <div class="sp-sort">
                  @for (s of sortOptions; track s.key) {
                    <button class="sp-pill" [class.on]="sort() === s.key" (click)="sort.set(s.key)">{{ s.label }}</button>
                  }
                </div>
              }
            </div>
          </div>

          @if (groups().length === 0) {
            <div class="sp-empty">
              <lucide-icon name="file-text" [size]="28" [strokeWidth]="1.6" />
              <p>{{ notes().length === 0 ? 'This topper hasn’t published any notes yet.' : 'No notes in ' + domain() + '.' }}</p>
            </div>
          } @else {
            @for (g of groups(); track g.subject) {
              <div class="sp-subject">
                <h3 class="sp-subject-h">
                  {{ g.subject }} <span class="sp-count">{{ g.notes.length }}</span>
                  @if (g.exams) { <span class="sp-subject-exams">{{ g.exams }}</span> }
                </h3>
                <div class="sp-grid">
                  @for (n of g.notes; track n.id) {
                    <div class="sp-card-wrap">
                      @if (n.id === bestSellerId()) { <span class="sp-top-badge">🔥 Top seller</span> }
                      <app-note-card [note]="n" />
                    </div>
                  }
                </div>
              </div>
            }
          }
        </section>
        }
      } @else {
        <div class="sp-empty big">
          <lucide-icon name="user" [size]="32" [strokeWidth]="1.6" />
          <h2>Topper not found</h2>
          <p>This profile doesn’t exist or is no longer available.</p>
          <a class="sp-btn" routerLink="/browse">Browse notes →</a>
        </div>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; background: #fbfaf6; min-height: 100vh; color: #16141e; }
      .sp-page { max-width: 1080px; margin: 0 auto; padding: 24px 24px 64px; }
      .sp-back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: #6b6657; text-decoration: none; background: #fff; border: 1px solid #e9e5d8; border-radius: 99px; padding: 8px 16px; margin-bottom: 20px; }
      .sp-back:hover { border-color: #5840e0; color: #5840e0; }

      /* Hero */
      .sp-hero { display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: start; background: #fff; border: 1px solid #e9e5d8; border-radius: 20px; padding: 28px; }
      .sp-avatar { width: 88px; height: 88px; border-radius: 22px; background: #5840e0; color: #fff; display: grid; place-items: center; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 34px; overflow: hidden; flex: none; }
      .sp-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .sp-id { min-width: 0; }
      .sp-name-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .sp-id h1 { display: flex; align-items: center; gap: 8px; margin: 0; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 28px; letter-spacing: -0.02em; }
      .sp-verify { color: #2563eb; flex: none; }
      .sp-share { display: inline-flex; align-items: center; gap: 6px; flex: none; font: inherit; font-size: 13px; font-weight: 600; color: #6b6657; background: #fff; border: 1px solid #e9e5d8; border-radius: 99px; padding: 7px 14px; cursor: pointer; transition: border-color .12s, color .12s; }
      .sp-share:hover { border-color: #5840e0; color: #5840e0; }
      .sp-teaches { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-top: 14px; }
      .sp-teaches-lbl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #8a8475; margin-right: 2px; }
      .sp-chip { font-size: 12px; font-weight: 600; border-radius: 99px; padding: 4px 11px; border: 1px solid transparent; }
      .sp-chip.dom { color: #5840e0; background: #efebff; border-color: #e0d9ff; font-weight: 700; }
      .sp-chip.exam { color: #2563eb; background: #eef4ff; border-color: #d7e6ff; }
      .sp-chip.subj { color: #4a463c; background: #f1efe7; border-color: #e9e5d8; }
      .sp-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-top: 6px; font-size: 14px; color: #6b6657; }
      .sp-dot { opacity: 0.5; }
      .sp-bio { margin: 12px 0 0; font-size: 14.5px; line-height: 1.6; color: #4a463c; max-width: 620px; }
      .sp-domains { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .sp-domain-chip { font-size: 12.5px; font-weight: 700; color: #5840e0; background: #efebff; border: 1px solid #e0d9ff; border-radius: 99px; padding: 5px 12px; }
      .sp-stats { display: flex; gap: 10px; flex: none; }
      .sp-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; background: #faf8f2; border: 1px solid #e9e5d8; border-radius: 14px; padding: 12px 16px; min-width: 72px; }
      .sp-stat b { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; white-space: nowrap; }
      .sp-stat small { font-size: 11.5px; color: #8a8475; font-weight: 600; }

      /* Catalogue */
      .sp-catalogue { margin-top: 28px; }
      .sp-cat-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 18px; }
      .sp-cat-head h2 { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
      .sp-count { font-size: 13px; font-weight: 700; color: #8a8475; background: #f1efe7; border-radius: 99px; padding: 2px 9px; margin-left: 4px; }
      .sp-controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
      .sp-filter, .sp-sort { display: flex; flex-wrap: wrap; gap: 8px; }
      .sp-pill { font: inherit; font-size: 13px; font-weight: 600; color: #6b6657; background: #fff; border: 1px solid #e9e5d8; border-radius: 99px; padding: 7px 14px; cursor: pointer; transition: border-color .12s, color .12s, background .12s; }
      .sp-pill:hover { border-color: #5840e0; color: #5840e0; }
      .sp-pill.on { background: #5840e0; border-color: #5840e0; color: #fff; }

      .sp-subject { margin-bottom: 28px; }
      .sp-subject-h { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #16141e; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e9e5d8; }
      .sp-subject-exams { font-size: 12px; font-weight: 600; color: #8a8475; margin-left: auto; }
      .sp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: 18px; }
      .sp-card-wrap { position: relative; }
      .sp-top-badge { position: absolute; top: 10px; right: 10px; z-index: 2; font-size: 11px; font-weight: 700; color: #fff; background: #16141e; border-radius: 99px; padding: 4px 10px; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
      .sp-stat.new b { color: #1a9e5f; }

      .sp-empty { text-align: center; color: #8a8475; background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; padding: 48px 24px; }
      .sp-empty lucide-icon { color: #c9c3b2; }
      .sp-empty p { margin: 10px 0 0; font-size: 14px; }
      .sp-empty.big { margin-top: 40px; }
      .sp-empty.big h2 { margin: 12px 0 4px; font-size: 22px; color: #16141e; }
      .sp-btn { display: inline-block; margin-top: 16px; font-size: 14px; font-weight: 700; color: #fff; background: #5840e0; border-radius: 10px; padding: 10px 18px; text-decoration: none; }

      .sp-skel { background: #ece8dd; border-radius: 16px; animation: sp-pulse 1.3s ease infinite; }
      .sp-skel-head { height: 160px; margin-bottom: 20px; }
      @keyframes sp-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }

      @media (max-width: 760px) {
        .sp-hero { grid-template-columns: auto 1fr; }
        .sp-stats { grid-column: 1 / -1; flex-wrap: wrap; }
      }
    `,
  ],
})
export class SellerProfileComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  protected loading = signal(true);
  protected profile = signal<SellerFullProfile | null>(null);
  protected notes = signal<Note[]>([]);
  protected domain = signal('');
  protected sort = signal<SortKey>('newest');

  protected readonly ini = initials;
  protected readonly sortOptions: { key: SortKey; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'price', label: 'Price' },
    { key: 'popular', label: 'Best-selling' },
  ];

  /** The seller's single most-sold note (for the "Top seller" badge); null if none sold. */
  protected bestSellerId = computed<number | null>(() => {
    let best: Note | null = null;
    for (const n of this.notes()) {
      if ((n.purchaseCount ?? 0) > (best?.purchaseCount ?? 0)) best = n;
    }
    return best && (best.purchaseCount ?? 0) > 0 ? best.id : null;
  });

  /** Notes filtered by active domain, sorted, grouped into subject sections (each tagged with its exams). */
  protected groups = computed<SubjectGroup[]>(() => {
    const dom = this.domain();
    const srt = this.sort();
    const list = dom ? this.notes().filter((n) => n.category === dom) : this.notes();
    const map = new Map<string, Note[]>();
    for (const n of list) {
      const key = n.subject || 'Other';
      (map.get(key) ?? map.set(key, []).get(key)!).push(n);
    }
    return [...map.entries()].map(([subject, arr]) => {
      const notes = [...arr].sort((a, b) => {
        if (srt === 'price') return (a.price ?? 0) - (b.price ?? 0);
        if (srt === 'popular') return (b.purchaseCount ?? 0) - (a.purchaseCount ?? 0);
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      });
      const exams = [...new Set(arr.map((n) => n.exam).filter(Boolean))].join(' · ');
      return { subject, notes, exams };
    });
  });

  protected share() {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => this.toast.success('Profile link copied'),
        () => this.toast.error('Could not copy link'),
      );
    } else {
      this.toast.error('Could not copy link');
    }
  }

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => {
      const id = Number(pm.get('id'));
      if (id) this.load(id);
    });
  }

  private load(id: number) {
    this.loading.set(true);
    this.profile.set(null);
    this.notes.set([]);
    this.domain.set('');
    this.sort.set('newest');
    this.api
      .getSellerProfile(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.profile.set(r.data ?? null);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
    this.api
      .getPublicSellerNotes(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.notes.set(r.data ?? []);
          this.cdr.markForCheck();
        },
        error: () => {},
      });
  }
}
