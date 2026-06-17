import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { LandingContent, Note } from '@core/models';

const FEATURE_ICONS = ['shield-check', 'file-text', 'lock', 'zap', 'wallet', 'search', 'award', 'badge-check', 'clock', 'trending-up', 'book-open', 'graduation-cap'];

interface SectionNav { id: string; label: string; toggle: boolean; }

@Component({
  selector: 'app-admin-landing-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LucideAngularModule],
  template: `
    <div class="le-top">
      <div>
        <div class="le-eyebrow">public site</div>
        <h1 class="le-title">Landing editor</h1>
        <p class="le-sub">Every section of the public landing page — edit, reorder, toggle on/off.</p>
      </div>
    </div>

    @if (loading()) {
      <div class="skel" style="height:420px;border-radius:16px;max-width:1040px"></div>
    } @else if (form) {
      <div class="le-layout">
        <!-- Sticky section rail -->
        <aside class="le-rail">
          <div class="le-save-card">
            <button class="le-save-btn" [disabled]="!isDirty() || saving()" (click)="save()">
              {{ saving() ? 'Saving…' : 'Save changes' }}
            </button>
            <div class="le-save-state" [class.dirty]="isDirty()">
              <span class="d"></span>{{ isDirty() ? 'Unsaved changes' : 'All changes saved' }}
            </div>
          </div>

          <nav class="le-nav">
            <div class="le-nav-h">Sections</div>
            @for (s of sections; track s.id; let i = $index) {
              <button type="button" class="le-nav-item" [class.active]="active() === s.id" (click)="jump(s.id)">
                <span class="n">{{ i + 1 }}</span>
                <span class="lbl">{{ s.label }}</span>
                @if (s.toggle) { <span class="dot" [class.on]="isOn(s.id)" [title]="isOn(s.id) ? 'Enabled' : 'Hidden'"></span> }
              </button>
            }
          </nav>

          <a class="le-preview" href="/" target="_blank" rel="noopener">
            <lucide-icon name="external-link" [size]="15" /> Preview live page
          </a>
        </aside>

        <!-- Form -->
        <form [formGroup]="form" class="le-wrap">
          <!-- HERO -->
          <section id="sec-hero" class="le-sec" formGroupName="hero">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">1</span><h3>Hero</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>

            <!-- Headline -->
            <div class="le-block">
              <div class="le-block-h">Headline</div>
              <div class="le-preview" aria-hidden="true">
                @for (seg of headlineSegments(); track $index) {
                  @if (seg.mark) { <mark class="le-mark" [style.background]="previewHl()">{{ seg.text }}</mark> }
                  @else { <span>{{ seg.text }}</span> }
                }
                @if (!headlineSegments().length) { <span class="le-ph">Headline preview…</span> }
              </div>
              <div class="le-headline-row">
                <textarea #headlineRef class="input" rows="2" formControlName="headline" (input)="markDirty()"
                  placeholder="e.g. Study from the notes that cracked the exam."></textarea>
                <button type="button" class="btn-add" (click)="highlightSelection()" title="Wrap the selected words in a highlighter">
                  <lucide-icon name="highlighter" [size]="15" /> Highlight
                </button>
              </div>
              <div class="le-swatches">
                <span class="le-swatch-lbl">Highlighter</span>
                @for (sw of highlightSwatches; track sw.value) {
                  <button type="button" class="le-swatch" [class.active]="heroVal('highlightColor') === sw.value"
                    [style.background]="sw.value || '#ffe478'" [title]="sw.name" (click)="setHighlight(sw.value)"></button>
                }
              </div>
              <p class="le-note">Select any word(s) and click <b>Highlight</b> to mark them — or wrap them in <code>==double equals==</code> yourself. You can highlight multiple words anywhere in the sentence.</p>
            </div>

            <!-- Copy -->
            <div class="le-block">
              <div class="le-block-h">Copy</div>
              <div class="le-grid">
                <label class="fld full"><span>Trust badge (top pill) <i class="ct" [class.over]="len('trustBadge') > 42">{{ len('trustBadge') }}/42</i></span><input class="input" formControlName="trustBadge" placeholder="e.g. Every seller is marksheet-verified" /></label>
                <label class="fld full"><span>Subtitle <i class="ct" [class.over]="len('subtitle') > 160">{{ len('subtitle') }}/160</i></span><textarea class="input" rows="2" formControlName="subtitle"></textarea></label>
              </div>
            </div>

            <!-- Buttons -->
            <div class="le-block">
              <div class="le-block-h">Buttons</div>
              <div class="le-grid">
                <label class="fld"><span>Primary label</span><input class="input" formControlName="ctaPrimary" placeholder="Browse notes" /></label>
                <label class="fld"><span>Primary link</span><input class="input" formControlName="ctaPrimaryLink" placeholder="/browse" /></label>
                <label class="fld"><span>Secondary label</span><input class="input" formControlName="ctaSecondary" placeholder="Become a seller" /></label>
                <label class="fld"><span>Secondary link</span><input class="input" formControlName="ctaSecondaryLink" placeholder="/register" /></label>
              </div>
              <p class="le-note">Links take an internal path (e.g. <code>/browse</code>) or a full URL (<code>https://…</code>). The secondary link applies to logged-out visitors; signed-in users always get contextual nav.</p>
            </div>

            <!-- Note-card labels -->
            <div class="le-block">
              <div class="le-block-h">Note-card labels</div>
              <div class="le-grid">
                <label class="fld"><span>Card badge</span><input class="input" formControlName="badgeVerified" /></label>
                <label class="fld"><span>Handwriting note</span><input class="input" formControlName="handwritingNote" /></label>
              </div>
              <p class="le-note">Decorative chips on the live hero note-card. The ★ rating &amp; learner count are computed from real reviews and buyers — no manual numbers.</p>
            </div>
          </section>

          <!-- MARQUEE -->
          <section id="sec-marquee" class="le-sec" formGroupName="marquee">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">2</span><h3>Marquee (scrolling strip)</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>

            <!-- Live preview -->
            <div class="le-marq" aria-hidden="true">
              @if (marqueePreview().length) {
                <div class="le-marq-track" [style.animation-duration]="marqueeDurationVal()">
                  @for (rep of [0, 1]; track rep) {
                    <div class="le-marq-group">
                      @for (t of marqueePreview(); track $index) {
                        <span class="le-marq-item">{{ t }} @if (marqueeSepVal()) { <span class="le-marq-dot">{{ marqueeSepVal() }}</span> }</span>
                      }
                    </div>
                  }
                </div>
              } @else {
                <span class="le-marq-empty">Nothing to scroll yet — add a phrase below.</span>
              }
            </div>

            <!-- Settings -->
            <div class="le-marq-settings">
              <div class="le-set">
                <span class="le-set-l">Separator</span>
                <div class="le-seg">
                  @for (s of separatorOptions; track s.value) {
                    <button type="button" [class.on]="marqueeSepVal() === s.value" (click)="setMarquee('separator', s.value)">{{ s.label }}</button>
                  }
                </div>
              </div>
              <div class="le-set">
                <span class="le-set-l">Speed</span>
                <div class="le-seg">
                  @for (sp of speedOptions; track sp) {
                    <button type="button" [class.on]="marqueeSpeedVal() === sp" (click)="setMarquee('speed', sp)">{{ sp }}</button>
                  }
                </div>
              </div>
              <label class="le-switch sm"><input type="checkbox" formControlName="includeCoverage" (change)="markDirty()" /><span class="track"></span><span class="t">Auto-include exams you cover</span></label>
            </div>
            <p class="le-note top">Your phrases mix with the exams you actually cover (e.g. JEE, NEET) — pulled live from your taxonomy. Turn off auto-include for a brand-only strip.</p>

            <!-- Phrases -->
            <div formArrayName="items">
              @for (it of marqueeItems.controls; track it; let i = $index) {
                <div class="le-row">
                  <div class="le-move">
                    <button type="button" [disabled]="i === 0" (click)="moveItem(marqueeItems, i, -1)" title="Move up">▲</button>
                    <button type="button" [disabled]="i === marqueeItems.length - 1" (click)="moveItem(marqueeItems, i, 1)" title="Move down">▼</button>
                  </div>
                  <input class="input" placeholder="e.g. Handwritten notes" [formControlName]="i" (input)="markDirty()" />
                  <button type="button" class="icon-btn" (click)="marqueeItems.removeAt(i); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                </div>
              }
              @if (!marqueeItems.length) {
                <div class="le-empty">No brand phrases yet — add a few like “Verified toppers” or “Instant access”.</div>
              }
            </div>
            <button type="button" class="btn-add" (click)="marqueeItems.push(textControl()); markDirty()"><lucide-icon name="plus" [size]="15" /> Add phrase</button>
          </section>

          <!-- NOTES PREVIEW -->
          <section id="sec-notesPreview" class="le-sec" formGroupName="notesPreview">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">3</span><h3>Trending notes section</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>

            <!-- Heading -->
            <div class="le-block">
              <div class="le-block-h">Heading</div>
              <div class="le-grid">
                <label class="fld"><span>Eyebrow (script tagline)</span><input class="input" formControlName="eyebrow" (input)="markDirty()" /></label>
                <label class="fld"><span>Heading</span><input class="input" formControlName="heading" (input)="markDirty()" /></label>
                <label class="fld"><span>“View all” text</span><input class="input" formControlName="linkText" placeholder="View all notes" (input)="markDirty()" /></label>
                <label class="fld"><span>“View all” link</span><input class="input" formControlName="linkHref" placeholder="/browse" (input)="markDirty()" /></label>
              </div>
            </div>

            <!-- Cards -->
            <div class="le-block">
              <div class="le-block-h">Cards</div>
              <div class="le-marq-settings">
                <div class="le-set">
                  <span class="le-set-l">Show</span>
                  <div class="le-seg">
                    @for (n of countOptions; track n) {
                      <button type="button" [class.on]="+npVal('count') === n" (click)="setNotesPreview('count', n)">{{ n }}</button>
                    }
                  </div>
                </div>
                <div class="le-set">
                  <span class="le-set-l">Source</span>
                  <div class="le-seg">
                    @for (s of notesSortOptions; track s.value) {
                      <button type="button" [class.on]="npVal('sort') === s.value" (click)="setNotesPreview('sort', s.value)">{{ s.label }}</button>
                    }
                  </div>
                </div>
              </div>
              <p class="le-note top">Cards are pulled live from real notes — you pick how many and what counts as “trending”. Only the copy above is written by hand.</p>

              @if (previewNotes().length) {
                <div class="le-np-grid">
                  @for (n of previewNotes(); track n.id) {
                    <div class="le-np-card">
                      <div class="le-np-cover">
                        @if (n.subject) { <span class="le-np-tag">{{ n.subject }}</span> }
                        <div class="le-np-title">{{ n.title }}</div>
                      </div>
                      <div class="le-np-foot">
                        <span class="le-np-av">{{ ini(n.seller?.fullName) }}</span>
                        <span class="le-np-name">{{ n.seller?.fullName || 'Topper' }}</span>
                        <span class="le-np-price">₹{{ n.price }}</span>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="le-empty">No published notes to preview yet — cards appear here once notes go live.</div>
              }
            </div>
          </section>

          <!-- HOW IT WORKS -->
          <section id="sec-howItWorks" class="le-sec" formGroupName="howItWorks">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">4</span><h3>How it works</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>
            <div class="le-grid">
              <label class="fld"><span>Eyebrow (script tagline)</span><input class="input" formControlName="eyebrow" (input)="markDirty()" /></label>
              <label class="fld"><span>Heading</span><input class="input" formControlName="heading" (input)="markDirty()" /></label>
            </div>
            <div class="le-two">
              <div class="le-col">
                <label class="fld"><span>Left column label</span><input class="input" formControlName="buyerLabel" placeholder="For students" (input)="markDirty()" /></label>
                <div class="le-steps" formArrayName="buyer">
                  @for (it of howBuyer.controls; track it; let i = $index) {
                    <div class="le-step-card" [formGroupName]="i">
                      <span class="le-step-n">{{ i + 1 }}</span>
                      <div class="le-step-body">
                        <input class="input" placeholder="Step title" formControlName="title" (input)="markDirty()" />
                        <textarea class="input" rows="2" placeholder="Description" formControlName="desc" (input)="markDirty()"></textarea>
                      </div>
                      <div class="le-step-actions">
                        <div class="le-move">
                          <button type="button" [disabled]="i === 0" (click)="moveItem(howBuyer, i, -1)" title="Move up">▲</button>
                          <button type="button" [disabled]="i === howBuyer.length - 1" (click)="moveItem(howBuyer, i, 1)" title="Move down">▼</button>
                        </div>
                        <button type="button" class="icon-btn" (click)="howBuyer.removeAt(i); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                      </div>
                    </div>
                  }
                  @if (!howBuyer.length) { <div class="le-empty">No steps yet — add the buyer journey.</div> }
                </div>
                <button type="button" class="btn-add" (click)="howBuyer.push(stepGroup()); markDirty()"><lucide-icon name="plus" [size]="15" /> Add step</button>
              </div>
              <div class="le-col">
                <label class="fld"><span>Right column label</span><input class="input" formControlName="sellerLabel" placeholder="For toppers" (input)="markDirty()" /></label>
                <div class="le-steps" formArrayName="seller">
                  @for (it of howSeller.controls; track it; let i = $index) {
                    <div class="le-step-card" [formGroupName]="i">
                      <span class="le-step-n amber">{{ i + 1 }}</span>
                      <div class="le-step-body">
                        <input class="input" placeholder="Step title" formControlName="title" (input)="markDirty()" />
                        <textarea class="input" rows="2" placeholder="Description" formControlName="desc" (input)="markDirty()"></textarea>
                      </div>
                      <div class="le-step-actions">
                        <div class="le-move">
                          <button type="button" [disabled]="i === 0" (click)="moveItem(howSeller, i, -1)" title="Move up">▲</button>
                          <button type="button" [disabled]="i === howSeller.length - 1" (click)="moveItem(howSeller, i, 1)" title="Move down">▼</button>
                        </div>
                        <button type="button" class="icon-btn" (click)="howSeller.removeAt(i); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                      </div>
                    </div>
                  }
                  @if (!howSeller.length) { <div class="le-empty">No steps yet — add the seller journey.</div> }
                </div>
                <button type="button" class="btn-add" (click)="howSeller.push(stepGroup()); markDirty()"><lucide-icon name="plus" [size]="15" /> Add step</button>
              </div>
            </div>
          </section>

          <!-- FEATURES -->
          <section id="sec-features" class="le-sec" formGroupName="features">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">5</span><h3>Features</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>
            <div class="le-grid">
              <label class="fld"><span>Eyebrow (script tagline)</span><input class="input" formControlName="eyebrow" (input)="markDirty()" /></label>
              <label class="fld"><span>Heading</span><input class="input" formControlName="heading" (input)="markDirty()" /></label>
            </div>
            <div class="le-steps" formArrayName="items">
              @for (it of featureItems.controls; track it; let i = $index) {
                <div class="le-feat-card" [formGroupName]="i">
                  <div class="le-feat-icon">
                    <span class="le-feat-ic-prev"><lucide-icon [name]="featureItems.at(i).get('icon')?.value || 'shield-check'" [size]="22" /></span>
                    <select class="select" formControlName="icon" (change)="markDirty()">
                      @for (ic of icons; track ic) { <option [value]="ic">{{ ic }}</option> }
                    </select>
                  </div>
                  <div class="le-step-body">
                    <input class="input" placeholder="Feature title" formControlName="title" (input)="markDirty()" />
                    <textarea class="input" rows="2" placeholder="Description" formControlName="desc" (input)="markDirty()"></textarea>
                  </div>
                  <div class="le-step-actions">
                    <div class="le-move">
                      <button type="button" [disabled]="i === 0" (click)="moveItem(featureItems, i, -1)" title="Move up">▲</button>
                      <button type="button" [disabled]="i === featureItems.length - 1" (click)="moveItem(featureItems, i, 1)" title="Move down">▼</button>
                    </div>
                    <button type="button" class="icon-btn" (click)="featureItems.removeAt(i); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                  </div>
                </div>
              }
              @if (!featureItems.length) { <div class="le-empty">No features yet — add a few selling points.</div> }
            </div>
            <button type="button" class="btn-add" (click)="featureItems.push(featureGroup()); markDirty()"><lucide-icon name="plus" [size]="15" /> Add feature</button>
          </section>

          <!-- TESTIMONIALS -->
          <section id="sec-testimonials" class="le-sec" formGroupName="testimonials">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">6</span><h3>Testimonials</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>
            <div class="le-grid">
              <label class="fld"><span>Eyebrow (script tagline)</span><input class="input" formControlName="eyebrow" (input)="markDirty()" /></label>
              <label class="fld"><span>Heading</span><input class="input" formControlName="heading" (input)="markDirty()" /></label>
            </div>
            <div class="le-steps" formArrayName="items">
              @for (it of testItems.controls; track it; let i = $index) {
                <div class="le-test-card" [formGroupName]="i">
                  <div class="le-test-top">
                    <div class="le-test-avatar">
                      @if (testItems.at(i).get('photoUrl')?.value) {
                        <img [src]="testItems.at(i).get('photoUrl')?.value" alt="" />
                      } @else {
                        <span class="le-test-ini">{{ ini(testItems.at(i).get('name')?.value) }}</span>
                      }
                      <label class="le-photo-btn">
                        {{ uploadingKey() === 'test-' + i ? '…' : 'Photo' }}
                        <input type="file" accept="image/*" hidden (change)="uploadImage($event, testItems.at(i), 'test-' + i)" />
                      </label>
                    </div>
                    <div class="le-test-fields">
                      <input class="input" placeholder="Name" formControlName="name" (input)="markDirty()" />
                      <input class="input" placeholder="Exam e.g. JEE 2025" formControlName="exam" (input)="markDirty()" />
                      <div class="le-stars">
                        @for (s of [1, 2, 3, 4, 5]; track s) {
                          <button type="button" class="le-star" [class.on]="tRating(i) >= s" (click)="setRating(i, s)" [attr.aria-label]="s + ' stars'">★</button>
                        }
                      </div>
                    </div>
                    <div class="le-step-actions">
                      <div class="le-move">
                        <button type="button" [disabled]="i === 0" (click)="moveItem(testItems, i, -1)" title="Move up">▲</button>
                        <button type="button" [disabled]="i === testItems.length - 1" (click)="moveItem(testItems, i, 1)" title="Move down">▼</button>
                      </div>
                      <button type="button" class="icon-btn" (click)="testItems.removeAt(i); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                    </div>
                  </div>
                  <textarea class="input" rows="2" placeholder="Quote" formControlName="quote" (input)="markDirty()"></textarea>
                </div>
              }
              @if (!testItems.length) { <div class="le-empty">No testimonials yet — add a few student quotes.</div> }
            </div>
            <button type="button" class="btn-add" (click)="testItems.push(testGroup()); markDirty()"><lucide-icon name="plus" [size]="15" /> Add testimonial</button>
          </section>

          <!-- FOUNDERS -->
          <section id="sec-founders" class="le-sec" formGroupName="founders">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">7</span><h3>Founders</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>
            <div class="le-grid">
              <label class="fld"><span>Eyebrow (script tagline)</span><input class="input" formControlName="eyebrow" (input)="markDirty()" /></label>
              <label class="fld"><span>Section heading</span><input class="input" formControlName="heading" (input)="markDirty()" /></label>
              <label class="fld full"><span>Story / intro</span><textarea class="input" rows="2" formControlName="story" (input)="markDirty()"></textarea></label>
            </div>
            <div class="le-steps" formArrayName="items">
              @for (it of founderItems.controls; track it; let i = $index) {
                <div class="le-founder" [formGroupName]="i">
                  <div class="le-founder-photo">
                    @if (founderItems.at(i).get('photoUrl')?.value) {
                      <img [src]="founderItems.at(i).get('photoUrl')?.value" alt="" />
                    } @else {
                      <span class="ph"><lucide-icon name="image" [size]="20" /></span>
                    }
                    <label class="le-photo-btn">
                      {{ uploadingKey() === 'founder-' + i ? 'Uploading…' : 'Photo' }}
                      <input type="file" accept="image/*" hidden (change)="uploadImage($event, founderItems.at(i), 'founder-' + i)" />
                    </label>
                  </div>
                  <div class="le-founder-fields">
                    <input class="input" placeholder="Name" formControlName="name" (input)="markDirty()" />
                    <input class="input" placeholder="Role e.g. Co-founder — CTO" formControlName="role" (input)="markDirty()" />
                    <input class="input" placeholder="LinkedIn URL (Connect button)" formControlName="linkedin" (input)="markDirty()" />
                    <textarea class="input full" rows="2" placeholder="Short bio (2 lines on the card)" formControlName="bio" (input)="markDirty()"></textarea>
                    <label class="le-switch sm full"><input type="checkbox" formControlName="verified" (change)="markDirty()" /><span class="track"></span><span class="t">Show verified badge</span></label>
                  </div>
                  <div class="le-step-actions">
                    <div class="le-move">
                      <button type="button" [disabled]="i === 0" (click)="moveItem(founderItems, i, -1)" title="Move up">▲</button>
                      <button type="button" [disabled]="i === founderItems.length - 1" (click)="moveItem(founderItems, i, 1)" title="Move down">▼</button>
                    </div>
                    <button type="button" class="icon-btn" (click)="founderItems.removeAt(i); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                  </div>
                </div>
              }
              @if (!founderItems.length) { <div class="le-empty">No founders yet — add your team.</div> }
            </div>
            <button type="button" class="btn-add" (click)="founderItems.push(founderGroup()); markDirty()"><lucide-icon name="plus" [size]="15" /> Add founder</button>
          </section>

          <!-- FAQ -->
          <section id="sec-faq" class="le-sec" formGroupName="faq">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">8</span><h3>FAQ</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>
            <div class="le-grid">
              <label class="fld"><span>Eyebrow (script tagline)</span><input class="input" formControlName="eyebrow" (input)="markDirty()" /></label>
              <label class="fld"><span>Heading</span><input class="input" formControlName="heading" (input)="markDirty()" /></label>
            </div>
            <label class="le-switch sm le-faq-open"><input type="checkbox" formControlName="firstOpen" (change)="markDirty()" /><span class="track"></span><span class="t">Open the first answer by default</span></label>
            <div class="le-steps" formArrayName="items">
              @for (it of faqItems.controls; track it; let i = $index) {
                <div class="le-step-card" [formGroupName]="i">
                  <span class="le-step-n">{{ i + 1 }}</span>
                  <div class="le-step-body">
                    <input class="input" placeholder="Question" formControlName="q" (input)="markDirty()" />
                    <textarea class="input" rows="2" placeholder="Answer" formControlName="a" (input)="markDirty()"></textarea>
                  </div>
                  <div class="le-step-actions">
                    <div class="le-move">
                      <button type="button" [disabled]="i === 0" (click)="moveItem(faqItems, i, -1)" title="Move up">▲</button>
                      <button type="button" [disabled]="i === faqItems.length - 1" (click)="moveItem(faqItems, i, 1)" title="Move down">▼</button>
                    </div>
                    <button type="button" class="icon-btn" (click)="faqItems.removeAt(i); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                  </div>
                </div>
              }
              @if (!faqItems.length) { <div class="le-empty">No questions yet — add the ones buyers ask most.</div> }
            </div>
            <button type="button" class="btn-add" (click)="faqItems.push(faqGroup()); markDirty()"><lucide-icon name="plus" [size]="15" /> Add question</button>
          </section>

          <!-- FINAL CTA -->
          <section id="sec-cta" class="le-sec" formGroupName="cta">
            <header class="le-head">
              <div class="le-head-l"><span class="le-num">9</span><h3>Final call-to-action</h3></div>
              <label class="le-switch"><input type="checkbox" formControlName="enabled" /><span class="track"></span><span class="t">Enabled</span></label>
            </header>
            <!-- Live preview -->
            <div class="le-cta-preview" aria-hidden="true">
              @if (cv('eyebrow')) { <div class="le-cta-eyebrow">{{ cv('eyebrow') }} ↓</div> }
              <div class="le-cta-title">{{ cv('title') || "Start learning from India's toppers" }}</div>
              @if (cv('subtitle')) { <div class="le-cta-sub">{{ cv('subtitle') }}</div> }
              <span class="le-cta-btn">{{ cv('button') || 'Get started' }}</span>
            </div>

            <div class="le-block">
              <div class="le-block-h">Heading</div>
              <div class="le-grid">
                <label class="fld"><span>Eyebrow (script tagline)</span><input class="input" formControlName="eyebrow" (input)="markDirty()" /></label>
                <label class="fld"><span>Title</span><input class="input" formControlName="title" (input)="markDirty()" /></label>
                <label class="fld full"><span>Subtitle</span><textarea class="input" rows="2" formControlName="subtitle" (input)="markDirty()"></textarea></label>
              </div>
            </div>
            <div class="le-block">
              <div class="le-block-h">Button</div>
              <div class="le-grid">
                <label class="fld"><span>Button label</span><input class="input" formControlName="button" placeholder="Get started" (input)="markDirty()" /></label>
                <label class="fld"><span>Button link</span><input class="input" formControlName="buttonLink" placeholder="/register" (input)="markDirty()" /></label>
              </div>
              <p class="le-note">Internal path (e.g. <code>/register</code>) or a full URL. Signed-in visitors always get a “Go to app” button instead.</p>
            </div>
          </section>

          <!-- FOOTER -->
          <section id="sec-footer" class="le-sec" formGroupName="footer">
            <header class="le-head"><div class="le-head-l"><span class="le-num">10</span><h3>Footer</h3></div></header>

            <div class="le-block">
              <div class="le-block-h">Brand &amp; bottom bar</div>
              <label class="fld full"><span>Tagline</span><textarea class="input" rows="2" formControlName="tagline" (input)="markDirty()"></textarea></label>
              <div class="le-grid" style="margin-top:14px">
                <label class="fld"><span>Bottom line (after “© year TopNotes ·”)</span><input class="input" formControlName="legalLine" (input)="markDirty()" /></label>
                <label class="fld"><span>Credit (right side, e.g. Made in India 🇮🇳)</span><input class="input" formControlName="madeIn" (input)="markDirty()" /></label>
              </div>
            </div>

            <div class="le-block">
              <div class="le-block-h">Social links</div>
              <div class="le-grid" formGroupName="social">
                <label class="fld"><span>Instagram</span><input class="input" formControlName="instagram" placeholder="https://instagram.com/…" (input)="markDirty()" /></label>
                <label class="fld"><span>X (Twitter)</span><input class="input" formControlName="x" placeholder="https://x.com/…" (input)="markDirty()" /></label>
                <label class="fld"><span>LinkedIn</span><input class="input" formControlName="linkedin" placeholder="https://linkedin.com/…" (input)="markDirty()" /></label>
                <label class="fld"><span>YouTube</span><input class="input" formControlName="youtube" placeholder="https://youtube.com/…" (input)="markDirty()" /></label>
              </div>
              <p class="le-note">Leave blank to hide an icon. Filled ones show as icon buttons in the footer.</p>
            </div>

            <div class="le-block">
              <div class="le-block-h">Link columns</div>
              <div formArrayName="columns">
                @for (col of footerColumns.controls; track col; let ci = $index) {
                  <div class="le-fcol" [formGroupName]="ci">
                    <div class="le-fcol-head">
                      <div class="le-move">
                        <button type="button" [disabled]="ci === 0" (click)="moveItem(footerColumns, ci, -1)" title="Move column up">▲</button>
                        <button type="button" [disabled]="ci === footerColumns.length - 1" (click)="moveItem(footerColumns, ci, 1)" title="Move column down">▼</button>
                      </div>
                      <input class="input" placeholder="Column title" formControlName="title" (input)="markDirty()" />
                      <button type="button" class="icon-btn" (click)="footerColumns.removeAt(ci); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                    </div>
                    <div formArrayName="links">
                      @for (lk of colLinks(ci).controls; track lk; let li = $index) {
                        <div class="le-row" [formGroupName]="li">
                          <div class="le-move">
                            <button type="button" [disabled]="li === 0" (click)="moveItem(colLinks(ci), li, -1)" title="Move up">▲</button>
                            <button type="button" [disabled]="li === colLinks(ci).length - 1" (click)="moveItem(colLinks(ci), li, 1)" title="Move down">▼</button>
                          </div>
                          <input class="input" placeholder="Label" formControlName="label" (input)="markDirty()" />
                          <input class="input" placeholder="/path, https://… or mailto:" formControlName="href" (input)="markDirty()" />
                          <button type="button" class="icon-btn" (click)="colLinks(ci).removeAt(li); markDirty()"><lucide-icon name="trash-2" [size]="16" /></button>
                        </div>
                      }
                      @if (!colLinks(ci).length) { <div class="le-empty">No links in this column yet.</div> }
                    </div>
                    <button type="button" class="btn-add sm" (click)="colLinks(ci).push(linkGroup()); markDirty()"><lucide-icon name="plus" [size]="14" /> Add link</button>
                  </div>
                }
                @if (!footerColumns.length) { <div class="le-empty">No columns yet — add one (e.g. Marketplace, Company, Legal).</div> }
              </div>
              <button type="button" class="btn-add" (click)="footerColumns.push(columnGroup()); markDirty()"><lucide-icon name="plus" [size]="15" /> Add column</button>
            </div>
          </section>

          <div class="le-foot">
            <button type="button" class="le-save-btn wide" [disabled]="!isDirty() || saving()" (click)="save()">
              {{ saving() ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .le-top { margin-bottom: 22px; }
      .le-eyebrow { font-family: 'Caveat', cursive; font-size: 22px; color: #5840e0; line-height: 1; }
      .le-title { font-size: 30px; letter-spacing: -0.02em; margin: 2px 0 4px; }
      .le-sub { color: #6b6657; font-size: 15px; }

      .le-layout { display: grid; grid-template-columns: 232px minmax(0, 1fr); gap: 28px; align-items: start; max-width: 1100px; }

      /* Sticky rail */
      .le-rail { position: sticky; top: 78px; display: flex; flex-direction: column; gap: 14px; }
      .le-save-card { background: #fff; border: 1px solid #e9e5d8; border-radius: 14px; padding: 14px; }
      .le-save-btn { width: 100%; font: inherit; font-size: 14px; font-weight: 700; color: #fff; background: #5840e0; border: none; border-radius: 10px; padding: 11px 16px; cursor: pointer; transition: background .15s; }
      .le-save-btn:hover:not(:disabled) { background: #4733c2; }
      .le-save-btn:disabled { opacity: .45; cursor: default; }
      .le-save-state { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: #8a8475; margin-top: 10px; }
      .le-save-state .d { width: 7px; height: 7px; border-radius: 50%; background: #1a9e5f; }
      .le-save-state.dirty { color: #b54708; }
      .le-save-state.dirty .d { background: #e8a13a; }

      .le-nav { background: #fff; border: 1px solid #e9e5d8; border-radius: 14px; padding: 8px; }
      .le-nav-h { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #8a8475; padding: 8px 10px 6px; }
      .le-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; font: inherit; font-size: 13.5px; font-weight: 600; color: #6b6657; background: none; border: none; border-radius: 9px; padding: 8px 10px; cursor: pointer; text-align: left; transition: background .12s, color .12s; }
      .le-nav-item:hover { background: #faf8f2; color: #16141e; }
      .le-nav-item.active { background: #efebff; color: #5840e0; }
      .le-nav-item .n { flex: none; width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-size: 11px; font-weight: 700; background: #f1efe7; color: #8a8475; }
      .le-nav-item.active .n { background: #5840e0; color: #fff; }
      .le-nav-item .lbl { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .le-nav-item .dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: #d8d3c4; }
      .le-nav-item .dot.on { background: #1a9e5f; }
      .le-preview { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: #6b6657; text-decoration: none; padding: 4px 10px; }
      .le-preview:hover { color: #5840e0; }

      /* Sections */
      .le-wrap { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
      .le-sec { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; padding: 22px; scroll-margin-top: 80px; }
      .le-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
      .le-head-l { display: flex; align-items: center; gap: 10px; }
      .le-num { flex: none; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 800; background: #efebff; color: #5840e0; }
      .le-head h3 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: #16141e; }
      .le-subhead { font-size: 12px; font-weight: 700; color: #8a8475; margin: 18px 0 12px; text-transform: uppercase; letter-spacing: 0.05em; }
      .le-note { font-size: 12.5px; color: #8a8475; margin: 12px 0 0; line-height: 1.5; }
      .le-note.top { margin: -6px 0 14px; }

      /* Toggle switch */
      .le-switch { display: inline-flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 600; color: #6b6657; cursor: pointer; user-select: none; }
      .le-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
      .le-switch .track { position: relative; width: 38px; height: 22px; border-radius: 999px; background: #d8d3c4; transition: background .18s; flex: none; }
      .le-switch .track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .18s; }
      .le-switch input:checked + .track { background: #5840e0; }
      .le-switch input:checked + .track::after { transform: translateX(16px); }
      .le-switch input:focus-visible + .track { box-shadow: 0 0 0 3px rgba(88,64,224,.25); }

      /* Grouped blocks (Hero) */
      .le-block { border: 1px solid #f1efe7; border-radius: 12px; padding: 16px; margin-bottom: 14px; background: #fdfcf9; }
      .le-block:last-child { margin-bottom: 0; }
      .le-block-h { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8a8475; margin-bottom: 12px; }
      .le-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
      .le-preview { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 22px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; color: #16141e; margin-bottom: 14px; padding: 12px 14px; background: #fff; border: 1px dashed #e0dccf; border-radius: 10px; }
      .le-preview .le-ph { color: #b3ad9c; font-weight: 500; }
      .le-headline-row { display: flex; gap: 10px; align-items: flex-start; }
      .le-headline-row textarea { flex: 1; }
      .le-headline-row .btn-add { flex: none; white-space: nowrap; }
      .le-mark { padding: 0 5px; margin: 0 -1px; border-radius: 1px; }
      .le-swatches { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
      .le-swatch-lbl { font-size: 12px; font-weight: 600; color: #8a8475; margin-right: 2px; }
      .le-swatch { width: 26px; height: 26px; border-radius: 7px; border: 2px solid #e9e5d8; cursor: pointer; padding: 0; transition: transform .1s, border-color .1s; }
      .le-swatch:hover { transform: scale(1.08); }
      .le-swatch.active { border-color: #16141e; box-shadow: 0 0 0 2px #fff inset; }
      .ct { font-style: normal; font-size: 11px; font-weight: 600; color: #b3ad9c; margin-left: 6px; }
      .ct.over { color: #d64545; }
      .le-note code { font-family: ui-monospace, monospace; font-size: 11.5px; background: #f1efe7; border: 1px solid #e9e5d8; border-radius: 4px; padding: 1px 5px; color: #5840e0; }

      /* Marquee preview + settings */
      .le-marq { background: #16141e; border-radius: 12px; padding: 14px 0; overflow: hidden; margin-bottom: 14px; }
      .le-marq-track { display: flex; width: max-content; animation: le-marq-scroll 32s linear infinite; }
      .le-marq:hover .le-marq-track { animation-play-state: paused; }
      .le-marq-group { display: flex; }
      .le-marq-item { display: inline-flex; align-items: center; gap: 22px; margin-right: 22px; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 600; font-size: 14px; color: #fbfaf6; letter-spacing: 0.04em; white-space: nowrap; }
      .le-marq-dot { color: #e8a13a; font-size: 12px; }
      .le-marq-empty { display: block; text-align: center; color: #b3ad9c; font-size: 13px; padding: 4px 0; }
      @keyframes le-marq-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .le-marq-settings { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; margin-bottom: 4px; }
      .le-set { display: flex; align-items: center; gap: 10px; }
      .le-set-l { font-size: 13px; font-weight: 600; color: #4a463c; }
      .le-seg { display: inline-flex; background: #f1efe7; border: 1px solid #e9e5d8; border-radius: 9px; padding: 3px; gap: 2px; }
      .le-seg button { font: inherit; font-size: 13px; font-weight: 600; color: #6b6657; background: none; border: none; border-radius: 7px; min-width: 30px; padding: 5px 10px; cursor: pointer; text-transform: capitalize; transition: background .12s, color .12s; }
      .le-seg button:hover { color: #16141e; }
      .le-seg button.on { background: #fff; color: #5840e0; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
      .le-switch.sm { font-size: 12.5px; }
      .le-switch.sm .track { width: 34px; height: 20px; }
      .le-switch.sm .track::after { width: 16px; height: 16px; top: 2px; left: 2px; }
      .le-switch.sm input:checked + .track::after { transform: translateX(14px); }
      .le-move { display: flex; flex-direction: column; gap: 2px; flex: none; }
      .le-move button { width: 24px; height: 18px; display: grid; place-items: center; font-size: 9px; color: #8a8475; background: #faf8f2; border: 1px solid #e9e5d8; border-radius: 5px; cursor: pointer; padding: 0; }
      .le-move button:hover:not(:disabled) { color: #5840e0; border-color: #5840e0; }
      .le-move button:disabled { opacity: .35; cursor: default; }
      .le-empty { font-size: 13px; color: #8a8475; padding: 10px 0; }
      .le-faq-open { margin: 14px 0; }
      /* CTA preview banner */
      .le-cta-preview { background: linear-gradient(135deg, #5840e0, #4733c2); border-radius: 14px; padding: 26px 20px; text-align: center; margin-bottom: 16px; }
      .le-cta-eyebrow { font-family: 'Caveat', cursive; font-size: 19px; color: #ffe478; margin-bottom: 6px; }
      .le-cta-title { font-family: 'Bricolage Grotesque', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
      .le-cta-sub { font-size: 13.5px; color: rgba(255, 255, 255, 0.82); margin-top: 8px; max-width: 440px; margin-left: auto; margin-right: auto; }
      .le-cta-btn { display: inline-block; margin-top: 16px; font-size: 13.5px; font-weight: 700; color: #16141e; background: #fff; border-radius: 99px; padding: 10px 22px; }

      /* Trending notes preview */
      .le-np-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 6px; }
      .le-np-card { border: 1px solid #e9e5d8; border-radius: 11px; overflow: hidden; background: #fff; }
      .le-np-cover { position: relative; padding: 14px 12px 30px; background: #efebff; min-height: 78px; }
      .le-np-tag { display: inline-block; font-size: 10.5px; font-weight: 700; color: #fff; background: #5840e0; border-radius: 5px; padding: 2px 7px; margin-bottom: 8px; }
      .le-np-title { font-size: 13px; font-weight: 700; color: #16141e; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .le-np-foot { display: flex; align-items: center; gap: 6px; padding: 8px 10px; }
      .le-np-av { flex: none; width: 20px; height: 20px; border-radius: 50%; background: #5840e0; color: #fff; font-size: 9px; font-weight: 700; display: grid; place-items: center; }
      .le-np-name { flex: 1; min-width: 0; font-size: 11.5px; font-weight: 600; color: #6b6657; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .le-np-price { font-size: 12px; font-weight: 800; color: #16141e; }

      /* Field grids */
      .le-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .fld { display: flex; flex-direction: column; gap: 6px; }
      .fld.full { grid-column: 1 / -1; }
      .fld > span { font-size: 13px; font-weight: 600; color: #4a463c; }
      .le-two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 4px; }
      .le-col { display: flex; flex-direction: column; }
      .le-col > .fld { margin-bottom: 12px; }
      .le-steps { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
      .le-step-card { display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: #faf8f2; border: 1px solid #e9e5d8; border-radius: 11px; }
      .le-step-n { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: #efebff; color: #5840e0; margin-top: 2px; }
      .le-step-n.amber { background: #fbf0dc; color: #b8791c; }
      .le-step-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
      .le-step-body textarea { resize: vertical; min-height: 56px; }
      .le-step-actions { flex: none; display: flex; align-items: center; gap: 6px; }
      /* Feature cards (icon picker) */
      .le-feat-card { display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: #faf8f2; border: 1px solid #e9e5d8; border-radius: 11px; }
      .le-feat-icon { flex: none; width: 148px; display: flex; flex-direction: column; gap: 8px; }
      .le-feat-ic-prev { height: 38px; border-radius: 9px; display: grid; place-items: center; background: #efebff; color: #5840e0; }
      .le-feat-icon .select { width: 100%; }
      /* Testimonial cards */
      .le-test-card { display: flex; flex-direction: column; gap: 10px; padding: 12px; background: #faf8f2; border: 1px solid #e9e5d8; border-radius: 11px; }
      .le-test-top { display: flex; align-items: flex-start; gap: 12px; }
      .le-test-avatar { flex: none; width: 64px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .le-test-avatar img, .le-test-ini { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
      .le-test-ini { display: grid; place-items: center; background: #efebff; color: #5840e0; font-size: 15px; font-weight: 700; }
      .le-photo-btn { font-size: 11px; font-weight: 600; color: #5840e0; cursor: pointer; }
      .le-photo-btn:hover { text-decoration: underline; }
      .le-test-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
      .le-stars { display: inline-flex; gap: 2px; }
      .le-star { font-size: 20px; line-height: 1; color: #d8d3c4; background: none; border: none; cursor: pointer; padding: 0 1px; transition: color .1s; }
      .le-star:hover, .le-star.on { color: #e8a13a; }
      .le-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
      .le-row .input { flex: 1; }
      .le-step-row { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 8px; margin-bottom: 10px; align-items: start; }
      .le-feat-row { display: grid; grid-template-columns: 168px 1fr 1.4fr auto; gap: 8px; margin-bottom: 8px; align-items: center; }
      .le-test-row { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 8px; margin-bottom: 12px; align-items: start; }
      .le-test-row .full { grid-column: 1 / -1; }
      .le-founder { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; padding: 14px; border: 1px solid #e9e5d8; border-radius: 12px; margin-bottom: 12px; background: #faf8f2; }
      .le-founder-photo { display: flex; flex-direction: column; gap: 8px; align-items: center; width: 84px; }
      .le-founder-photo img, .le-founder-photo .ph { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; }
      .le-founder-photo .ph { display: grid; place-items: center; background: #efebff; color: #5840e0; }
      .le-founder-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .le-founder-fields .full { grid-column: 1 / -1; }
      .le-fcol { border: 1px solid #e9e5d8; border-radius: 12px; padding: 14px; margin-bottom: 12px; background: #faf8f2; }
      .le-fcol-head { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; }
      .le-fcol-head .input { flex: 1; }

      /* Buttons */
      .icon-btn { flex: none; width: 38px; height: 38px; border-radius: 9px; border: 1px solid #e9e5d8; background: #fff; color: #d64545; display: grid; place-items: center; cursor: pointer; transition: background .12s, border-color .12s; }
      .icon-btn:hover { background: #fdecea; border-color: #f3c9c4; }
      .btn-add { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 13.5px; font-weight: 600; color: #5840e0; background: #efebff; border: 1px solid #e0d9ff; border-radius: 9px; padding: 9px 14px; cursor: pointer; transition: background .12s; }
      .btn-add:hover { background: #e4ddff; }
      .btn-add.sm { padding: 6px 12px; font-size: 13px; }

      .le-foot { padding: 4px 0 48px; }
      .le-save-btn.wide { width: auto; padding: 12px 28px; }

      @media (max-width: 960px) {
        .le-layout { grid-template-columns: 1fr; }
        .le-rail { position: static; flex-direction: row; flex-wrap: wrap; align-items: center; }
        .le-save-card { flex: 1; min-width: 220px; }
        .le-nav { display: none; }
      }
      @media (max-width: 720px) {
        .le-grid, .le-two, .le-founder-fields { grid-template-columns: 1fr; }
        .le-step-row, .le-feat-row, .le-test-row { grid-template-columns: 1fr; }
        .le-founder { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class AdminLandingEditorComponent {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected loading = signal(true);
  protected saving = signal(false);
  protected uploadingKey = signal<string | null>(null);
  protected active = signal('hero');
  protected coverage = signal<string[]>([]); // real exam coverage for the marquee preview
  protected previewNotes = signal<Note[]>([]); // real notes for the trending-section preview
  protected dirtyTick = signal(0); // bumped on structural array edits so isDirty() re-reads
  protected readonly icons = FEATURE_ICONS;
  protected form!: FormGroup;

  protected readonly sections: SectionNav[] = [
    { id: 'hero', label: 'Hero', toggle: true },
    { id: 'marquee', label: 'Marquee', toggle: true },
    { id: 'notesPreview', label: 'Trending notes', toggle: true },
    { id: 'howItWorks', label: 'How it works', toggle: true },
    { id: 'features', label: 'Features', toggle: true },
    { id: 'testimonials', label: 'Testimonials', toggle: true },
    { id: 'founders', label: 'Founders', toggle: true },
    { id: 'faq', label: 'FAQ', toggle: true },
    { id: 'cta', label: 'Final CTA', toggle: true },
    { id: 'footer', label: 'Footer', toggle: false },
  ];

  constructor() {
    this.api
      .getLandingContent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.form = this.build(r.data ?? {});
          this.loading.set(false);
          this.loadTrendingPreview();
        },
        error: () => this.loading.set(false),
      });

    // Real exam coverage (same source the live marquee uses) so the editor preview is accurate.
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

    const onScroll = () => this.updateActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
  }

  // ── Section nav ───────────────────────────────────────────
  protected jump(id: string) {
    document.getElementById('sec-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.active.set(id);
  }
  private updateActive() {
    let current = this.sections[0].id;
    for (const s of this.sections) {
      const el = document.getElementById('sec-' + s.id);
      if (el && el.getBoundingClientRect().top <= 120) current = s.id;
    }
    if (this.active() !== current) this.active.set(current);
  }
  protected isOn(id: string): boolean {
    if (id === 'footer') return true;
    return !!this.form?.get(id + '.enabled')?.value;
  }
  protected isDirty(): boolean {
    this.dirtyTick();
    return this.form?.dirty ?? false;
  }
  /** Adding/removing FormArray rows doesn't flip form.dirty — mark it explicitly. */
  protected markDirty() {
    this.form?.markAsDirty();
    this.dirtyTick.update((n) => n + 1);
  }

  /** Move a FormArray row up (-1) or down (+1). Reusable across list sections. */
  protected moveItem(arr: FormArray, i: number, dir: number) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const ctrl = arr.at(i);
    arr.removeAt(i);
    arr.insert(j, ctrl);
    this.markDirty();
  }

  // ── Marquee helpers ───────────────────────────────────────
  protected readonly separatorOptions = [
    { label: '✦', value: '✦' },
    { label: '•', value: '•' },
    { label: '★', value: '★' },
    { label: '◆', value: '◆' },
    { label: '—', value: '—' },
    { label: 'None', value: '' },
  ];
  protected readonly speedOptions = ['slow', 'medium', 'fast'];

  protected setMarquee(key: string, value: string) {
    this.form?.get('marquee.' + key)?.setValue(value);
    this.markDirty();
  }
  protected marqueeSepVal(): string {
    const s = this.form?.get('marquee.separator')?.value;
    return s === undefined || s === null ? '✦' : s;
  }
  protected marqueeSpeedVal(): string {
    return this.form?.get('marquee.speed')?.value || 'medium';
  }
  protected marqueeDurationVal(): string {
    switch (this.marqueeSpeedVal()) {
      case 'slow': return '48s';
      case 'fast': return '18s';
      default: return '32s';
    }
  }
  /** Mirrors the live marquee: brand phrases interleaved with real coverage (unless disabled). */
  protected marqueePreview(): string[] {
    const items = this.marqueeItems.controls.map((c) => c.value as string).filter(Boolean);
    if (this.form?.get('marquee.includeCoverage')?.value === false) return items;
    const cov = this.coverage();
    const covLower = new Set(cov.map((x) => x.toLowerCase()));
    const vp = items.filter((x) => !covLower.has(x.toLowerCase()));
    const out: string[] = [];
    const max = Math.max(vp.length, cov.length);
    for (let i = 0; i < max; i++) {
      if (i < cov.length) out.push(cov[i]);
      if (i < vp.length) out.push(vp[i]);
    }
    return out;
  }

  // ── Trending notes helpers ────────────────────────────────
  protected readonly countOptions = [3, 4, 6, 8];
  protected readonly notesSortOptions = [
    { label: 'Featured', value: 'featured' },
    { label: 'Top rated', value: 'rating' },
    { label: 'Newest', value: 'newest' },
    { label: 'Most popular', value: 'popular' },
  ];
  protected npVal(name: string): string {
    return this.form?.get('notesPreview.' + name)?.value ?? '';
  }
  protected cv(name: string): string {
    return this.form?.get('cta.' + name)?.value ?? '';
  }
  protected setNotesPreview(key: string, value: string | number) {
    this.form?.get('notesPreview.' + key)?.setValue(value);
    this.markDirty();
    if (key === 'count' || key === 'sort') this.loadTrendingPreview();
  }
  /** Fetch the real notes that will fill the trending grid, for an accurate preview. */
  protected loadTrendingPreview() {
    const size = this.form?.get('notesPreview.count')?.value ?? 4;
    const sort = this.form?.get('notesPreview.sort')?.value || 'featured';
    this.api
      .getNotes({ page: 0, size, sort })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.previewNotes.set(r.data?.content ?? []),
        error: () => this.previewNotes.set([]),
      });
  }
  protected ini(name?: string): string {
    return (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  // ── Testimonials helpers ──────────────────────────────────
  protected tRating(i: number): number {
    return +(this.testItems.at(i).get('rating')?.value ?? 0);
  }
  protected setRating(i: number, value: number) {
    this.testItems.at(i).get('rating')?.setValue(value);
    this.markDirty();
  }

  /** Generic image upload → sets photoUrl on the given form group (founders, testimonials, …). */
  protected uploadImage(ev: Event, group: AbstractControl, key: string) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    this.uploadingKey.set(key);
    this.api
      .uploadContentImage(fd)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          group.get('photoUrl')?.setValue(r.data);
          this.markDirty();
          this.uploadingKey.set(null);
          this.toast.success('Photo uploaded');
          input.value = '';
        },
        error: () => {
          this.uploadingKey.set(null);
          input.value = '';
        },
      });
  }

  // ── Hero helpers ──────────────────────────────────────────
  protected readonly highlightSwatches = [
    { name: 'Yellow (default)', value: '' },
    { name: 'Indigo', value: '#cdd0ff' },
    { name: 'Mint', value: '#bdf0d2' },
    { name: 'Peach', value: '#ffd6bf' },
    { name: 'Pink', value: '#ffcfe3' },
  ];
  @ViewChild('headlineRef') headlineRef?: ElementRef<HTMLTextAreaElement>;

  protected heroVal(name: string): string {
    return this.form?.get('hero.' + name)?.value ?? '';
  }
  protected len(name: string): number {
    return this.heroVal(name).length;
  }
  protected setHighlight(value: string) {
    this.form?.get('hero.highlightColor')?.setValue(value);
    this.markDirty();
  }
  /** Highlighter swipe for the editor preview — always shows a colour (brand yellow by default). */
  protected previewHl(): string {
    const c = this.heroVal('highlightColor') || '#ffe478';
    return `linear-gradient(180deg, rgba(0,0,0,0) 58%, ${c} 58%)`;
  }

  /** Migrate the legacy 3-part headline into a single ==marked== string. */
  protected composeHeadline(hero?: LandingContent['hero']): string {
    if (!hero) return '';
    const title = hero.title ?? '';
    const hl = hero.highlight ?? '';
    const after = hero.titleAfter ?? '';
    if (!hl) return [title, after].filter(Boolean).join(' ').trim();
    return `${title} ==${hl}== ${after}`.replace(/\s+/g, ' ').trim();
  }

  /** Parse the current headline into plain/highlighted segments for the live preview. */
  protected headlineSegments(): { text: string; mark: boolean }[] {
    const headline = this.heroVal('headline');
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

  /** Wrap the textarea's current selection in ==…== (toggles off if already wrapped). */
  protected highlightSelection() {
    const el = this.headlineRef?.nativeElement;
    const ctrl = this.form?.get('hero.headline');
    if (!el || !ctrl) return;
    const val: string = ctrl.value ?? '';
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end) {
      this.toast.error('Select the word(s) you want to highlight first');
      return;
    }
    const before = val.slice(0, start);
    const sel = val.slice(start, end);
    const after = val.slice(end);
    let next: string;
    let caret: number;
    if (before.endsWith('==') && after.startsWith('==')) {
      // Already wrapped — unwrap.
      next = before.slice(0, -2) + sel + after.slice(2);
      caret = start - 2 + sel.length;
    } else {
      next = `${before}==${sel}==${after}`;
      caret = start + 2 + sel.length + 2;
    }
    ctrl.setValue(next);
    this.markDirty();
    // Restore focus + caret after the value update.
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  // ── FormArray accessors ───────────────────────────────────
  get marqueeItems() { return this.form.get('marquee.items') as FormArray; }
  get howBuyer() { return this.form.get('howItWorks.buyer') as FormArray; }
  get howSeller() { return this.form.get('howItWorks.seller') as FormArray; }
  get featureItems() { return this.form.get('features.items') as FormArray; }
  get testItems() { return this.form.get('testimonials.items') as FormArray; }
  get founderItems() { return this.form.get('founders.items') as FormArray; }
  get faqItems() { return this.form.get('faq.items') as FormArray; }
  get footerColumns() { return this.form.get('footer.columns') as FormArray; }
  colLinks(ci: number) { return this.footerColumns.at(ci).get('links') as FormArray; }

  // ── Row factories ─────────────────────────────────────────
  textControl(v = '') { return this.fb.control(v); }
  stepGroup(v: any = {}) { return this.fb.group({ title: [v.title ?? ''], desc: [v.desc ?? ''] }); }
  featureGroup(v: any = {}) { return this.fb.group({ icon: [v.icon ?? 'shield-check'], title: [v.title ?? ''], desc: [v.desc ?? ''] }); }
  testGroup(v: any = {}) { return this.fb.group({ name: [v.name ?? ''], exam: [v.exam ?? ''], rating: [v.rating ?? 5], quote: [v.quote ?? ''], photoUrl: [v.photoUrl ?? ''] }); }
  founderGroup(v: any = {}) { return this.fb.group({ name: [v.name ?? ''], role: [v.role ?? ''], bio: [v.bio ?? ''], photoUrl: [v.photoUrl ?? ''], linkedin: [v.linkedin ?? ''], verified: [v.verified ?? true] }); }
  faqGroup(v: any = {}) { return this.fb.group({ q: [v.q ?? ''], a: [v.a ?? ''] }); }
  linkGroup(v: any = {}) { return this.fb.group({ label: [v.label ?? ''], href: [v.href ?? ''] }); }
  columnGroup(v: any = {}) {
    return this.fb.group({
      title: [v.title ?? ''],
      links: this.fb.array((v.links ?? []).map((l: any) => this.linkGroup(l))),
    });
  }

  private build(c: LandingContent): FormGroup {
    return this.fb.group({
      hero: this.fb.group({
        enabled: [c.hero?.enabled ?? true],
        trustBadge: [c.hero?.trustBadge ?? ''],
        headline: [c.hero?.headline ?? this.composeHeadline(c.hero)],
        highlightColor: [c.hero?.highlightColor ?? ''],
        subtitle: [c.hero?.subtitle ?? ''],
        ctaPrimary: [c.hero?.ctaPrimary ?? 'Browse notes'],
        ctaPrimaryLink: [c.hero?.ctaPrimaryLink ?? '/browse'],
        ctaSecondary: [c.hero?.ctaSecondary ?? 'Become a seller'],
        ctaSecondaryLink: [c.hero?.ctaSecondaryLink ?? '/register'],
        badgeVerified: [c.hero?.badgeVerified ?? 'Marksheet verified'],
        handwritingNote: [c.hero?.handwritingNote ?? 'real handwriting ↓'],
      }),
      marquee: this.fb.group({
        enabled: [c.marquee?.enabled ?? true],
        separator: [c.marquee?.separator ?? '✦'],
        speed: [c.marquee?.speed ?? 'medium'],
        includeCoverage: [c.marquee?.includeCoverage ?? true],
        items: this.fb.array((c.marquee?.items ?? []).map((x) => this.textControl(x))),
      }),
      notesPreview: this.fb.group({
        enabled: [c.notesPreview?.enabled ?? true],
        eyebrow: [c.notesPreview?.eyebrow ?? ''],
        heading: [c.notesPreview?.heading ?? ''],
        linkText: [c.notesPreview?.linkText ?? ''],
        linkHref: [c.notesPreview?.linkHref ?? '/browse'],
        count: [c.notesPreview?.count ?? 4],
        sort: [c.notesPreview?.sort ?? 'featured'],
      }),
      howItWorks: this.fb.group({
        enabled: [c.howItWorks?.enabled ?? true],
        eyebrow: [c.howItWorks?.eyebrow ?? ''],
        heading: [c.howItWorks?.heading ?? ''],
        buyerLabel: [c.howItWorks?.buyerLabel ?? 'For students'],
        sellerLabel: [c.howItWorks?.sellerLabel ?? 'For toppers'],
        buyer: this.fb.array((c.howItWorks?.buyer ?? []).map((x) => this.stepGroup(x))),
        seller: this.fb.array((c.howItWorks?.seller ?? []).map((x) => this.stepGroup(x))),
      }),
      features: this.fb.group({
        enabled: [c.features?.enabled ?? true],
        eyebrow: [c.features?.eyebrow ?? ''],
        heading: [c.features?.heading ?? ''],
        items: this.fb.array((c.features?.items ?? []).map((x) => this.featureGroup(x))),
      }),
      testimonials: this.fb.group({
        enabled: [c.testimonials?.enabled ?? true],
        eyebrow: [c.testimonials?.eyebrow ?? ''],
        heading: [c.testimonials?.heading ?? ''],
        items: this.fb.array((c.testimonials?.items ?? []).map((x) => this.testGroup(x))),
      }),
      founders: this.fb.group({
        enabled: [c.founders?.enabled ?? true],
        eyebrow: [c.founders?.eyebrow ?? ''],
        heading: [c.founders?.heading ?? ''],
        story: [c.founders?.story ?? ''],
        items: this.fb.array((c.founders?.items ?? []).map((x) => this.founderGroup(x))),
      }),
      faq: this.fb.group({
        enabled: [c.faq?.enabled ?? true],
        eyebrow: [c.faq?.eyebrow ?? ''],
        heading: [c.faq?.heading ?? ''],
        firstOpen: [c.faq?.firstOpen ?? true],
        items: this.fb.array((c.faq?.items ?? []).map((x) => this.faqGroup(x))),
      }),
      cta: this.fb.group({
        enabled: [c.cta?.enabled ?? true],
        eyebrow: [c.cta?.eyebrow ?? ''],
        title: [c.cta?.title ?? ''],
        subtitle: [c.cta?.subtitle ?? ''],
        button: [c.cta?.button ?? ''],
        buttonLink: [c.cta?.buttonLink ?? '/register'],
      }),
      footer: this.fb.group({
        tagline: [c.footer?.tagline ?? ''],
        legalLine: [c.footer?.legalLine ?? 'Verified toppers only'],
        madeIn: [c.footer?.madeIn ?? 'Made in India 🇮🇳'],
        social: this.fb.group({
          instagram: [c.footer?.social?.instagram ?? ''],
          x: [c.footer?.social?.x ?? ''],
          linkedin: [c.footer?.social?.linkedin ?? ''],
          youtube: [c.footer?.social?.youtube ?? ''],
        }),
        columns: this.fb.array((c.footer?.columns ?? []).map((x) => this.columnGroup(x))),
      }),
    });
  }

  save() {
    this.saving.set(true);
    this.api
      .updateLandingContent(this.form.getRawValue() as LandingContent)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.markAsPristine();
          this.dirtyTick.update((n) => n + 1);
          this.toast.success('Landing page updated');
        },
        error: () => this.saving.set(false),
      });
  }
}
