import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { LandingContent, Note, SocialStats } from '@core/models';
import { examLabel } from '@shared/util/note-display';
import { LogoComponent } from '@ui/logo/logo.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe, LucideAngularModule, LogoComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  protected c = signal<LandingContent | null>(null);
  protected notes = signal<Note[]>([]);
  protected trendingNotes = signal<Note[]>([]);
  protected stats = signal<SocialStats | null>(null);
  protected coverage = signal<string[]>([]);
  protected loading = signal(true);

  /** Default brand phrases used when the admin hasn't set any. */
  private readonly defaultValueProps = ['Verified toppers', 'Handwritten notes', 'Instant access'];

  /**
   * Marquee = real coverage (exams + subjects we actually have notes for) interleaved
   * with editable brand value-props. Never advertises an exam we don't carry.
   */
  protected marqueeItems = computed<string[]>(() => {
    const raw = this.c()?.marquee?.items?.length ? this.c()!.marquee!.items! : this.defaultValueProps;
    // includeCoverage off → show only the admin's brand phrases.
    if (this.c()?.marquee?.includeCoverage === false) {
      return raw.filter((x) => !!x);
    }
    const cov = this.coverage();
    const covLower = new Set(cov.map((x) => x.toLowerCase()));
    // Keep only true brand phrases — drop any coverage terms an old config still lists.
    const vp = raw.filter((x) => x && !covLower.has(x.toLowerCase()));
    const out: string[] = [];
    const max = Math.max(vp.length, cov.length);
    for (let i = 0; i < max; i++) {
      if (i < cov.length) out.push(cov[i]);
      if (i < vp.length) out.push(vp[i]);
    }
    return out;
  });

  /** Marquee divider symbol ('✦' default; blank = no divider). */
  protected marqueeSep = computed(() => {
    const s = this.c()?.marquee?.separator;
    return s === undefined || s === null ? '✦' : s;
  });
  /** Scroll duration for the marquee track, from the admin's speed choice. */
  protected marqueeDuration = computed(() => {
    switch (this.c()?.marquee?.speed) {
      case 'slow': return '48s';
      case 'fast': return '18s';
      default: return '32s';
    }
  });
  protected openFaq = signal<number | null>(0);

  protected isLoggedIn = this.auth.isLoggedIn;
  protected isAdmin = this.auth.isAdmin;
  protected canSell = this.auth.canSell;
  protected user = this.auth.user;
  protected readonly examLabel = examLabel;

  /** A logged-in plain buyer (can still upgrade to seller). */
  protected isBuyerOnly = computed(() => this.isLoggedIn() && !this.isAdmin() && !this.canSell());

  /** Stats bar — fully computed from real platform data (not admin-configurable). */
  protected statItems = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { value: s.verifiedSellers, label: s.verifiedSellers === 1 ? 'Verified topper' : 'Verified toppers' },
      { value: s.notesCount, label: s.notesCount === 1 ? 'Note available' : 'Notes available' },
      { value: s.sales, label: s.sales === 1 ? 'Note sold' : 'Notes sold' },
      { value: s.learners, label: s.learners === 1 ? 'Learner' : 'Learners' },
    ];
  });

  // A small palette so subject badges look varied (like the design).
  private readonly subjectPalette: Record<string, { bg: string; fg: string }> = {
    physics: { bg: '#EFEBFF', fg: '#5840E0' },
    chemistry: { bg: '#EEECF4', fg: '#3E3B52' },
    mathematics: { bg: '#FDEEE4', fg: '#C2410C' },
    maths: { bg: '#FDEEE4', fg: '#C2410C' },
    biology: { bg: '#E9FBF0', fg: '#0E8A4D' },
  };

  constructor() {
    this.api
      .getLandingContent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.c.set(r.data ?? null);
          this.loading.set(false);
          // FAQ: open the first answer unless the admin disabled it.
          this.openFaq.set(r.data?.faq?.firstOpen === false ? null : 0);
          // Trending grid — uses the admin's chosen count + source (independent of the hero).
          const np = r.data?.notesPreview;
          this.api
            .getNotes({ page: 0, size: np?.count ?? 4, sort: np?.sort || 'featured' })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (res) => this.trendingNotes.set(res.data?.content ?? []),
              error: () => {},
            });
        },
        error: () => this.loading.set(false),
      });

    // Best notes — top sellers that are also top-rated. Drives the hero
    // showcase cards (top 2) + the rating avatars.
    this.api
      .getNotes({ page: 0, size: 4, sort: 'featured' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.notes.set(r.data?.content ?? []),
        error: () => {},
      });

    // Real social-proof stats — drives the hero rating row (no dummy numbers).
    this.api
      .getSocialStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.stats.set(r.data ?? null),
        error: () => {},
      });

    // Marquee coverage — the exams we actually support, from the admin taxonomy
    // (spanning every category: Engineering, Medical, Civil Services, Banking…).
    // Up to 2 exams per category so every category is represented, not just
    // whichever has the most exams.
    this.api
      .getTaxonomy()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const exams: string[] = [];
          for (const cat of r.data?.categories ?? []) {
            for (const ex of (cat.exams ?? []).slice(0, 2)) exams.push(ex.name);
          }
          this.coverage.set(Array.from(new Set(exams)).slice(0, 16));
        },
        error: () => {},
      });
  }

  protected acctOpen = signal(false);

  /** The signed-in user's workspace — distinct from the public /browse marketplace. */
  protected workspaceLink(): string {
    if (this.isAdmin()) return '/admin/dashboard';
    if (this.canSell()) return '/seller/dashboard';
    return '/my-purchases';
  }
  protected workspaceLabel(): string {
    if (this.isAdmin()) return 'Admin console';
    if (this.canSell()) return 'Seller dashboard';
    return 'My purchases';
  }

  protected toggleAcct(e: Event) {
    e.stopPropagation();
    this.acctOpen.update((v) => !v);
  }

  @HostListener('document:click')
  protected closeAcct() {
    this.acctOpen.set(false);
  }

  protected logout() {
    this.auth.logout();
  }

  /** Smooth-scroll an in-page section to the centre of the viewport. */
  protected scrollTo(id: string, e: Event) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  protected toggleFaq(i: number) {
    this.openFaq.set(this.openFaq() === i ? null : i);
  }

  protected stars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < (rating || 0));
  }

  /** A CTA target is "external" when it's a full URL (use <a href>, not routerLink). */
  protected isExternal(link?: string): boolean {
    return !!link && /^(https?:)?\/\//i.test(link.trim());
  }

  /** "Become a seller" → pre-select the Seller role on the signup wizard. */
  protected regSellerQP(link?: string): Record<string, string> {
    return (link || '/register').startsWith('/register') ? { role: 'seller' } : {};
  }

  /** Highlighter swipe behind the hero's coloured word; null keeps the brand-yellow default. */
  protected markBg(color?: string): string | null {
    return color ? `linear-gradient(180deg, rgba(0,0,0,0) 58%, ${color} 58%)` : null;
  }

  /** Split a headline into plain/highlighted segments by ==marker== syntax (multiple allowed). */
  protected heroSegments(headline?: string): { text: string; mark: boolean }[] {
    if (!headline) return [];
    const out: { text: string; mark: boolean }[] = [];
    const re = /==(.+?)==/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(headline))) {
      if (m.index > last) out.push({ text: headline.slice(last, m.index), mark: false });
      out.push({ text: m[1], mark: true });
      last = m.index + m[0].length;
    }
    if (last < headline.length) out.push({ text: headline.slice(last), mark: false });
    return out;
  }

  protected initials(name: string): string {
    return (name || '?')
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected subjectBg(subject?: string): string {
    return this.subjectPalette[(subject || '').toLowerCase()]?.bg ?? '#EFEBFF';
  }
  protected subjectFg(subject?: string): string {
    return this.subjectPalette[(subject || '').toLowerCase()]?.fg ?? '#5840E0';
  }
}
