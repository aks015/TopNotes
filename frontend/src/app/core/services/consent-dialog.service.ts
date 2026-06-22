import { Injectable, inject, signal } from '@angular/core';
import { AgreementType } from '../models';
import { ConsentService } from './consent.service';

interface ConsentDialogState {
  open: boolean;
  loading: boolean; // fetching agreement text
  submitting: boolean; // recording consent
  title: string;
  body: string;
  error: string | null;
}

const CLOSED: ConsentDialogState = {
  open: false,
  loading: false,
  submitting: false,
  title: '',
  body: '',
  error: null,
};

/**
 * Promise-based "read & accept an agreement" flow. Render once via <app-consent>
 * at the app root, then `await require(type, noteId?)` anywhere a consent gate is
 * needed. Resolves true once the user accepts (and the acceptance is recorded),
 * false if they cancel. One-time agreements already accepted resolve true without
 * showing the dialog.
 */
@Injectable({ providedIn: 'root' })
export class ConsentDialogService {
  private consent = inject(ConsentService);

  private _state = signal<ConsentDialogState>(CLOSED);
  readonly state = this._state.asReadonly();

  private resolver: ((v: boolean) => void) | null = null;
  private type: AgreementType = 'SELLER_AGREEMENT';
  private noteId?: number;

  require(type: AgreementType, noteId?: number): Promise<boolean> {
    this.type = type;
    this.noteId = noteId;
    this._state.set({ ...CLOSED, open: true, loading: true });

    const promise = new Promise<boolean>((resolve) => (this.resolver = resolve));
    this.consent.getAgreement(type).subscribe({
      next: (r) => {
        const a = r.data;
        // One-time agreement already accepted → nothing to show.
        if (a?.accepted && noteId == null) {
          this.close(true);
          return;
        }
        this._state.update((s) => ({ ...s, loading: false, title: a.title, body: a.body }));
      },
      error: () => this.close(false),
    });
    return promise;
  }

  accept(): void {
    if (this._state().submitting) return;
    this._state.update((s) => ({ ...s, submitting: true, error: null }));
    this.consent.recordConsent(this.type, this.noteId).subscribe({
      next: () => this.close(true),
      error: (err) =>
        this._state.update((s) => ({
          ...s,
          submitting: false,
          error: err?.error?.message ?? 'Could not record your consent. Please try again.',
        })),
    });
  }

  cancel(): void {
    this.close(false);
  }

  private close(value: boolean): void {
    this._state.set(CLOSED);
    this.resolver?.(value);
    this.resolver = null;
  }
}
