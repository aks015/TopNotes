import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { ApiResponse, Taxonomy, TaxonomyCategory } from '@core/models';

/**
 * Admin manager for the exam taxonomy (Category → Exam → Subject). Every
 * mutation returns the full tree, so we just replace the signal — no refetch.
 */
@Component({
  selector: 'app-admin-taxonomy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tx">
      <header class="tx-head">
        <div class="tx-eyebrow">admin</div>
        <h1 class="tx-title">Exam taxonomy</h1>
        <p class="tx-sub">Manage exam categories, exams and subjects. Sellers pick from these when uploading — changes apply instantly, no redeploy.</p>
      </header>

      <!-- Add category -->
      <div class="tx-add tx-add-top">
        <input #catInput class="tx-input" placeholder="New category (e.g. Engineering, Banking)…" (keydown.enter)="addCategory(catInput)" />
        <button class="tx-btn primary" [disabled]="busy()" (click)="addCategory(catInput)">+ Add category</button>
      </div>

      @if (loading()) {
        <div class="tx-skel"></div>
        <div class="tx-skel"></div>
        <div class="tx-skel"></div>
      } @else {
        @for (c of categories(); track c.id) {
          <div class="tx-cat" [class.off]="!c.active">
            <div class="tx-row">
              <button class="tx-exp" (click)="toggleCat(c.id)" [attr.aria-expanded]="expCat() === c.id">
                <span class="tx-chev" [class.open]="expCat() === c.id">▸</span>
              </button>
              <input class="tx-name" [value]="c.name" #cn />
              <span class="tx-meta">{{ c.exams.length }} exams</span>
              <div class="tx-actions">
                <button class="tx-btn sm" [disabled]="busy()" (click)="renameCategory(c, cn.value)">Save</button>
                <button class="tx-btn sm ghost" [disabled]="busy()" (click)="toggleActive('category', c.id, !c.active)">
                  {{ c.active ? 'Disable' : 'Enable' }}
                </button>
                <button class="tx-btn sm danger" [disabled]="busy()" (click)="del('category', c.id, c.name, c.exams.length + ' exams')">✕</button>
              </div>
            </div>

            @if (expCat() === c.id) {
              <div class="tx-children">
                <div class="tx-add">
                  <input #exInput class="tx-input" placeholder="New exam (e.g. UPSC CSE, IBPS PO)…" (keydown.enter)="addExam(c.id, exInput)" />
                  <button class="tx-btn primary sm" [disabled]="busy()" (click)="addExam(c.id, exInput)">+ Add exam</button>
                </div>

                @for (e of c.exams; track e.id) {
                  <div class="tx-exam" [class.off]="!e.active">
                    <div class="tx-row">
                      <button class="tx-exp" (click)="toggleExam(e.id)" [attr.aria-expanded]="expExam() === e.id">
                        <span class="tx-chev" [class.open]="expExam() === e.id">▸</span>
                      </button>
                      <input class="tx-name" [value]="e.name" #en />
                      <span class="tx-meta">{{ e.subjects.length }} subjects</span>
                      <div class="tx-actions">
                        <button class="tx-btn sm" [disabled]="busy()" (click)="renameExam(e.id, en.value)">Save</button>
                        <button class="tx-btn sm ghost" [disabled]="busy()" (click)="toggleActive('exam', e.id, !e.active)">
                          {{ e.active ? 'Disable' : 'Enable' }}
                        </button>
                        <button class="tx-btn sm danger" [disabled]="busy()" (click)="del('exam', e.id, e.name, e.subjects.length + ' subjects')">✕</button>
                      </div>
                    </div>

                    @if (expExam() === e.id) {
                      <div class="tx-children">
                        <div class="tx-add">
                          <input #subInput class="tx-input" placeholder="New subject (e.g. Polity, Quantitative Aptitude)…" (keydown.enter)="addSubject(e.id, subInput)" />
                          <button class="tx-btn primary sm" [disabled]="busy()" (click)="addSubject(e.id, subInput)">+ Add subject</button>
                        </div>
                        @for (s of e.subjects; track s.id) {
                          <div class="tx-row tx-subj" [class.off]="!s.active">
                            <span class="tx-dot">•</span>
                            <input class="tx-name" [value]="s.name" #sn />
                            <div class="tx-actions">
                              <button class="tx-btn sm" [disabled]="busy()" (click)="renameSubject(s.id, sn.value)">Save</button>
                              <button class="tx-btn sm ghost" [disabled]="busy()" (click)="toggleActive('subject', s.id, !s.active)">
                                {{ s.active ? 'Disable' : 'Enable' }}
                              </button>
                              <button class="tx-btn sm danger" [disabled]="busy()" (click)="del('subject', s.id, s.name, '')">✕</button>
                            </div>
                          </div>
                        } @empty {
                          <p class="tx-empty">No subjects yet — add the first one above.</p>
                        }
                      </div>
                    }
                  </div>
                } @empty {
                  <p class="tx-empty">No exams yet — add the first one above.</p>
                }
              </div>
            }
          </div>
        } @empty {
          <p class="tx-empty">No categories yet. Add your first exam category above.</p>
        }
      }
    </div>
  `,
  styles: [
    `
      .tx {
        max-width: 920px;
        margin: 0 auto;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        color: #16141e;
      }
      .tx-eyebrow {
        font-family: 'Caveat', cursive;
        font-size: 22px;
        font-weight: 600;
        color: #5840e0;
      }
      .tx-title {
        margin: 2px 0 6px;
        font-family: 'Bricolage Grotesque', system-ui, sans-serif;
        font-weight: 800;
        font-size: 36px;
        letter-spacing: -0.03em;
      }
      .tx-sub {
        margin: 0 0 22px;
        font-size: 15px;
        color: #5b5870;
        max-width: 640px;
      }

      .tx-add {
        display: flex;
        gap: 10px;
        margin-bottom: 14px;
      }
      .tx-add-top {
        margin-bottom: 22px;
      }
      .tx-input {
        flex: 1;
        border: 1px solid #e2decf;
        border-radius: 10px;
        padding: 10px 14px;
        font: inherit;
        font-size: 14px;
        background: #fff;
      }
      .tx-input:focus {
        outline: none;
        border-color: #5840e0;
        box-shadow: 0 0 0 3px rgba(88, 64, 224, 0.12);
      }

      .tx-cat {
        background: #fff;
        border: 1px solid #e9e5d8;
        border-radius: 14px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .tx-cat.off,
      .tx-exam.off,
      .tx-subj.off {
        opacity: 0.55;
      }
      .tx-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
      }
      .tx-exp {
        border: none;
        background: none;
        cursor: pointer;
        padding: 2px 4px;
        color: #8b879a;
        flex: none;
      }
      .tx-chev {
        display: inline-block;
        transition: transform 0.16s;
        font-size: 13px;
      }
      .tx-chev.open {
        transform: rotate(90deg);
      }
      .tx-name {
        flex: 1;
        min-width: 0;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 7px 10px;
        font: inherit;
        font-size: 14.5px;
        font-weight: 600;
        background: #faf9f5;
      }
      .tx-name:focus {
        outline: none;
        border-color: #5840e0;
        background: #fff;
      }
      .tx-meta {
        font-size: 12px;
        color: #a8a4b8;
        white-space: nowrap;
        flex: none;
      }
      .tx-actions {
        display: flex;
        gap: 6px;
        flex: none;
      }
      .tx-children {
        padding: 4px 14px 14px 36px;
        border-top: 1px solid #f3f0e7;
        background: #fdfcf9;
      }
      .tx-exam {
        border: 1px solid #eee9dc;
        border-radius: 10px;
        margin: 10px 0;
        background: #fff;
        overflow: hidden;
      }
      .tx-subj {
        padding: 7px 10px;
      }
      .tx-dot {
        color: #c5bfd8;
        flex: none;
        width: 12px;
        text-align: center;
      }
      .tx-empty {
        font-size: 13.5px;
        color: #a8a4b8;
        margin: 6px 0;
      }
      .tx-skel {
        height: 56px;
        border-radius: 14px;
        margin-bottom: 12px;
        background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%);
        background-size: 200% 100%;
        animation: txShimmer 1.3s infinite;
      }
      @keyframes txShimmer {
        from { background-position: 200% 0; }
        to { background-position: -200% 0; }
      }

      .tx-btn {
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        border-radius: 99px;
        padding: 9px 16px;
        font-size: 13.5px;
        background: #f0ede4;
        color: #4b4860;
        transition: background 0.16s, color 0.16s;
      }
      .tx-btn.sm {
        padding: 6px 12px;
        font-size: 12.5px;
      }
      .tx-btn.primary {
        background: #16141e;
        color: #fbfaf6;
      }
      .tx-btn.primary:hover:not(:disabled) {
        background: #5840e0;
      }
      .tx-btn.ghost {
        background: #fff;
        border: 1px solid #e2decf;
      }
      .tx-btn.ghost:hover:not(:disabled) {
        border-color: #5840e0;
        color: #5840e0;
      }
      .tx-btn.danger {
        background: #fdeceb;
        color: #d8453b;
      }
      .tx-btn.danger:hover:not(:disabled) {
        background: #f7d7d4;
      }
      .tx-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ],
})
export class AdminTaxonomyComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected categories = signal<TaxonomyCategory[]>([]);
  protected loading = signal(true);
  protected busy = signal(false);
  protected expCat = signal<number | null>(null);
  protected expExam = signal<number | null>(null);

  constructor() {
    this.api
      .getFullTaxonomy()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.categories.set(r.data?.categories ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected toggleCat(id: number) {
    this.expCat.set(this.expCat() === id ? null : id);
    this.expExam.set(null);
  }
  protected toggleExam(id: number) {
    this.expExam.set(this.expExam() === id ? null : id);
  }

  // ── Mutations ─────────────────────────────────────────────
  protected addCategory(input: HTMLInputElement) {
    const name = input.value.trim();
    if (!name) return;
    this.run(this.api.createCategory(name), 'Category added', () => (input.value = ''));
  }
  protected renameCategory(c: TaxonomyCategory, name: string) {
    const v = name.trim();
    if (!v || v === c.name) return;
    this.run(this.api.updateCategory(c.id, { name: v }), 'Renamed');
  }
  protected addExam(catId: number, input: HTMLInputElement) {
    const name = input.value.trim();
    if (!name) return;
    this.run(this.api.createExam(catId, name), 'Exam added', () => (input.value = ''));
  }
  protected renameExam(id: number, name: string) {
    const v = name.trim();
    if (!v) return;
    this.run(this.api.updateExam(id, { name: v }), 'Renamed');
  }
  protected addSubject(examId: number, input: HTMLInputElement) {
    const name = input.value.trim();
    if (!name) return;
    this.run(this.api.createSubject(examId, name), 'Subject added', () => (input.value = ''));
  }
  protected renameSubject(id: number, name: string) {
    const v = name.trim();
    if (!v) return;
    this.run(this.api.updateSubject(id, { name: v }), 'Renamed');
  }

  protected toggleActive(kind: 'category' | 'exam' | 'subject', id: number, active: boolean) {
    const obs =
      kind === 'category'
        ? this.api.updateCategory(id, { active })
        : kind === 'exam'
          ? this.api.updateExam(id, { active })
          : this.api.updateSubject(id, { active });
    this.run(obs, active ? 'Enabled' : 'Disabled');
  }

  protected del(kind: 'category' | 'exam' | 'subject', id: number, name: string, childInfo: string) {
    const extra = childInfo ? ` and its ${childInfo}` : '';
    if (!confirm(`Delete "${name}"${extra}? Existing notes keep their saved values.`)) return;
    const obs =
      kind === 'category'
        ? this.api.deleteCategory(id)
        : kind === 'exam'
          ? this.api.deleteExam(id)
          : this.api.deleteSubject(id);
    this.run(obs, 'Removed');
  }

  private run(obs: Observable<ApiResponse<Taxonomy>>, msg: string, after?: () => void) {
    this.busy.set(true);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.categories.set(r.data?.categories ?? []);
        this.busy.set(false);
        this.toast.success(msg);
        after?.();
      },
      error: () => this.busy.set(false),
    });
  }
}
