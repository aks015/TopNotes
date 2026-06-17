import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LogoComponent } from '@ui/logo/logo.component';

type LegalKind = 'terms' | 'privacy';

interface LegalSection {
  id: string;
  title: string;
  /** Body copy — may contain inline <strong> emphasis (static, trusted content). */
  body: string;
  /** Optional highlighted callout shown under the body. */
  callout?: string;
}

interface LegalDoc {
  /** Handwritten accent above the title. */
  eyebrow: string;
  /** Title lead, e.g. "Terms of". */
  titleLead: string;
  /** Highlighted final word, e.g. "Service". */
  highlight: string;
  intro: string;
  sections: LegalSection[];
  /** Closing handwritten note + line. */
  outroNote: string;
  outroText: string;
}

const TERMS: LegalDoc = {
  eyebrow: 'the boring-but-important bit',
  titleLead: 'Terms of',
  highlight: 'Service',
  intro:
    'These terms govern your use of TopNotes. By creating an account, or buying or selling notes, you agree to them. We’ve kept them short and human — no fine print traps.',
  sections: [
    {
      id: 'accounts',
      title: 'Accounts',
      body: 'You must provide accurate information and keep your login credentials secure — you’re responsible for activity on your account. One person may act as both a <strong>buyer</strong> and a <strong>verified seller</strong>.',
    },
    {
      id: 'selling',
      title: 'Selling notes',
      body: 'Sellers must be verified and may only upload <strong>original, handwritten notes they own</strong>. Uploading copyrighted or fraudulent material leads to removal and suspension.',
      callout: 'Keep the original copies — we may ask to confirm authorship during a marksheet or content review.',
    },
    {
      id: 'buying',
      title: 'Buying notes',
      body: 'Purchases grant <strong>personal, non-transferable access</strong> through the secure in-app viewer. Redistribution, screen capture, or resale of any note is prohibited and may result in account termination.',
    },
    {
      id: 'payments',
      title: 'Payments & payouts',
      body: 'Revenue is split between the platform and the seller at the rate shown at checkout. Payouts are made to the seller’s <strong>verified UPI</strong> once the minimum threshold is met.',
    },
    {
      id: 'changes',
      title: 'Changes',
      body: 'We may update these terms from time to time. Continued use after changes means you accept them — we’ll flag anything significant in-app.',
    },
  ],
  outroNote: 'that’s it →',
  outroText: 'By using TopNotes you agree to the above. Thanks for keeping the marketplace honest for every aspirant.',
};

const PRIVACY: LegalDoc = {
  eyebrow: 'your data, in plain words',
  titleLead: 'Privacy',
  highlight: 'Policy',
  intro:
    'TopNotes respects your privacy. This policy explains what we collect and how we use it. By using the platform you agree to the practices described here.',
  sections: [
    {
      id: 'collect',
      title: 'What we collect',
      body: 'Account details (name, email, phone), payment metadata processed by our payment partner, and the notes you upload or purchase. <strong>We do not store your full payment card or UPI credentials.</strong>',
    },
    {
      id: 'use',
      title: 'How we use it',
      body: 'To run the marketplace — authenticate you, process orders and payouts, verify sellers, and improve the service. <strong>We never sell your personal data.</strong>',
    },
    {
      id: 'content',
      title: 'Your content',
      body: 'Notes you upload remain yours. By listing them you grant us a licence to display, watermark, and deliver them to buyers through the secure viewer.',
    },
    {
      id: 'contact',
      title: 'Contact',
      body: 'Questions about your data? Reach us through the channels listed in the footer — we actually reply.',
    },
  ],
  outroNote: 'that’s it →',
  outroText: 'We keep this short on purpose. If anything’s unclear, just ask — your trust runs the marketplace.',
};

/** Shared legal page (Terms / Privacy) — driven by the route's `data.kind`. */
@Component({
  selector: 'app-legal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LogoComponent],
  template: `
    <!-- Nav -->
    <nav class="lg-nav">
      <div class="lg-nav-inner">
        <a class="lg-brand" routerLink="/" aria-label="TopNotes home"><app-logo [size]="34" [wordSize]="20" /></a>
        <a class="lg-back" routerLink="/">← Back to home</a>
      </div>
    </nav>

    <!-- Hero -->
    <header class="lg-hero">
      <div class="lg-hero-inner">
        <div class="lg-eyebrow">{{ doc().eyebrow }}</div>
        <h1 class="lg-title">
          {{ doc().titleLead }} <span class="lg-hl">{{ doc().highlight }}</span>
        </h1>
        <div class="lg-badges">
          <span class="lg-badge"><i class="lg-dot"></i> Last updated · June 2026</span>
          <span class="lg-badge accent">5-minute read</span>
        </div>
        <p class="lg-intro">{{ doc().intro }}</p>
      </div>
    </header>

    <!-- Body -->
    <div class="lg-body">
      <aside class="lg-toc">
        <div class="lg-toc-label">ON THIS PAGE</div>
        @for (s of doc().sections; track s.id; let i = $index) {
          <a class="lg-toc-link" [href]="'#' + s.id" (click)="scrollTo(s.id, $event)">{{ num(i) }} · {{ s.title }}</a>
        }
        <div class="lg-help">
          <div class="lg-help-title">need a hand?</div>
          <div class="lg-help-text">Questions about these terms? We actually reply.</div>
          <a class="lg-help-link" routerLink="/">Contact support →</a>
        </div>
      </aside>

      <main class="lg-main">
        @for (s of doc().sections; track s.id; let i = $index) {
          <section class="lg-sec" [id]="s.id">
            <div class="lg-sec-head">
              <div class="lg-num">{{ num(i) }}</div>
              <h2 class="lg-sec-title">{{ s.title }}</h2>
            </div>
            <p class="lg-sec-body" [innerHTML]="s.body"></p>
            @if (s.callout) {
              <div class="lg-callout">
                <span class="lg-callout-ic">⚠</span><span>{{ s.callout }}</span>
              </div>
            }
          </section>
        }

        <div class="lg-outro">
          <span class="lg-outro-note">{{ doc().outroNote }}</span>
          <span class="lg-outro-text">{{ doc().outroText }}</span>
        </div>
      </main>
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
        -webkit-font-smoothing: antialiased;
      }

      /* ---- Nav ---- */
      .lg-nav {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(251, 250, 246, 0.88);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border-bottom: 1px solid #ece8dd;
      }
      .lg-nav-inner {
        max-width: 1160px;
        margin: 0 auto;
        padding: 0 28px;
        height: 68px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
      }
      .lg-brand {
        display: inline-flex;
        align-items: center;
        text-decoration: none;
        color: #16141e;
      }
      .lg-brand.light {
        color: #fbfaf6;
      }
      .lg-back {
        text-decoration: none;
        color: #4b4860;
        font-size: 15px;
        font-weight: 600;
        padding: 9px 16px;
        border-radius: 99px;
        border: 1px solid #e2decf;
        background: #fff;
        transition:
          color 0.2s,
          border-color 0.2s;
      }
      .lg-back:hover {
        color: #5840e0;
        border-color: #5840e0;
      }

      /* ---- Hero ---- */
      .lg-hero {
        background: #fff;
        border-bottom: 1px solid #ece8dd;
      }
      .lg-hero-inner {
        max-width: 1160px;
        margin: 0 auto;
        padding: 64px 28px 56px;
      }
      .lg-eyebrow {
        font-family: 'Caveat', cursive;
        font-size: 25px;
        font-weight: 600;
        color: #5840e0;
        margin-bottom: 6px;
      }
      .lg-title {
        margin: 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 60px;
        line-height: 1.02;
        letter-spacing: -0.035em;
        color: #16141e;
      }
      .lg-hl {
        background: linear-gradient(180deg, rgba(0, 0, 0, 0) 58%, #ffe25a 58%);
        padding: 0 6px;
        margin: 0 -2px;
      }
      .lg-badges {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;
        margin-top: 26px;
      }
      .lg-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #fbfaf6;
        border: 1px solid #e9e5d8;
        border-radius: 99px;
        padding: 8px 16px;
        font-size: 13.5px;
        font-weight: 600;
        color: #3e3b52;
      }
      .lg-badge.accent {
        background: #efebff;
        border-color: transparent;
        color: #5840e0;
      }
      .lg-dot {
        width: 7px;
        height: 7px;
        border-radius: 99px;
        background: #0e8a4d;
        display: inline-block;
      }
      .lg-intro {
        margin: 26px 0 0;
        font-size: 19px;
        line-height: 1.65;
        color: #5b5870;
        max-width: 620px;
      }

      /* ---- Body ---- */
      .lg-body {
        max-width: 1160px;
        margin: 0 auto;
        padding: 60px 28px 40px;
        display: grid;
        grid-template-columns: 236px 1fr;
        gap: 72px;
        align-items: start;
      }

      /* TOC */
      .lg-toc {
        position: sticky;
        top: 96px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .lg-toc-label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.14em;
        color: #8b879a;
        margin-bottom: 10px;
      }
      .lg-toc-link {
        text-decoration: none;
        font-size: 15px;
        font-weight: 600;
        color: #4b4860;
        padding: 9px 14px;
        border-radius: 10px;
        border-left: 3px solid transparent;
        transition:
          background 0.18s,
          color 0.18s,
          border-color 0.18s;
      }
      .lg-toc-link:hover {
        background: #fff;
        color: #5840e0;
        border-left-color: #5840e0;
      }
      .lg-help {
        margin-top: 18px;
        background: #16141e;
        border-radius: 14px;
        padding: 18px 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .lg-help-title {
        font-family: 'Caveat', cursive;
        font-size: 20px;
        font-weight: 600;
        color: #ffd84d;
        line-height: 1;
      }
      .lg-help-text {
        font-size: 13.5px;
        color: #a8a4b8;
        line-height: 1.5;
      }
      .lg-help-link {
        text-decoration: none;
        font-size: 13.5px;
        font-weight: 700;
        color: #fbfaf6;
      }
      .lg-help-link:hover {
        color: #8f76ff;
      }

      /* Sections */
      .lg-main {
        display: flex;
        flex-direction: column;
        gap: 14px;
        max-width: 720px;
      }
      .lg-sec {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 20px;
        padding: 36px 38px 34px;
        scroll-margin-top: 96px;
      }
      .lg-sec-head {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 18px;
      }
      .lg-num {
        width: 42px;
        height: 42px;
        border-radius: 13px;
        background: #5840e0;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 18px;
        flex-shrink: 0;
      }
      .lg-sec-title {
        margin: 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 27px;
        letter-spacing: -0.025em;
      }
      .lg-sec-body {
        margin: 0;
        font-size: 17px;
        line-height: 1.7;
        color: #5b5870;
      }
      .lg-sec-body strong {
        color: #16141e;
        font-weight: 600;
      }
      .lg-callout {
        margin-top: 20px;
        display: flex;
        gap: 12px;
        align-items: flex-start;
        background: #fbf7e8;
        border: 1px solid #f2e7b8;
        border-radius: 12px;
        padding: 14px 16px;
        font-size: 14.5px;
        line-height: 1.55;
        color: #7a6a2e;
      }
      .lg-callout-ic {
        color: #b8860b;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .lg-outro {
        margin-top: 14px;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 22px 26px;
        background: #fbfaf6;
        border: 1px dashed #d9d4c5;
        border-radius: 16px;
      }
      .lg-outro-note {
        font-family: 'Caveat', cursive;
        font-size: 24px;
        font-weight: 700;
        color: #5840e0;
        transform: rotate(-3deg);
        flex-shrink: 0;
      }
      .lg-outro-text {
        font-size: 15px;
        color: #5b5870;
        line-height: 1.55;
      }

      /* ---- Responsive ---- */
      @media (max-width: 860px) {
        .lg-title {
          font-size: 44px;
        }
        .lg-body {
          grid-template-columns: 1fr;
          gap: 28px;
        }
        .lg-toc {
          position: static;
        }
        .lg-sec {
          padding: 28px 24px 26px;
        }
      }
    `,
  ],
})
export class LegalComponent {
  private route = inject(ActivatedRoute);
  private data = toSignal(this.route.data);
  protected kind = computed(() => (this.data()?.['kind'] as LegalKind) ?? 'terms');
  protected doc = computed<LegalDoc>(() => (this.kind() === 'privacy' ? PRIVACY : TERMS));

  protected num(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  /** Smooth-scroll to a section without triggering router navigation. */
  protected scrollTo(id: string, e: Event): void {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
