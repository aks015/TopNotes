import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostBinding,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ReadingProgressService } from '@core/services/reading-progress.service';
import { Note } from '@core/models';

GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';

/**
 * Full-screen secure reader. Renders PDF pages on canvas (no browser download toolbar),
 * bakes a per-user watermark into each page, and applies anti-capture deterrents.
 *
 * Note: OS-level screenshots cannot be fully blocked in a browser. We hide content on
 * capture shortcuts, blur on focus loss / devtools, and stamp every page with a live
 * user-specific watermark so leaked captures remain traceable.
 */
@Component({
  selector: 'app-note-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="viewer">
      <div class="viewer-top">
        <a class="vt-close" routerLink="/my-purchases" aria-label="Close viewer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </a>
        <span class="vt-title">{{ note()?.title || 'Loading…' }}</span>
        <span class="vt-protected">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.7" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7" />
          </svg>
          Protected · view only
        </span>
        @if (totalPages()) {
          <span class="vt-page">Page {{ currentPage() }} / {{ totalPages() }}</span>
        }
      </div>

      <div
        class="viewer-stage secure-stage"
        [class.viewer-blurred]="blurred()"
        [class.viewer-shielded]="shielded()"
      >
        @if (loading()) {
          <div class="viewer-message">Loading secure document…</div>
        } @else if (error()) {
          <div class="viewer-message viewer-message--error">
            <p>Couldn't load this note.</p>
            <a class="btn btn-secondary" routerLink="/my-purchases">Back to My Purchases</a>
          </div>
        } @else {
          <div class="doc-page secure-doc-page">
            <canvas #pageCanvas class="secure-canvas"></canvas>
            <div class="watermark-stamp" aria-hidden="true">{{ watermarkLine() }}</div>
          </div>
        }
      </div>

      @if (!loading() && !error() && totalPages() > 0) {
        <div class="viewer-nav">
          <button type="button" [disabled]="currentPage() <= 1" (click)="prevPage()" aria-label="Previous page">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span class="vn-page">Page {{ currentPage() }}</span>
          <button type="button" [disabled]="currentPage() >= totalPages()" (click)="nextPage()" aria-label="Next page">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      }

      @if (shielded()) {
        <div class="capture-shield" role="alert">
          <div class="capture-shield-box">
            <p>Content hidden</p>
            <small>Screenshots and recording are not permitted on TopNotes.</small>
            <button type="button" class="btn btn-primary" (click)="resumeReading()">Continue reading</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class NoteViewComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private reading = inject(ReadingProgressService);
  private destroyRef = inject(DestroyRef);

  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('pageCanvas');

  @HostBinding('class.secure-viewer-host') protected readonly hostClass = true;

  protected note = signal<Note | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected currentPage = signal(1);
  protected totalPages = signal(0);
  protected blurred = signal(false);
  protected shielded = signal(false);
  protected liveStamp = signal(this.formatStamp());

  private id = Number(this.route.snapshot.paramMap.get('id'));
  private pdfDoc: PDFDocumentProxy | null = null;
  private rendering = false;
  private devToolsTimer: ReturnType<typeof setInterval> | null = null;
  private stampTimer: ReturnType<typeof setInterval> | null = null;
  private shieldTimer: ReturnType<typeof setTimeout> | null = null;

  protected watermarkLine = computed(() => {
    const email = this.auth.user()?.email ?? 'TopNotes';
    return `${email} · Note #${this.id} · ${this.liveStamp()} · TopNotes`;
  });

  constructor() {
    document.body.classList.add('viewer-mode');

    this.stampTimer = setInterval(() => {
      this.liveStamp.set(this.formatStamp());
    }, 1000);

    this.devToolsTimer = setInterval(() => this.checkDevTools(), 1500);

    this.api
      .getNote(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.note.set(r.data);
          if (r.data.totalPages) this.totalPages.set(r.data.totalPages);
          this.recordProgress();
        },
        error: () => {},
      });

    this.api
      .getNotePdf(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => void this.loadPdf(blob),
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });

    this.destroyRef.onDestroy(() => {
      document.body.classList.remove('viewer-mode');
      if (this.devToolsTimer) clearInterval(this.devToolsTimer);
      if (this.stampTimer) clearInterval(this.stampTimer);
      if (this.shieldTimer) clearTimeout(this.shieldTimer);
      void this.pdfDoc?.destroy();
      this.pdfDoc = null;
    });
  }

  protected resumeReading(): void {
    this.shielded.set(false);
    this.blurred.set(false);
    void this.renderCurrentPage();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;

    const captureShortcut =
      key === 'printscreen' ||
      (mod && event.shiftKey && ['3', '4', '5', '6', 's'].includes(key)) ||
      (event.metaKey && event.shiftKey && key === 's');

    const blockedShortcut =
      captureShortcut ||
      (mod && ['s', 'p', 'u', 'c', 'a'].includes(key)) ||
      (mod && event.shiftKey && key === 'i') ||
      key === 'f12';

    if (blockedShortcut) {
      event.preventDefault();
      event.stopPropagation();
      this.activateShield();
    }
  }

  @HostListener('document:visibilitychange')
  protected onVisibilityChange(): void {
    if (document.hidden) {
      this.activateShield();
    }
  }

  @HostListener('window:blur')
  protected onWindowBlur(): void {
    this.blurred.set(true);
    this.clearCanvas();
  }

  @HostListener('window:focus')
  protected onWindowFocus(): void {
    if (!document.hidden && !this.shielded()) {
      this.blurred.set(false);
      void this.renderCurrentPage();
    }
  }

  @HostListener('document:copy', ['$event'])
  @HostListener('document:cut', ['$event'])
  protected blockCopy(event: ClipboardEvent): void {
    event.preventDefault();
    this.activateShield();
  }

  @HostListener('window:beforeprint')
  protected onBeforePrint(): void {
    this.activateShield();
  }

  @HostListener('contextmenu', ['$event'])
  protected onContextMenu(event: Event): void {
    event.preventDefault();
  }

  protected prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
      void this.renderCurrentPage();
      this.recordProgress();
    }
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
      void this.renderCurrentPage();
      this.recordProgress();
    }
  }

  /** Save this note to "Continue Reading" (dedupes + moves to front). */
  private recordProgress(): void {
    const n = this.note();
    if (!n || this.totalPages() < 1) return;
    this.reading.record({
      noteId: this.id,
      title: n.title,
      subject: n.subject,
      lastPage: this.currentPage(),
      totalPages: this.totalPages(),
    });
  }

  private formatStamp(): string {
    return new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  private checkDevTools(): void {
    const gap = window.outerWidth - window.innerWidth;
    const gapY = window.outerHeight - window.innerHeight;
    if (gap > 160 || gapY > 160) {
      this.activateShield();
    }
  }

  private activateShield(): void {
    this.shielded.set(true);
    this.blurred.set(true);
    this.clearCanvas();

    if (this.shieldTimer) clearTimeout(this.shieldTimer);
    this.shieldTimer = setTimeout(() => {
      if (document.hidden) return;
    }, 4000);
  }

  private clearCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  private async loadPdf(blob: Blob): Promise<void> {
    try {
      const data = await blob.arrayBuffer();
      this.pdfDoc = await getDocument({ data, disableAutoFetch: false, disableStream: false }).promise;
      this.totalPages.set(this.pdfDoc.numPages);
      // Resume where the buyer left off (clamped to the document length).
      this.currentPage.set(Math.min(Math.max(this.reading.pageFor(this.id), 1), this.pdfDoc.numPages));
      this.loading.set(false);
      await this.renderCurrentPage();
      this.recordProgress();
    } catch {
      this.loading.set(false);
      this.error.set(true);
    }
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.pdfDoc || this.rendering || this.shielded()) return;

    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      window.setTimeout(() => void this.renderCurrentPage(), 0);
      return;
    }

    this.rendering = true;
    try {
      const page = await this.pdfDoc.getPage(this.currentPage());
      const baseViewport = page.getViewport({ scale: 1 });
      const maxWidth = Math.min(720, window.innerWidth - 48);
      const scale = maxWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;
      this.drawWatermark(ctx, viewport.width, viewport.height);
    } finally {
      this.rendering = false;
    }
  }

  private drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const buyer = this.auth.user()?.email ?? 'TopNotes user';
    const seller = this.note()?.seller?.fullName;
    ctx.save();
    ctx.textAlign = 'center';

    // Light diagonal tiling of the buyer's id — keeps leaks traceable while
    // staying faint enough to read the note through it.
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#475467';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-30 * (Math.PI / 180));
    for (let y = -height * 1.2; y < height * 1.2; y += 150) {
      for (let x = -width * 1.2; x < width * 1.2; x += 340) {
        ctx.fillText(buyer, x, y);
      }
    }
    ctx.restore();

    // Top: the seller (note author) name.
    if (seller) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#5B4BE0';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(`Notes by ${seller}`, width / 2, 24);
    }
    ctx.restore();
  }
}
