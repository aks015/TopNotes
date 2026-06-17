import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let _uid = 0;

/**
 * Reusable form text field — label + input + error + optional password toggle.
 * Implements ControlValueAccessor, so it drops into reactive forms via formControlName.
 * Project a [fieldAction] (e.g. "Forgot password?") next to the label.
 */
@Component({
  selector: 'app-text-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextFieldComponent), multi: true }],
  template: `
    <div class="field" [class.invalid]="invalid()">
      <div class="label-row">
        <label [attr.for]="id">{{ label() }}</label>
        <ng-content select="[fieldAction]" />
      </div>
      <div
        class="input-wrap"
        [class.has-toggle]="type() === 'password'"
        [class.txt-toggle]="type() === 'password' && toggleMode() === 'text'"
      >
        <input
          #inp
          class="input"
          [id]="id"
          [type]="inputType()"
          [placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          [attr.inputmode]="inputmode()"
          [attr.maxlength]="maxlength()"
          [value]="value()"
          [disabled]="isDisabled()"
          [attr.aria-invalid]="invalid()"
          (input)="onInput($event)"
          (keyup)="onKey($event)"
          (keydown)="onKey($event)"
          (blur)="onTouched()"
        />
        @if (type() === 'password') {
          <button
            type="button"
            class="toggle-pw"
            [class.txt]="toggleMode() === 'text'"
            tabindex="-1"
            (click)="show.set(!show())"
            [attr.aria-label]="show() ? 'Hide password' : 'Show password'"
          >
            @if (toggleMode() === 'text') {
              {{ show() ? 'Hide' : 'Show' }}
            } @else {
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <circle cx="10" cy="10" r="2.2" stroke="currentColor" stroke-width="1.5" />
              </svg>
            }
          </button>
        }
      </div>
      @if (type() === 'password' && capsOn()) {
        <p class="field-caps">⇪ Caps Lock is on</p>
      }
      @if (invalid() && error()) {
        <p class="field-err">{{ error() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .field {
        margin-bottom: var(--field-mb, 18px);
      }
      .label-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
      }
      label {
        display: block;
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
        color: var(--c-ink);
        margin-bottom: 7px;
      }
      .input-wrap {
        position: relative;
      }
      .input {
        width: 100%;
        height: var(--field-h, 46px);
        padding: 0 14px;
        font: inherit;
        font-size: var(--text-base);
        color: var(--c-ink);
        background: var(--c-surface);
        border: 1px solid var(--c-line);
        border-radius: var(--radius-sm);
        transition:
          border-color var(--transition),
          box-shadow var(--transition);
      }
      .input::placeholder {
        color: var(--c-muted);
      }
      .input:hover:not(:disabled) {
        border-color: #d6dae1;
      }
      .input:focus {
        outline: none;
        border-color: var(--c-primary-bright);
        box-shadow: var(--ring);
      }
      .input:disabled {
        background: var(--c-canvas);
        cursor: not-allowed;
      }
      .has-toggle .input {
        padding-right: 46px;
      }
      .field.invalid .input {
        border-color: var(--c-danger);
      }
      .field.invalid .input:focus {
        box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.18);
      }
      .toggle-pw {
        position: absolute;
        top: 0;
        right: 0;
        height: var(--field-h, 46px);
        width: 44px;
        display: grid;
        place-items: center;
        color: var(--c-muted);
        border-radius: var(--radius-sm);
      }
      .toggle-pw:hover {
        color: var(--c-text);
      }
      .toggle-pw:focus-visible {
        outline: none;
        box-shadow: var(--ring);
        color: var(--c-primary-bright);
      }
      .txt-toggle .input {
        padding-right: 64px;
      }
      .toggle-pw.txt {
        width: auto;
        padding: 0 14px;
        font-size: var(--text-xs);
        font-weight: 700;
        color: var(--c-primary-bright);
        user-select: none;
      }
      .toggle-pw.txt:hover {
        color: var(--c-primary);
      }
      .field-err {
        margin-top: 7px;
        font-size: var(--text-xs);
        color: var(--c-danger);
      }
      .field-caps {
        margin-top: 7px;
        font-size: var(--text-xs);
        font-weight: 600;
        color: #b45309;
        display: flex;
        align-items: center;
        gap: 5px;
      }
    `,
  ],
})
export class TextFieldComponent implements ControlValueAccessor, AfterViewInit {
  label = input('');
  type = input<'text' | 'email' | 'password' | 'tel'>('text');
  placeholder = input('');
  autocomplete = input<string | null>(null);
  inputmode = input<string | null>(null);
  maxlength = input<number | null>(null);
  /** Focus this field once the view initialises (one per form, please). */
  autoFocus = input(false);
  invalid = input(false);
  error = input<string | null>(null);
  /** Password reveal affordance: eye icon (default) or a "Show"/"Hide" text label. */
  toggleMode = input<'icon' | 'text'>('icon');

  @ViewChild('inp') private inp?: ElementRef<HTMLInputElement>;

  protected readonly id = `tf-${++_uid}`;
  protected readonly value = signal('');
  protected readonly isDisabled = signal(false);
  protected readonly show = signal(false);
  protected readonly capsOn = signal(false);
  protected readonly inputType = computed(() => (this.type() === 'password' && this.show() ? 'text' : this.type()));

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    if (this.autoFocus()) setTimeout(() => this.inp?.nativeElement.focus());
  }

  protected onInput(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }

  protected onKey(e: KeyboardEvent) {
    if (typeof e.getModifierState === 'function') this.capsOn.set(e.getModifierState('CapsLock'));
  }

  writeValue(v: string): void {
    this.value.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.isDisabled.set(d);
  }
}
