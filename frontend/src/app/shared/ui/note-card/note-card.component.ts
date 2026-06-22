import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Note } from '@core/models';
import { examLabel, initials, rupee, subjectLinedPaper, subjectPaper } from '@shared/util/note-display';

/** Reusable marketplace note card — maps a backend Note to the redesigned Browse card. */
@Component({
  selector: 'app-note-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a class="tnc" [routerLink]="['/notes', note().id]">
      <!-- Cover: real thumbnail when present, else a ruled-paper "handwritten" cover -->
      <div class="tnc-cover" [class.img]="hasThumb()" [style.background]="hasThumb() ? null : coverBg()">
        @if (hasThumb()) {
          <img class="tnc-img" [src]="note().thumbnailUrl" [alt]="note().title" loading="lazy" />
        }
        <div class="tnc-row">
          @if (showSubjectTag()) {
            <span class="tnc-tag" [style.background]="paper().accent">{{ subjectUpper() }}</span>
          }
          @if (note().examType) {
            <span class="tnc-exam">{{ examLabel() }}</span>
          }
        </div>
        <div class="tnc-title" [style.color]="hasThumb() ? '#FFFFFF' : paper().ink">{{ note().title }}</div>
      </div>

      <div class="tnc-body">
        <div class="tnc-seller">
          <span class="tnc-avatar" [style.background]="paper().accent">{{ sellerInitials() }}</span>
          <span class="tnc-name">{{ note().seller?.fullName }}</span>
          @if (note().seller?.verified) {
            <span class="tnc-vrf" title="Verified topper" [style.background]="paper().accent">✓</span>
          }
          @if (chip()) {
            <span class="tnc-chip" [style.color]="paper().accent" [style.background]="paper().chip">{{ chip() }}</span>
          }
        </div>

        <div class="tnc-meta">
          @if (note().reviewCount) {
            <span class="tnc-star">★ {{ ratingText() }}</span>
            <span>({{ note().reviewCount }})</span>
          } @else {
            <span class="tnc-new">New</span>
          }
          @if (note().totalPages) {
            <span class="tnc-dot">·</span><span>{{ note().totalPages }} pages</span>
          }
        </div>

        <div class="tnc-foot">
          <span class="tnc-price">{{ price() }}</span>
          <span class="tnc-view">View</span>
        </div>
      </div>
    </a>
  `,
  styles: [
    `
      .tnc {
        display: flex;
        flex-direction: column;
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        transition:
          transform 0.25s,
          box-shadow 0.25s,
          border-color 0.25s;
      }
      .tnc:hover {
        transform: translateY(-4px);
        box-shadow: 0 20px 40px -20px rgba(22, 20, 30, 0.25);
        border-color: #ddd7c6;
      }
      .tnc:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.3);
      }

      .tnc-cover {
        height: 138px;
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
      }
      .tnc-cover.img {
        padding: 0;
      }
      .tnc-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .tnc-cover.img::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(22, 20, 30, 0.66), rgba(22, 20, 30, 0) 58%);
      }
      .tnc-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .tnc-cover.img .tnc-row {
        position: absolute;
        top: 14px;
        left: 18px;
        right: 18px;
        z-index: 2;
      }
      .tnc-tag {
        color: #fff;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        padding: 4px 10px;
        border-radius: 6px;
        white-space: nowrap;
      }
      .tnc-exam {
        font-size: 11px;
        font-weight: 700;
        color: #8b879a;
        background: rgba(255, 255, 255, 0.78);
        padding: 4px 10px;
        border-radius: 99px;
        white-space: nowrap;
      }
      .tnc-title {
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
      .tnc-cover.img .tnc-title {
        position: relative;
        z-index: 2;
      }

      .tnc-body {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 11px;
        flex: 1;
        font-family: 'Instrument Sans', system-ui, sans-serif;
      }
      .tnc-seller {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tnc-avatar {
        width: 26px;
        height: 26px;
        border-radius: 99px;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10.5px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .tnc-name {
        font-size: 13.5px;
        font-weight: 600;
        color: #16141e;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tnc-vrf {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 15px;
        height: 15px;
        border-radius: 99px;
        color: #fff;
        font-size: 9px;
        flex-shrink: 0;
      }
      .tnc-chip {
        margin-left: auto;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 99px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 44%;
        flex-shrink: 0;
      }
      .tnc-meta {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        color: #5b5870;
        margin-top: auto;
      }
      .tnc-star {
        color: #b8860b;
        font-weight: 600;
      }
      .tnc-new {
        font-weight: 700;
        color: #5840e0;
        background: #efebff;
        padding: 1px 8px;
        border-radius: 99px;
        font-size: 12px;
      }
      .tnc-dot {
        color: #a8a4b8;
      }
      .tnc-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 11px;
        border-top: 1px solid #f0ede2;
      }
      .tnc-price {
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 700;
        font-size: 19px;
        color: #16141e;
        letter-spacing: -0.02em;
      }
      .tnc-view {
        background: #16141e;
        color: #fbfaf6;
        font-size: 13px;
        font-weight: 700;
        padding: 9px 20px;
        border-radius: 99px;
        transition: background 0.2s;
      }
      .tnc:hover .tnc-view {
        background: #5840e0;
      }
    `,
  ],
})
export class NoteCardComponent {
  note = input.required<Note>();

  protected paper = computed(() => subjectPaper(this.note().subject));
  protected coverBg = computed(() => subjectLinedPaper(this.note().subject));
  protected hasThumb = computed(() => !!this.note().thumbnailUrl);
  protected subjectUpper = computed(() => (this.note().subject ?? '').toUpperCase());
  /** Hide the subject tag when it just repeats the title (avoids a duplicate-looking card). */
  protected showSubjectTag = computed(() => {
    const s = (this.note().subject ?? '').trim().toLowerCase();
    const t = (this.note().title ?? '').trim().toLowerCase();
    return !!s && s !== t;
  });
  protected examLabel = computed(() => this.note().exam || examLabel(this.note().examType));
  protected sellerInitials = computed(() => initials(this.note().seller?.fullName));
  protected ratingText = computed(() => (this.note().averageRating ?? 0).toFixed(1));
  protected price = computed(() => rupee(this.note().price));
  /** Small chip beside the seller — their institution when available (e.g. "IIT Bombay"). */
  protected chip = computed(() => this.note().seller?.institution ?? '');
}
