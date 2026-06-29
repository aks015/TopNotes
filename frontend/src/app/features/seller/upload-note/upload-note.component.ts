import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpEventType } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { debounceTime } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ConsentService } from '@core/services/consent.service';
import { Note, TaxonomyCategory } from '@core/models';
import { rupee, toTitleCase } from '@shared/util/note-display';
import { NoteCardComponent } from '@ui/note-card/note-card.component';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

@Component({
  selector: 'app-upload-note',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NoteCardComponent, RouterLink, ImageCropperComponent],
  template: `
    <div class="up">
      <!-- Header -->
      <header class="up-head">
        <div class="up-eyebrow">seller studio</div>
        <h1 class="up-title">{{ editMode() ? 'Edit listing' : 'Upload a note' }}</h1>
        <p class="up-sub">
          {{
            editMode()
              ? 'Update your listing — changes go live immediately.'
              : 'Add a new set of notes to the marketplace.'
          }}
        </p>
      </header>

      @if (!auth.isVerified()) {
        <div class="up-verify">
          <span class="up-verify-ic">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2.5 4 6v5c0 5 3.5 8 8 9.5 4.5-1.5 8-4.5 8-9.5V6l-8-3.5Z"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round"
              />
              <path d="M12 8.5v4M12 16v.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
          </span>
          <div class="up-verify-tx">
            <b>Verify your account to publish</b>
            <span
              >You can prepare your listing now, but publishing needs a one-time check — pass a short test and upload
              your marksheet.</span
            >
          </div>
          <a class="up-btn primary" routerLink="/seller/qualifications">Get qualified</a>
        </div>
      }

      @if (draftRestored()) {
        <div class="up-draft">
          <span>↩︎ We restored your unsaved draft.</span>
          <button type="button" class="up-draft-x" (click)="discardDraft()">Start fresh</button>
        </div>
      }

      <form class="up-grid" [formGroup]="form" (ngSubmit)="publish()">
        <div class="up-main">
          <!-- 1 · Details -->
          <section class="up-card">
            <div class="up-sec-head">
              <span class="up-num">1</span>
              <div>
                <h3>Details</h3>
                <p>Tell buyers what's inside.</p>
              </div>
            </div>

            <div class="up-field" [class.invalid]="invalid('title')">
              <div class="up-label-row">
                <label class="up-label" for="up-title">Title</label>
                <span class="up-count" [class.ok]="titleLen() >= 5">{{ titleLen() }}/5+</span>
              </div>
              <input
                id="up-title"
                class="up-input"
                formControlName="title"
                placeholder="e.g. Organic Chemistry — Reaction Mechanisms"
                (blur)="titleCase('title')"
              />
              <div class="up-err">Title must be at least 5 characters.</div>
            </div>

            <div class="up-field" [class.invalid]="invalid('description')">
              <div class="up-label-row">
                <label class="up-label" for="up-desc">Description</label>
                <span class="up-count" [class.ok]="descLen() >= 20">{{ descLen() }}/20+</span>
              </div>
              <textarea
                id="up-desc"
                class="up-textarea"
                formControlName="description"
                placeholder="What topics are covered? What makes these notes useful? Mention chapters, exam focus, and what makes your handwriting/explanations stand out."
              ></textarea>
              <div class="up-err">Description must be at least 20 characters.</div>
            </div>

            <div class="up-row2">
              <div class="up-field" [class.invalid]="invalid('category')">
                <div class="up-label-row">
                  <label class="up-label" for="up-category">Exam category</label>
                  @if (eligible().length) {
                    <span class="up-count">🔒 your domain</span>
                  }
                </div>
                <select id="up-category" class="up-select" formControlName="category">
                  <option value="" disabled>Select a category…</option>
                  @for (c of categories(); track c.id) {
                    <option [value]="c.name">{{ c.name }}</option>
                  }
                </select>
                @if (eligible().length) {
                  <p class="up-hint">Locked to the domain you're verified in.</p>
                } @else {
                  <div class="up-err">Choose an exam category.</div>
                }
              </div>
              <div class="up-field" [class.invalid]="invalid('exam')">
                <label class="up-label" for="up-exam">Exam</label>
                <select
                  id="up-exam"
                  class="up-select"
                  formControlName="exam"
                  [class.muted]="!examsForCategory().length"
                >
                  <option value="" disabled>{{ fv().category ? 'Select an exam…' : 'Pick a category first' }}</option>
                  @for (e of examsForCategory(); track e.id) {
                    <option [value]="e.name">{{ e.name }}</option>
                  }
                </select>
                <div class="up-err">Choose an exam.</div>
              </div>
            </div>

            <div class="up-row2">
              <div class="up-field" [class.invalid]="invalid('subject')">
                <label class="up-label" for="up-subject">Subject</label>
                <select
                  id="up-subject"
                  class="up-select"
                  formControlName="subject"
                  [class.muted]="!subjectsForExam().length"
                >
                  <option value="" disabled>{{ fv().exam ? 'Select a subject…' : 'Pick an exam first' }}</option>
                  @for (s of subjectsForExam(); track s.id) {
                    <option [value]="s.name">{{ s.name }}</option>
                  }
                </select>
                <div class="up-err">Choose a subject.</div>
              </div>
              <div class="up-field">
                <div class="up-label-row">
                  <label class="up-label" for="up-level">Level / stage</label>
                  <span class="up-count">optional</span>
                </div>
                <input
                  id="up-level"
                  class="up-input"
                  formControlName="level"
                  placeholder="e.g. Class 12, Prelims, Foundation"
                  (blur)="titleCase('level')"
                />
              </div>
            </div>

            <div class="up-row2">
              <div class="up-field" [class.invalid]="invalid('price')">
                <label class="up-label" for="up-price">Price (₹)</label>
                <input id="up-price" class="up-input" type="number" formControlName="price" placeholder="199" />
                <div class="up-err">Set a price (₹1 or more).</div>
              </div>
              <div class="up-field up-price-tip">
                @if (suggestedPrice() != null) {
                  <span>
                    Similar {{ fv().exam }} · {{ fv().subject }} notes sell around <b>{{ rupee(suggestedPrice()!) }}</b
                    >.
                    <button type="button" class="up-link" (click)="applySuggestedPrice()">Use this</button>
                  </span>
                } @else {
                  <span>Buyers see this price on your card. You can change it later from Manage notes.</span>
                }
              </div>
            </div>
          </section>

          <!-- 2 · Files -->
          <section class="up-card">
            <div class="up-sec-head">
              <span class="up-num">2</span>
              <div>
                <h3>Files</h3>
                <p>Upload the notes PDF and an optional cover.</p>
              </div>
            </div>

            <input #pdfInput type="file" accept="application/pdf" hidden (change)="onPdf($any($event.target).files)" />
            <!-- Single PDF: the dropzone hides once a file is chosen (Replace/Remove from the file row). -->
            @if (!pdfFile()) {
              <div
                class="up-drop"
                role="button"
                tabindex="0"
                [class.drag]="dragging()"
                [class.err]="submitAttempted() && !pdfFile() && !editMode()"
                (click)="pdfInput.click()"
                (keydown.enter)="pdfInput.click()"
                (dragover)="$event.preventDefault(); dragging.set(true)"
                (dragleave)="dragging.set(false)"
                (drop)="$event.preventDefault(); dragging.set(false); onPdf($any($event).dataTransfer.files)"
              >
                <div class="up-drop-ic">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 15V4m0 0L8 8m4-4 4 4"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    />
                  </svg>
                </div>
                <h4>{{ editMode() ? 'Replace PDF (optional)' : 'Drag & drop your PDF here' }}</h4>
                <p>or click to browse · PDF only · max 50MB</p>
              </div>
              @if (editMode() && hasExistingPdf()) {
                <div class="up-hint">Current PDF is kept unless you upload a new one.</div>
              }
            }
            @if (submitAttempted() && !pdfFile() && !editMode()) {
              <div class="up-drop-err">The notes PDF is required to publish.</div>
            }

            @if (pdfFile(); as f) {
              <div class="up-file">
                <span class="up-file-ic">PDF</span>
                <div class="up-file-body">
                  <div class="up-file-name">{{ f.name }}</div>
                  <div class="up-file-sub">
                    {{ (f.size / 1048576).toFixed(1) }} MB · check it's the right file below
                  </div>
                </div>
                <button type="button" class="up-btn outline sm" (click)="clearPdf(); pdfInput.click()">Replace</button>
                <button type="button" class="up-btn ghost sm" (click)="clearPdf()">Remove</button>
              </div>
              @if (pdfPreviewSrc(); as src) {
                <iframe class="up-pdf-preview" [src]="src" title="PDF preview"></iframe>
              }
            }

            <input
              #thumbInput
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              (change)="onThumb($any($event.target).files)"
            />
            @if (thumbUrl(); as t) {
              <div class="up-file">
                <img class="up-file-thumb" [src]="t" alt="Cover preview" />
                <div class="up-file-body">
                  <div class="up-file-name">Cover image</div>
                  <div class="up-file-sub">Shown on the note card</div>
                </div>
                @if (cropSource()) {
                  <button type="button" class="up-btn outline sm" (click)="editCover()">Edit</button>
                }
                <button type="button" class="up-btn ghost sm" (click)="removeThumb()">Remove</button>
              </div>
            } @else {
              <button type="button" class="up-btn outline sm up-add-cover" (click)="thumbInput.click()">
                + Add cover image (optional)
              </button>
              <p class="up-hint">No cover? A clean ruled-paper cover is generated for you automatically.</p>
            }
          </section>

          <!-- Cover crop modal -->
          @if (cropOpen() && cropSource(); as src) {
            <div class="up-crop-scrim" (click)="cancelCrop()">
              <div class="up-crop" (click)="$event.stopPropagation()">
                <h3>Crop your cover</h3>
                <p class="up-crop-sub">Frame it the way it should appear on your note card.</p>
                <div class="up-crop-stage">
                  <image-cropper
                    [imageFile]="src"
                    [maintainAspectRatio]="true"
                    [aspectRatio]="16 / 9"
                    [resizeToWidth]="1000"
                    format="webp"
                    (imageCropped)="onCropped($event)"
                  />
                </div>
                <div class="up-crop-foot">
                  <button type="button" class="up-btn ghost" (click)="cancelCrop()">Cancel</button>
                  <button type="button" class="up-btn primary" [disabled]="!croppedReady()" (click)="useCrop()">
                    Use this cover
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- 3 · Review & publish -->
          <section class="up-card">
            <div class="up-sec-head">
              <span class="up-num">3</span>
              <div>
                <h3>Review &amp; publish</h3>
                <p>Check the preview, then publish to the marketplace.</p>
              </div>
            </div>

            @if (auth.isVerified()) {
              @if (!editMode()) {
                <label class="up-agree">
                  <input type="checkbox" [checked]="agreed()" (change)="agreed.set($any($event.target).checked)" />
                  <span>I confirm these are my own original notes and I have the right to sell them on TopNotes.</span>
                </label>
              }

              @if (missing().length) {
                <ul class="up-checklist">
                  @for (m of missing(); track m) {
                    <li>Add {{ m }}</li>
                  }
                </ul>
              } @else {
                <p class="up-ready">
                  ✓ {{ editMode() ? 'Looks good — save your changes.' : 'Ready to publish — your listing looks good.' }}
                </p>
              }

              @if (publishing() && uploadPct() > 0) {
                <div class="up-progress" role="progressbar" [attr.aria-valuenow]="uploadPct()">
                  <i [style.width.%]="uploadPct()"></i>
                  <span>{{ uploadPct() }}%</span>
                </div>
              }

              <button type="submit" class="up-btn primary lg" [disabled]="publishing()">
                {{
                  publishing()
                    ? uploadPct() < 100 && uploadPct() > 0
                      ? 'Uploading ' + uploadPct() + '%…'
                      : 'Saving…'
                    : editMode()
                      ? 'Save changes'
                      : 'Publish note'
                }}
              </button>
            } @else {
              <a class="up-btn primary lg" routerLink="/seller/qualifications">Get qualified to publish</a>
            }
          </section>
        </div>

        <!-- Live preview -->
        <aside class="up-preview">
          <div class="up-preview-label">Live preview · how it appears in Browse</div>
          <app-note-card [note]="previewNote()" />
          <p class="up-preview-note">This is exactly how buyers will see your card on the Browse page.</p>
        </aside>
      </form>
    </div>
  `,
  styles: [
    `
      .up {
        max-width: 1280px;
        margin: 0 auto;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        color: #16141e;
      }

      /* Header */
      .up-eyebrow {
        font-family: 'Caveat', cursive;
        font-size: 22px;
        font-weight: 600;
        color: #5840e0;
      }
      .up-title {
        margin: 2px 0 6px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 38px;
        letter-spacing: -0.03em;
      }
      .up-sub {
        margin: 0 0 24px;
        font-size: 15px;
        color: #5b5870;
      }

      /* Verify banner */
      .up-verify {
        display: flex;
        align-items: center;
        gap: 14px;
        background: #fff6e6;
        border: 1px solid #f3e0b8;
        border-radius: 16px;
        padding: 16px 18px;
        margin-bottom: 22px;
      }
      .up-verify-ic {
        color: #c47f17;
        flex: none;
      }
      .up-verify-tx {
        flex: 1;
        display: flex;
        flex-direction: column;
        line-height: 1.4;
      }
      .up-verify-tx b {
        font-size: 14.5px;
      }
      .up-verify-tx span {
        font-size: 13px;
        color: #5b5870;
      }

      /* Layout */
      .up-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 22px;
        align-items: start;
      }
      .up-main {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .up-card {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 16px;
        padding: 22px 24px;
      }
      .up-sec-head {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 18px;
      }
      .up-num {
        width: 28px;
        height: 28px;
        border-radius: 99px;
        background: #5840e0;
        color: #fff;
        font-weight: 800;
        font-size: 14px;
        display: grid;
        place-items: center;
        flex: none;
      }
      .up-sec-head h3 {
        margin: 0;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-size: 18px;
        font-weight: 700;
      }
      .up-sec-head p {
        margin: 2px 0 0;
        font-size: 13.5px;
        color: #8b879a;
      }

      /* Fields */
      .up-field {
        margin-bottom: 16px;
      }
      .up-field:last-child {
        margin-bottom: 0;
      }
      .up-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .up-label {
        display: block;
        font-size: 13px;
        font-weight: 700;
        color: #4b4860;
        margin-bottom: 7px;
      }
      .up-count {
        font-size: 11.5px;
        font-weight: 700;
        color: #b6b1c4;
      }
      .up-count.ok {
        color: #1a9e5f;
      }
      .up-input,
      .up-textarea,
      .up-select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #e2decf;
        border-radius: 12px;
        padding: 12px 14px;
        font: inherit;
        font-size: 14.5px;
        color: #16141e;
        background: #fff;
        transition:
          border-color 0.16s,
          box-shadow 0.16s;
      }
      .up-textarea {
        min-height: 116px;
        resize: vertical;
      }
      .up-input:focus,
      .up-textarea:focus,
      .up-select:focus {
        outline: none;
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }
      .up-select {
        appearance: none;
        -webkit-appearance: none;
        background: #fff
          url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235b5870' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")
          no-repeat right 14px center;
        padding-right: 38px;
        cursor: pointer;
      }
      .up-row2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-bottom: 16px;
      }
      .up-row2:last-child {
        margin-bottom: 0;
      }
      .up-select.muted {
        color: #a8a4b8;
      }
      .up-select:disabled {
        background-color: #f3f1ea;
        color: #4b4860;
        cursor: not-allowed;
        opacity: 1;
      }
      .up-price-tip {
        display: flex;
        align-items: flex-end;
      }
      .up-price-tip span {
        font-size: 12px;
        color: #a8a4b8;
        line-height: 1.4;
        padding-bottom: 12px;
      }
      .up-err {
        display: none;
        margin-top: 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: #d8453b;
      }
      .up-field.invalid .up-input,
      .up-field.invalid .up-textarea {
        border-color: #f0b4ae;
      }
      .up-field.invalid .up-err {
        display: block;
      }

      /* Dropzone */
      .up-drop {
        border: 2px dashed #d9d3c2;
        border-radius: 14px;
        padding: 34px 16px;
        text-align: center;
        cursor: pointer;
        background: #fbfaf6;
        transition:
          border-color 0.16s,
          background 0.16s;
      }
      .up-drop:hover,
      .up-drop.drag {
        border-color: #5840e0;
        background: #f7f5ff;
      }
      .up-drop.err {
        border-color: #f0b4ae;
        background: #fdf4f3;
      }
      .up-drop-ic {
        width: 48px;
        height: 48px;
        margin: 0 auto 10px;
        border-radius: 12px;
        background: #efebff;
        color: #5840e0;
        display: grid;
        place-items: center;
      }
      .up-drop h4 {
        margin: 0 0 3px;
        font-size: 15.5px;
        font-weight: 700;
      }
      .up-drop p {
        margin: 0;
        font-size: 13px;
        color: #8b879a;
      }
      .up-drop-err {
        margin-top: 8px;
        font-size: 12.5px;
        font-weight: 600;
        color: #d8453b;
      }
      .up-file {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
        padding: 12px 14px;
        border: 1px solid #eee9dc;
        border-radius: 12px;
        background: #fff;
      }
      .up-file-ic {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #fdeceb;
        color: #d8453b;
        font-size: 11px;
        font-weight: 800;
        display: grid;
        place-items: center;
        flex: none;
      }
      .up-file-thumb {
        width: 48px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
        flex: none;
      }
      .up-file-body {
        flex: 1;
        min-width: 0;
      }
      .up-file-name {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .up-file-sub {
        font-size: 12.5px;
        color: #8b879a;
      }
      .up-add-cover {
        margin-top: 12px;
      }
      /* Cover crop modal */
      .up-crop-scrim {
        position: fixed;
        inset: 0;
        background: rgba(22, 20, 30, 0.55);
        display: grid;
        place-items: center;
        z-index: 100;
        padding: 24px;
      }
      .up-crop {
        background: #fff;
        border-radius: 18px;
        padding: 22px;
        width: min(560px, 100%);
      }
      .up-crop h3 {
        margin: 0 0 4px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 700;
        font-size: 19px;
      }
      .up-crop-sub {
        margin: 0 0 14px;
        font-size: 13.5px;
        color: #5b5870;
      }
      .up-crop-stage {
        background: #f3f1ea;
        border-radius: 12px;
        overflow: hidden;
      }
      .up-crop-stage image-cropper {
        max-height: 52vh;
        display: block;
      }
      .up-crop-foot {
        display: flex;
        gap: 10px;
        margin-top: 16px;
      }
      .up-crop-foot .up-btn {
        flex: 1;
      }
      .up-hint {
        margin: 8px 0 0;
        font-size: 12.5px;
        color: #a8a4b8;
      }
      .up-pdf-preview {
        width: 100%;
        height: 320px;
        margin-top: 12px;
        border: 1px solid #eee9dc;
        border-radius: 12px;
        background: #fbfaf6;
      }

      /* Draft banner */
      .up-draft {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #eef4ff;
        border: 1px solid #cfe0ff;
        border-radius: 12px;
        padding: 10px 16px;
        margin-bottom: 18px;
        font-size: 13.5px;
        color: #2b4a7a;
      }
      .up-draft-x {
        margin-left: auto;
        border: none;
        background: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        color: #2563eb;
      }
      .up-draft-x:hover {
        text-decoration: underline;
      }

      /* Suggested price link */
      .up-link {
        border: none;
        background: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        color: #5840e0;
        padding: 0;
      }
      .up-link:hover {
        text-decoration: underline;
      }

      /* Originality checkbox */
      .up-agree {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 13.5px;
        color: #4b4860;
        margin-bottom: 16px;
        cursor: pointer;
        line-height: 1.45;
      }
      .up-agree input {
        margin-top: 2px;
        width: 16px;
        height: 16px;
        accent-color: #5840e0;
        flex: none;
      }

      /* Upload progress */
      .up-progress {
        position: relative;
        height: 28px;
        border-radius: 99px;
        background: #f0ede4;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .up-progress i {
        display: block;
        height: 100%;
        background: #5840e0;
        transition: width 0.2s ease;
      }
      .up-progress span {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 700;
        color: #16141e;
      }

      /* Checklist + ready */
      .up-checklist {
        margin: 0 0 16px;
        padding-left: 18px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .up-checklist li {
        font-size: 13.5px;
        color: #8b879a;
      }
      .up-ready {
        margin: 0 0 16px;
        font-size: 13.5px;
        font-weight: 700;
        color: #1a9e5f;
      }

      /* Buttons */
      .up-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-decoration: none;
        font-size: 14px;
        font-weight: 700;
        padding: 11px 20px;
        border-radius: 99px;
        border: none;
        cursor: pointer;
        transition:
          background 0.18s,
          color 0.18s,
          border-color 0.18s;
      }
      .up-btn.primary {
        background: #16141e;
        color: #fbfaf6;
      }
      .up-btn.primary:hover:not(:disabled) {
        background: #5840e0;
      }
      .up-btn.lg {
        padding: 13px 30px;
        font-size: 15px;
      }
      .up-btn.ghost {
        background: transparent;
        color: #8b879a;
      }
      .up-btn.ghost:hover {
        color: #d8453b;
      }
      .up-btn.outline {
        background: #fff;
        border: 1px solid #e2decf;
        color: #4b4860;
      }
      .up-btn.outline:hover {
        border-color: #5840e0;
        color: #5840e0;
      }
      .up-btn.sm {
        padding: 8px 14px;
        font-size: 13px;
      }
      .up-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }

      /* Preview */
      .up-preview {
        position: sticky;
        top: 96px;
      }
      .up-preview-label {
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #a8a4b8;
        margin-bottom: 12px;
      }
      .up-preview-note {
        margin: 12px 2px 0;
        font-size: 12.5px;
        color: #a8a4b8;
      }

      @media (max-width: 940px) {
        .up-grid {
          grid-template-columns: 1fr;
        }
        .up-preview {
          position: static;
          max-width: 360px;
        }
      }
      @media (max-width: 560px) {
        .up-title {
          font-size: 30px;
        }
        .up-row2 {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class UploadNoteComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  private toast = inject(ToastService);
  private consent = inject(ConsentService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private readonly DRAFT_KEY = 'tn_upload_draft';

  protected editId = signal<number | null>(null);
  protected editMode = computed(() => this.editId() !== null);
  protected hasExistingPdf = signal(false);
  private suppressCascade = false;

  protected pdfFile = signal<File | null>(null);
  protected thumbFile = signal<File | null>(null);
  protected thumbUrl = signal<string | null>(null);

  // ── Cover crop ────────────────────────────────────────────
  protected cropOpen = signal(false);
  /** The originally-picked image fed to the cropper (kept so "Edit" can re-crop). */
  protected cropSource = signal<File | null>(null);
  protected croppedReady = signal(false);
  private croppedBlob: Blob | null = null;
  protected dragging = signal(false);
  protected publishing = signal(false);
  protected submitAttempted = signal(false);

  protected agreed = signal(false);
  protected uploadPct = signal(0);
  protected draftRestored = signal(false);
  protected pdfPreviewSrc = signal<SafeResourceUrl | null>(null);
  private pdfPreviewObjUrl: string | null = null;
  protected suggestedPrice = signal<number | null>(null);

  protected taxonomy = signal<TaxonomyCategory[]>([]);
  /** Categories the seller is approved to sell in (their single domain). */
  protected eligible = signal<string[]>([]);

  protected form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(5)]],
    description: ['', [Validators.required, Validators.minLength(20)]],
    category: ['', Validators.required],
    exam: ['', Validators.required],
    subject: ['', Validators.required],
    level: [''],
    price: [199, [Validators.required, Validators.min(1)]],
  });

  private formValue = signal(this.form.getRawValue());

  constructor() {
    // Pull the latest account state so the "verify to publish" banner reflects
    // an admin approval that may have happened mid-session (without a re-login).
    this.auth.refreshSession();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) this.editId.set(+idParam);

    // Restore a saved draft BEFORE attaching cascade resets, so exam/subject
    // survive. Never for edit mode (we load the real note instead).
    if (!this.editMode()) this.restoreDraft();

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formValue.set(this.form.getRawValue());
      if (!this.editMode()) this.saveDraft();
    });

    // Cascade resets: changing a parent clears its dependent selections
    // (suppressed while we prefill an existing listing).
    this.form.controls.category.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.suppressCascade) this.form.patchValue({ exam: '', subject: '' });
    });
    this.form.controls.exam.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.suppressCascade) this.form.patchValue({ subject: '' });
    });

    // Suggested price — refetch when exam or subject settles.
    this.form.valueChanges
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshSuggestedPrice());

    this.api
      .getTaxonomy()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.taxonomy.set(r.data?.categories ?? []), error: () => {} });

    // Sellers can only list in their approved domain → lock the category to it.
    this.api
      .getEligibleCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const list = r.data ?? [];
          this.eligible.set(list);
          if (list.length) {
            // New upload → auto-select the seller's domain. (Edit keeps the note's own.)
            if (!this.editMode()) {
              this.suppressCascade = true;
              this.form.patchValue({ category: list[0] });
              this.suppressCascade = false;
              this.formValue.set(this.form.getRawValue());
            }
            // Lock the field either way — a note can't leave the seller's domain.
            this.form.controls.category.disable({ emitEvent: false });
            this.formValue.set(this.form.getRawValue());
          }
        },
        error: () => {},
      });

    if (this.editMode()) this.loadExisting(this.editId()!);
  }

  private loadExisting(id: number) {
    this.api
      .getNote(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const n = r.data;
          if (!n) return;
          this.suppressCascade = true;
          this.form.patchValue({
            title: n.title ?? '',
            description: n.description ?? '',
            category: n.category ?? '',
            exam: n.exam ?? '',
            subject: n.subject ?? '',
            level: n.level ?? n.classLevel ?? '',
            price: n.price ?? 199,
          });
          this.suppressCascade = false;
          this.formValue.set(this.form.getRawValue());
          if (n.thumbnailUrl) this.thumbUrl.set(n.thumbnailUrl);
          this.hasExistingPdf.set(true);
        },
        error: () => this.toast.error('Could not load this listing.'),
      });
  }

  private lastPriceKey = '';
  private refreshSuggestedPrice() {
    const { exam, subject } = this.formValue();
    if (!exam || !subject) {
      this.suggestedPrice.set(null);
      this.lastPriceKey = '';
      return;
    }
    const key = exam + '|' + subject;
    if (key === this.lastPriceKey) return;
    this.lastPriceKey = key;
    this.api
      .getSuggestedPrice(exam, subject)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.suggestedPrice.set(r.data?.price ?? null),
        error: () => this.suggestedPrice.set(null),
      });
  }

  protected applySuggestedPrice() {
    const p = this.suggestedPrice();
    if (p != null) this.form.patchValue({ price: p });
  }
  protected readonly rupee = rupee;

  protected fv = this.formValue;
  protected titleLen = computed(() => this.formValue().title.length);
  protected descLen = computed(() => this.formValue().description.length);

  protected categories = computed(() => {
    const elig = this.eligible();
    const all = this.taxonomy();
    // Only the seller's approved domain(s); fall back to all until eligibility loads.
    return elig.length ? all.filter((c) => elig.includes(c.name)) : all;
  });
  protected examsForCategory = computed(
    () => this.taxonomy().find((c) => c.name === this.formValue().category)?.exams ?? [],
  );
  protected subjectsForExam = computed(
    () => this.examsForCategory().find((e) => e.name === this.formValue().exam)?.subjects ?? [],
  );

  /** Human-readable list of what's still needed before publishing. */
  protected missing = computed(() => {
    this.formValue();
    this.pdfFile();
    const m: string[] = [];
    if (this.form.get('title')?.invalid) m.push('a title (5+ characters)');
    if (this.form.get('description')?.invalid) m.push('a description (20+ characters)');
    if (this.form.get('category')?.invalid) m.push('an exam category');
    if (this.form.get('exam')?.invalid) m.push('an exam');
    if (this.form.get('subject')?.invalid) m.push('a subject');
    if (this.form.get('price')?.invalid) m.push('a price (₹1 or more)');
    if (!this.pdfFile() && !this.editMode()) m.push('the notes PDF');
    if (!this.agreed() && !this.editMode()) m.push('your originality confirmation');
    return m;
  });

  protected previewNote = computed<Note>(() => {
    const v = this.formValue();
    return {
      id: 0,
      title: v.title || 'Your note title',
      description: v.description,
      category: v.category,
      exam: v.exam,
      subject: v.subject,
      level: v.level,
      price: Number(v.price) || 0,
      totalPages: 0,
      averageRating: 0,
      reviewCount: 0,
      thumbnailUrl: this.thumbUrl() ?? undefined,
      seller: {
        id: 0,
        fullName: this.auth.user()?.fullName ?? 'You',
        verified: this.auth.isVerified(),
      },
    };
  });

  protected invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  /** Normalise a free-text field to Title Case on blur for consistent listings. */
  protected titleCase(ctrl: 'title' | 'level') {
    const c = this.form.get(ctrl);
    const next = toTitleCase(c?.value ?? '');
    if (c && next !== c.value) c.setValue(next);
  }

  protected onPdf(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      this.toast.error('Please choose a PDF file.');
      return;
    }
    if (f.size > 50 * 1048576) {
      this.toast.error('PDF must be under 50MB.');
      return;
    }
    this.pdfFile.set(f);
    this.openPdfPreview(f);
  }

  /** Show the chosen PDF inline so the seller can confirm it's the right file. */
  private openPdfPreview(f: File) {
    if (this.pdfPreviewObjUrl) URL.revokeObjectURL(this.pdfPreviewObjUrl);
    this.pdfPreviewObjUrl = URL.createObjectURL(f);
    const src = this.pdfPreviewObjUrl + '#toolbar=0&navpanes=0&statusbar=0&view=FitH';
    this.pdfPreviewSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(src));
  }
  protected clearPdf() {
    if (this.pdfPreviewObjUrl) URL.revokeObjectURL(this.pdfPreviewObjUrl);
    this.pdfPreviewObjUrl = null;
    this.pdfPreviewSrc.set(null);
    this.pdfFile.set(null);
  }

  // ── Draft autosave ────────────────────────────────────────
  private restoreDraft() {
    try {
      const raw = localStorage.getItem(this.DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.form.patchValue(d);
      this.formValue.set(this.form.getRawValue());
      if (d?.title || d?.description) this.draftRestored.set(true);
    } catch {
      /* ignore */
    }
  }
  private saveDraft() {
    try {
      localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.form.getRawValue()));
    } catch {
      /* ignore */
    }
  }
  protected discardDraft() {
    localStorage.removeItem(this.DRAFT_KEY);
    this.form.reset();
    this.draftRestored.set(false);
    this.suggestedPrice.set(null);
  }

  protected onThumb(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      this.toast.error('Cover must be a JPG, PNG or WebP image.');
      return;
    }
    if (f.size > 5 * 1048576) {
      this.toast.error('Cover image must be under 5MB.');
      return;
    }
    // Open the cropper instead of using the raw file directly.
    this.cropSource.set(f);
    this.croppedBlob = null;
    this.croppedReady.set(false);
    this.cropOpen.set(true);
  }

  // ── Cover crop ────────────────────────────────────────────
  protected onCropped(e: ImageCroppedEvent) {
    this.croppedBlob = e.blob ?? null;
    this.croppedReady.set(!!this.croppedBlob);
  }
  /** Re-open the cropper on the originally-picked image. */
  protected editCover() {
    if (this.cropSource()) this.cropOpen.set(true);
  }
  protected cancelCrop() {
    this.cropOpen.set(false);
  }
  protected useCrop() {
    if (!this.croppedBlob) return;
    const file = new File([this.croppedBlob], 'cover.webp', { type: 'image/webp' });
    const prev = this.thumbUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.thumbFile.set(file);
    this.thumbUrl.set(URL.createObjectURL(file));
    this.cropOpen.set(false);
  }

  protected removeThumb() {
    const prev = this.thumbUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.thumbFile.set(null);
    this.thumbUrl.set(null);
    this.cropSource.set(null);
    this.croppedBlob = null;
  }

  protected publish() {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fill in the required details.');
      return;
    }
    if (!this.editMode()) {
      if (!this.pdfFile()) {
        this.toast.error('Please attach the notes PDF.');
        return;
      }
      if (!this.agreed()) {
        this.toast.error('Please confirm these are your own notes.');
        return;
      }
    }
    if (this.publishing()) return;

    this.publishing.set(true);
    this.uploadPct.set(0);
    const fd = new FormData();
    fd.append('data', new Blob([JSON.stringify(this.form.getRawValue())], { type: 'application/json' }));
    if (this.pdfFile()) fd.append('pdf', this.pdfFile()!);
    if (this.thumbFile()) fd.append('thumbnail', this.thumbFile()!);

    const editing = this.editMode();
    const req$ = editing ? this.api.updateNote(this.editId()!, fd) : this.api.uploadNote(fd);

    req$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadPct.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response) {
          this.publishing.set(false);
          if (!editing) {
            localStorage.removeItem(this.DRAFT_KEY);
            // Record the per-note originality declaration against the new note
            // (best-effort — never blocks the success path).
            const newId = event.body?.data?.id;
            if (newId) {
              this.consent
                .recordConsent('ORIGINALITY_DECLARATION', newId)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({ next: () => {}, error: () => {} });
            }
          }
          this.toast.success(
            editing ? 'Listing updated ✓' : 'Note submitted for review — you’ll be notified once an admin approves it.',
          );
          this.router.navigate(['/seller/notes']);
        }
      },
      error: () => {
        this.publishing.set(false);
        this.uploadPct.set(0);
      },
    });
  }
}
