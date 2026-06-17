import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * TopNotes brand logo — layered note mark (yellow sheet behind indigo "T" card)
 * plus an optional lowercase wordmark.
 *
 * The wordmark inherits its colour from the surrounding context (set `color`
 * on the parent link: ink on light surfaces, cream on dark); the trailing dot
 * is always amber.
 *
 *   <app-logo />                          mark + wordmark (34px / 20px)
 *   <app-logo [size]="28" [wordmark]="false" />   mark only
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 36 36"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="8" y="2" width="24" height="24" rx="6" fill="#FFD84D" transform="rotate(8 20 14)" />
      <rect x="3" y="9" width="24" height="24" rx="6" fill="#5840E0" />
      <rect x="9.4" y="14.6" width="11.2" height="3.2" rx="1.6" fill="#FFFFFF" />
      <rect x="13.4" y="14.6" width="3.2" height="12.6" rx="1.6" fill="#FFFFFF" />
    </svg>
    @if (wordmark()) {
      <span class="word" [style.font-size.px]="wordSize()">topnotes<i>.</i></span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        line-height: 1;
      }
      svg {
        flex: none;
      }
      .word {
        font-family: 'Bricolage Grotesque', sans-serif;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: inherit;
      }
      .word i {
        font-style: normal;
        color: #f5a524;
      }
    `,
  ],
})
export class LogoComponent {
  /** Square size of the SVG mark, in px. */
  size = input(34);
  /** Render the lowercase "topnotes." wordmark next to the mark. */
  wordmark = input(true);
  /** Wordmark font size, in px. */
  wordSize = input(20);
}
