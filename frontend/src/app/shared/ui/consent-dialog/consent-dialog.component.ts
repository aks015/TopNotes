import { ChangeDetectionStrategy, Component, HostListener, effect, inject, signal } from '@angular/core';
import { ConsentDialogService } from '@core/services/consent-dialog.service';

/**
 * Global consent dialog outlet — mount once at the app root (<app-consent>).
 * Shows scrollable agreement text with an explicit "I have read and agree"
 * checkbox; driven entirely by ConsentDialogService.require(...).
 */
@Component({
  selector: 'app-consent',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="modal-scrim"
      [class.open]="state().open"
      role="button"
      tabindex="0"
      aria-label="Dismiss dialog"
      (click)="onScrim($event)"
      (keydown.enter)="dialog.cancel()"
    >
      <div class="modal" style="max-width:560px;" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>{{ state().title || 'Agreement' }}</h3>
        </div>
        <div class="modal-body">
          @if (state().loading) {
            <p class="slate" style="font-size:14px;margin:0;">Loading…</p>
          } @else {
            <div class="consent-text">{{ state().body }}</div>
            <label class="consent-check">
              <input type="checkbox" [checked]="agreed()" (change)="agreed.set($any($event.target).checked)" />
              <span>I have read and agree.</span>
            </label>
            @if (state().error; as e) {
              <p class="consent-err" role="alert">{{ e }}</p>
            }
          }
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" (click)="dialog.cancel()" [disabled]="state().submitting">Cancel</button>
          <button
            class="btn btn-primary"
            (click)="dialog.accept()"
            [disabled]="!agreed() || state().submitting || state().loading"
          >
            {{ state().submitting ? 'Saving…' : 'Agree & continue' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .consent-text {
        white-space: pre-line;
        max-height: 46vh;
        overflow-y: auto;
        font-size: 13.5px;
        line-height: 1.6;
        color: #3e3b52;
        background: #faf9f5;
        border: 1px solid #ece8dd;
        border-radius: 10px;
        padding: 14px 16px;
      }
      .consent-check {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        margin-top: 14px;
        font-size: 14px;
        font-weight: 600;
        color: var(--c-ink, #16141e);
        cursor: pointer;
      }
      .consent-check input {
        margin-top: 2px;
        width: 16px;
        height: 16px;
        cursor: pointer;
        flex-shrink: 0;
      }
      .consent-err {
        margin: 10px 0 0;
        font-size: 13px;
        color: #dc2626;
      }
    `,
  ],
})
export class ConsentDialogComponent {
  protected dialog = inject(ConsentDialogService);
  protected state = this.dialog.state;
  protected agreed = signal(false);

  constructor() {
    // Uncheck the box each time the dialog (re)opens.
    effect(
      () => {
        if (this.state().open) this.agreed.set(false);
      },
      { allowSignalWrites: true },
    );
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    if (this.state().open && !this.state().submitting) this.dialog.cancel();
  }

  protected onScrim(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-scrim') && !this.state().submitting) {
      this.dialog.cancel();
    }
  }
}
