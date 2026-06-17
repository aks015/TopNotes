import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { LandingContent } from '@core/models';
import { LogoComponent } from '@ui/logo/logo.component';

/**
 * Public site footer — the single footer used across the whole site
 * (landing, legal, …). Rendered from the admin-editable landing config.
 */
@Component({
  selector: 'app-site-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LogoComponent, LucideAngularModule],
  template: `
    <footer class="lp-footer">
      <div class="lp-footer-top">
        <div class="lp-footer-brand">
          <a class="lp-brand light" routerLink="/" aria-label="TopNotes home">
            <app-logo [size]="30" [wordSize]="18" />
          </a>
          <p class="lp-footer-tagline">{{ footer()?.tagline }}</p>
          @if (footer()?.social; as soc) {
            <div class="lp-socials">
              @if (soc.instagram) {
                <a [href]="soc.instagram" target="_blank" rel="noopener" aria-label="Instagram"><lucide-icon name="instagram" [size]="18" /></a>
              }
              @if (soc.x) {
                <a [href]="soc.x" target="_blank" rel="noopener" aria-label="X"><lucide-icon name="twitter" [size]="18" /></a>
              }
              @if (soc.linkedin) {
                <a [href]="soc.linkedin" target="_blank" rel="noopener" aria-label="LinkedIn"><lucide-icon name="linkedin" [size]="18" /></a>
              }
              @if (soc.youtube) {
                <a [href]="soc.youtube" target="_blank" rel="noopener" aria-label="YouTube"><lucide-icon name="youtube" [size]="18" /></a>
              }
            </div>
          }
        </div>
        @for (col of footer()?.columns ?? []; track col.title) {
          <div class="lp-footer-col">
            <div class="lp-footer-col-title">{{ col.title }}</div>
            @for (l of col.links; track l.label) {
              @if (useHref(l.href)) {
                <a [href]="l.href">{{ l.label }}</a>
              } @else {
                <a [routerLink]="l.href">{{ l.label }}</a>
              }
            }
          </div>
        }
      </div>
      <div class="lp-footer-bottom">
        <span>© {{ year }} TopNotes · {{ footer()?.legalLine || 'Verified toppers only' }}</span>
        <span>{{ footer()?.madeIn || 'Made in India 🇮🇳' }}</span>
      </div>
    </footer>
  `,
  styles: [
    `
      .lp-footer {
        background: #16141e;
        color: #fbfaf6;
      }
      .lp-brand {
        display: inline-flex;
        align-items: center;
        text-decoration: none;
        color: #16141e;
      }
      .lp-brand.light {
        color: #fbfaf6;
      }
      .lp-footer-top {
        max-width: 1160px;
        margin: 0 auto;
        padding: 64px 28px 0;
        display: grid;
        grid-template-columns: 1.4fr 1fr 1fr 1fr;
        gap: 48px;
      }
      .lp-footer-brand {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .lp-footer-tagline {
        margin: 0;
        font-size: 14.5px;
        color: #a8a4b8;
        line-height: 1.6;
        max-width: 280px;
      }
      .lp-socials {
        display: flex;
        gap: 10px;
      }
      .lp-socials a {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        color: #c9c6d4;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        text-decoration: none;
        transition:
          color 0.15s,
          background 0.15s,
          border-color 0.15s;
      }
      .lp-socials a:hover {
        color: #fff;
        background: var(--indigo, #5840e0);
        border-color: var(--indigo, #5840e0);
      }
      .lp-footer-col {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .lp-footer-col-title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: #6e6a80;
      }
      .lp-footer-col a {
        text-decoration: none;
        color: #c9c6d4;
        font-size: 14.5px;
      }
      .lp-footer-col a:hover {
        color: #fff;
      }
      .lp-footer-bottom {
        max-width: 1160px;
        margin: 48px auto 0;
        padding: 32px 28px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        font-size: 13.5px;
        color: #6e6a80;
        flex-wrap: wrap;
      }
      @media (max-width: 940px) {
        .lp-footer-top {
          grid-template-columns: 1fr 1fr;
          gap: 40px 32px;
        }
        .lp-footer-brand {
          grid-column: 1 / -1;
        }
      }
      @media (max-width: 560px) {
        .lp-footer-top {
          padding: 48px 18px 0;
          gap: 32px 24px;
        }
        .lp-footer-bottom {
          margin-top: 36px;
          padding: 24px 18px;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
      }
    `,
  ],
})
export class SiteFooterComponent {
  footer = input<LandingContent['footer']>();
  protected readonly year = new Date().getFullYear();

  /** Use a plain <a href> for external URLs, mailto/tel, and in-page hash links;
   *  internal paths use routerLink for instant SPA navigation. */
  protected useHref(href?: string): boolean {
    if (!href) return true;
    return /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.includes('#');
  }
}
