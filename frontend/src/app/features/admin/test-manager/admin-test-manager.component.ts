import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { ConfirmService } from '@core/services/confirm.service';
import { TestConfig, TestOverview, TestQuestionAdmin } from '@core/models';

const KEYS = ['A', 'B', 'C', 'D'];
const SUBJECTS = ['General Knowledge', 'Reasoning', 'Quantitative Aptitude', 'English', 'Subject-specific'];

@Component({
  selector: 'app-admin-test-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tm">
      <header class="tm-head">
        <div class="tm-eyebrow">admin console</div>
        <h1 class="tm-title">Test manager</h1>
        <p class="tm-sub">Per-category qualification tests — each category has its own pass mark and question pool, plus a shared "General" pool.</p>
      </header>

      <!-- Scope switcher -->
      <div class="tm-scopebar">
        <button class="tm-scope-tab" [class.on]="mode() === 'overview'" (click)="showOverview()">Overview</button>
        <div class="tm-scope-pick">
          <span>Edit test:</span>
          <select (change)="onScope($any($event.target).value)">
            <option value="general" [selected]="mode() === 'manage' && editScope() === 'general'">General (shared pool)</option>
            @for (c of categories(); track c.id) {
              <option [value]="c.id" [selected]="mode() === 'manage' && editScope() === c.id">{{ c.name }}</option>
            }
          </select>
        </div>
      </div>

      @if (mode() === 'overview') {
        <!-- ───────── Overview matrix ───────── -->
        @if (loadingOverview()) {
          <div class="tm-skel"></div>
        } @else {
          <div class="tm-ov">
            <div class="tm-ov-row tm-ov-head">
              <span>Scope</span><span>Test</span><span>Pass</span><span>Per test</span><span>Active pool</span><span>Attempts</span><span>Pass rate</span><span></span>
            </div>
            @for (r of overview(); track r.categoryName) {
              <div class="tm-ov-row" [class.general]="r.categoryId === null">
                <span class="tm-ov-name">{{ r.categoryName }}</span>
                <span><i class="tm-dot" [class.on]="r.configActive"></i>{{ r.configActive ? 'Active' : 'Off' }}</span>
                <span>{{ r.passScore }}%</span>
                <span>{{ r.questionsPerTest }}</span>
                <span [class.tm-warn-text]="r.activeQuestions < r.questionsPerTest">
                  {{ r.activeQuestions }}@if (r.categoryId !== null && r.ownQuestions > 0) { <small>({{ r.ownQuestions }} own)</small> }
                </span>
                <span>{{ r.attempts }}</span>
                <span>{{ r.attempts ? r.passRate + '%' : '—' }}</span>
                <span class="tm-ov-act">
                  @if (r.categoryId === null) {
                    <button class="tm-btn ghost sm" (click)="manage('general')">Manage</button>
                  } @else {
                    <button class="tm-btn ghost sm" (click)="manage(r.categoryId)">Manage</button>
                  }
                </span>
              </div>
            }
          </div>
          <p class="tm-note">Each category's test draws from its own questions <b>plus</b> the shared General pool. "Active pool" is the effective number a seller is tested on.</p>
        }
      } @else {
        <!-- ───────── Manage a scope ───────── -->
        <div class="tm-scope-title">Editing <b>{{ scopeName() }}</b></div>
        <div class="tm-tabs">
          <button class="tm-tab" [class.on]="tab() === 'config'" (click)="tab.set('config')">Test config</button>
          <button class="tm-tab" [class.on]="tab() === 'questions'" (click)="tab.set('questions')">
            Questions <span class="tm-tab-n">{{ total() }}</span>
          </button>
          <button class="tm-tab" [class.on]="tab() === 'preview'" (click)="tab.set('preview')">Seller preview</button>
        </div>

        @switch (tab()) {
          @case ('config') {
            <div class="tm-card tm-config">
              @for (f of numFields(); track f.key) {
                <div class="tm-row">
                  <div class="tm-row-text"><div class="tm-row-label">{{ f.label }}</div><div class="tm-row-help">{{ f.help }}</div></div>
                  <div class="tm-row-ctrl">
                    <input class="tm-num" type="number" [value]="f.sig()" (input)="f.sig.set(+$any($event.target).value)" />
                    @if (f.unit) { <span class="tm-unit">{{ f.unit }}</span> }
                  </div>
                </div>
              }
              <div class="tm-row">
                <div class="tm-row-text"><div class="tm-row-label">Test required</div><div class="tm-row-help">If off, this category is locked — no one can qualify or sell in it.</div></div>
                <button class="tm-toggle" [class.on]="isActive()" (click)="isActive.set(!isActive())"><span></span></button>
              </div>
              <div class="tm-row">
                <div class="tm-row-text"><div class="tm-row-label">Shuffle questions</div><div class="tm-row-help">Randomise question order each attempt.</div></div>
                <button class="tm-toggle" [class.on]="shuffleQ()" (click)="shuffleQ.set(!shuffleQ())"><span></span></button>
              </div>
              <div class="tm-row">
                <div class="tm-row-text"><div class="tm-row-label">Shuffle options</div><div class="tm-row-help">Randomise A–D answer order.</div></div>
                <button class="tm-toggle" [class.on]="shuffleO()" (click)="shuffleO.set(!shuffleO())"><span></span></button>
              </div>
              @if (perTest() > activePool()) {
                <div class="tm-warn">⚠ Questions per test ({{ perTest() }}) exceeds the active pool ({{ activePool() }}) for {{ scopeName() }}. Add more questions or lower this number.</div>
              } @else {
                <div class="tm-note">Drawing <b>{{ perTest() }}</b> of <b>{{ activePool() }}</b> active questions per attempt.</div>
              }
              <button class="tm-btn primary" [disabled]="savingCfg()" (click)="saveConfig()">{{ savingCfg() ? 'Saving…' : 'Save config' }}</button>
            </div>
          }

          @case ('questions') {
            <div class="tm-q-tools">
              <label class="tm-search">
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <input type="search" placeholder="Search questions…" [value]="term()" (input)="onSearch($any($event.target).value)" />
              </label>
              <span class="tm-q-count">{{ total() }} in {{ scopeName() }} · {{ activeCount() }} active</span>
              <button class="tm-btn primary" (click)="openAdd()">+ Add question</button>
            </div>
            @if (loadingQ()) {
              <div class="tm-skel"></div><div class="tm-skel"></div>
            } @else {
              @for (q of questions(); track q.id; let i = $index) {
                <div class="tm-q" [class.off]="!q.isActive">
                  <div class="tm-q-top">
                    <span class="tm-q-num">{{ i + 1 }}</span>
                    <div class="tm-q-text">{{ q.questionText }}</div>
                    @if (q.subject) { <span class="tm-q-subj">{{ q.subject }}</span> }
                    <div class="tm-q-actions">
                      <button class="tm-toggle sm" [class.on]="q.isActive" (click)="toggle(q)"><span></span></button>
                      <button class="tm-icon" (click)="openEdit(q)" aria-label="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L4 18z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>
                      <button class="tm-icon danger" (click)="remove(q)" aria-label="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5h6v2m-8 0 1 13h8l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                    </div>
                  </div>
                  <div class="tm-opts">
                    @for (o of q.options; track o.optionKey) {
                      <div class="tm-opt" [class.correct]="o.optionKey === q.correctAnswerKey">
                        <span class="tm-opt-k">{{ o.optionKey }}</span>{{ o.optionText }}
                        @if (o.optionKey === q.correctAnswerKey) { <span class="tm-opt-tick">✓</span> }
                      </div>
                    }
                  </div>
                </div>
              } @empty {
                <p class="tm-none">{{ term() ? 'No questions match.' : 'No questions in ' + scopeName() + ' yet — add one (it also draws from the General pool).' }}</p>
              }
              @if (hasMoreQ()) {
                <div class="tm-more"><button class="tm-btn ghost" [disabled]="loadingMore()" (click)="loadMore()">{{ loadingMore() ? 'Loading…' : 'Load more' }}</button></div>
              }
            }
          }

          @case ('preview') {
            <div class="tm-card tm-preview">
              <div class="tm-pv-badge">Seller view · {{ scopeName() }} · answers hidden</div>
              @if (activeQs().length) {
                <div class="tm-pv-meta">Question {{ previewIdx() + 1 }} of {{ activeQs().length }}@if (pv().subject) { · {{ pv().subject }} }</div>
                <div class="tm-pv-q">{{ pv().questionText }}</div>
                @for (o of pv().options; track o.optionKey) {
                  <label class="tm-pv-opt"><input type="radio" name="pv" /><span class="tm-opt-k">{{ o.optionKey }}</span>{{ o.optionText }}</label>
                }
                <div class="tm-pv-nav">
                  <button class="tm-btn ghost sm" [disabled]="previewIdx() === 0" (click)="previewIdx.set(previewIdx() - 1)">‹ Prev</button>
                  <button class="tm-btn ghost sm" [disabled]="previewIdx() >= activeQs().length - 1" (click)="previewIdx.set(previewIdx() + 1)">Next ›</button>
                </div>
              } @else {
                <p class="tm-none">No active questions to preview in {{ scopeName() }}.</p>
              }
            </div>
          }
        }
      }
    </div>

    <!-- Add / Edit modal -->
    @if (modalOpen()) {
      <div class="tm-scrim" (click)="modalOpen.set(false)">
        <div class="tm-modal" (click)="$event.stopPropagation()">
          <h3>{{ editId() ? 'Edit question' : 'Add question' }} <span class="tm-modal-scope">· {{ scopeName() }}</span></h3>
          <label class="tm-field"><span>Question</span>
            <textarea [value]="nq.text()" (input)="nq.text.set($any($event.target).value)" placeholder="Type the question…"></textarea>
          </label>
          <label class="tm-field"><span>Subject tag (optional)</span>
            <select [value]="nq.subject()" (change)="nq.subject.set($any($event.target).value)">
              @for (s of subjects; track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </label>
          <div class="tm-field"><span>Options &amp; correct answer</span>
            @for (k of keys; track k; let i = $index) {
              <label class="tm-opt-edit" [class.correct]="nq.correct() === i">
                <input type="radio" name="correct" [checked]="nq.correct() === i" (change)="nq.correct.set(i)" />
                <span class="tm-opt-k">{{ k }}</span>
                <input class="tm-opt-input" [value]="nq.opts()[i]" (input)="setOpt(i, $any($event.target).value)" [attr.placeholder]="'Option ' + k" />
              </label>
            }
            <p class="tm-hint">Select the radio next to the correct option.</p>
          </div>
          <div class="tm-modal-foot">
            <button class="tm-btn ghost" (click)="modalOpen.set(false)">Cancel</button>
            <button class="tm-btn primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : (editId() ? 'Save question' : 'Add question') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tm { max-width: 980px; margin: 0 auto; font-family: 'Instrument Sans', system-ui, sans-serif; color: #16141e; }
      .tm-eyebrow { font-family: 'Caveat', cursive; font-size: 22px; font-weight: 600; color: #5840e0; }
      .tm-title { margin: 2px 0 6px; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 38px; letter-spacing: -0.03em; }
      .tm-sub { margin: 0 0 20px; font-size: 15px; color: #5b5870; max-width: 680px; }

      .tm-scopebar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; background: #fff; border: 1px solid #e9e5d8; border-radius: 14px; padding: 12px 16px; margin-bottom: 18px; }
      .tm-scope-tab { border: none; background: #f0ede4; cursor: pointer; font: inherit; font-weight: 700; font-size: 13.5px; color: #4b4860; padding: 9px 18px; border-radius: 99px; }
      .tm-scope-tab.on { background: #16141e; color: #fff; }
      .tm-scope-pick { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #5b5870; }
      .tm-scope-pick select { border: 1px solid #e2decf; border-radius: 99px; padding: 9px 16px; font: inherit; font-size: 14px; font-weight: 600; background: #fff; cursor: pointer; }
      .tm-scope-title { font-size: 14px; color: #5b5870; margin-bottom: 12px; }
      .tm-scope-title b { color: #16141e; }

      /* Overview matrix */
      .tm-ov { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; overflow: hidden; }
      .tm-ov-row { display: grid; grid-template-columns: 1.6fr 0.9fr 0.6fr 0.7fr 1fr 0.8fr 0.8fr 0.8fr; align-items: center; gap: 10px; padding: 13px 16px; border-top: 1px solid #f0ede2; font-size: 13.5px; }
      .tm-ov-row:first-child { border-top: none; }
      .tm-ov-head { background: #fbfaf6; font-size: 11.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #8b879a; }
      .tm-ov-row.general { background: #faf9ff; }
      .tm-ov-name { font-weight: 700; }
      .tm-dot { display: inline-block; width: 8px; height: 8px; border-radius: 99px; background: #c5bfd8; margin-right: 6px; }
      .tm-dot.on { background: #1a9e5f; }
      .tm-warn-text { color: #c47f17; font-weight: 700; }
      .tm-ov-row small { color: #a8a4b8; }
      .tm-ov-act { text-align: right; }

      .tm-tabs { display: flex; gap: 6px; margin-bottom: 20px; border-bottom: 1px solid #e9e5d8; }
      .tm-tab { border: none; background: none; cursor: pointer; font: inherit; font-weight: 700; font-size: 14px; color: #8b879a; padding: 10px 4px; margin-right: 20px; border-bottom: 2px solid transparent; }
      .tm-tab.on { color: #16141e; border-bottom-color: #5840e0; }
      .tm-tab-n { font-size: 12px; color: #8b879a; }

      .tm-card { background: #fff; border: 1px solid #e9e5d8; border-radius: 16px; padding: 8px 24px; }
      .tm-config { max-width: 660px; padding-bottom: 24px; }
      .tm-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; border-top: 1px solid #f0ede2; }
      .tm-row:first-child { border-top: none; }
      .tm-row-label { font-weight: 700; font-size: 14.5px; }
      .tm-row-help { font-size: 13px; color: #8b879a; margin-top: 2px; }
      .tm-row-ctrl { display: flex; align-items: center; gap: 8px; }
      .tm-num { width: 90px; border: 1px solid #e2decf; border-radius: 10px; padding: 9px 12px; font: inherit; font-size: 14.5px; text-align: center; }
      .tm-num:focus { outline: none; border-color: #5840e0; box-shadow: 0 0 0 3px rgba(88,64,224,.12); }
      .tm-unit { color: #8b879a; font-size: 14px; }
      .tm-toggle { width: 46px; height: 27px; border-radius: 99px; background: #d9d3c2; border: none; cursor: pointer; padding: 3px; transition: background .18s; flex: none; }
      .tm-toggle.sm { width: 40px; height: 23px; }
      .tm-toggle span { display: block; width: 21px; height: 21px; border-radius: 99px; background: #fff; transition: transform .18s; }
      .tm-toggle.sm span { width: 17px; height: 17px; }
      .tm-toggle.on { background: #5840e0; }
      .tm-toggle.on span { transform: translateX(19px); }
      .tm-toggle.sm.on span { transform: translateX(17px); }
      .tm-warn { margin: 16px 0 0; padding: 12px 14px; background: #fff6e6; border: 1px solid #f3e0b8; border-radius: 12px; font-size: 13px; color: #9a6a12; }
      .tm-note { margin: 16px 0 0; font-size: 13.5px; color: #8b879a; }
      .tm-note b { color: #16141e; }

      .tm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; cursor: pointer; font: inherit; font-weight: 700; border-radius: 99px; padding: 11px 22px; font-size: 14px; transition: background .16s, color .16s, border-color .16s; }
      .tm-btn.sm { padding: 7px 14px; font-size: 13px; }
      .tm-btn.primary { background: #16141e; color: #fff; }
      .tm-btn.primary:hover:not(:disabled) { background: #5840e0; }
      .tm-btn.ghost { background: #fff; border: 1px solid #e2decf; color: #4b4860; }
      .tm-btn.ghost:hover:not(:disabled) { border-color: #5840e0; color: #5840e0; }
      .tm-btn:disabled { opacity: .55; cursor: default; }
      .tm-config .tm-btn { margin-top: 20px; }

      .tm-q-tools { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
      .tm-search { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2decf; border-radius: 99px; padding: 0 14px; color: #8b879a; flex: 1; min-width: 200px; }
      .tm-search:focus-within { border-color: #5840e0; box-shadow: 0 0 0 3px rgba(88,64,224,.12); }
      .tm-search input { border: none; background: none; outline: none; font: inherit; font-size: 14px; padding: 9px 0; width: 100%; color: #16141e; }
      .tm-q-count { font-size: 13px; color: #8b879a; white-space: nowrap; }

      .tm-q { background: #fff; border: 1px solid #e9e5d8; border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; }
      .tm-q.off { opacity: .6; }
      .tm-q-top { display: flex; gap: 12px; align-items: center; }
      .tm-q-num { width: 26px; height: 26px; border-radius: 8px; background: #efebff; color: #5840e0; display: grid; place-items: center; font-weight: 800; font-size: 13px; flex: none; align-self: flex-start; margin-top: 1px; }
      .tm-q-text { flex: 1; min-width: 0; font-weight: 600; font-size: 14.5px; line-height: 1.45; }
      .tm-q-subj { flex: none; align-self: flex-start; margin-top: 1px; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: #efebff; color: #5840e0; white-space: nowrap; }
      .tm-q-actions { display: flex; align-items: center; gap: 8px; flex: none; }
      .tm-icon { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #eee9dc; background: #fff; display: grid; place-items: center; cursor: pointer; color: #5b5870; }
      .tm-icon:hover { border-color: #5840e0; color: #5840e0; }
      .tm-icon.danger:hover { border-color: #f0b4ae; color: #d8453b; }
      .tm-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 12px 0 0 38px; }
      .tm-opt { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #5b5870; padding: 6px 10px; border-radius: 8px; background: #fbfaf6; }
      .tm-opt.correct { background: #eafaf0; color: #16864f; font-weight: 600; }
      .tm-opt-k { width: 20px; height: 20px; border-radius: 6px; background: #ece8dd; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex: none; }
      .tm-opt.correct .tm-opt-k { background: #1a9e5f; color: #fff; }
      .tm-opt-tick { margin-left: auto; color: #1a9e5f; font-weight: 700; }
      .tm-none { color: #8b879a; font-size: 14px; padding: 20px 0; }
      .tm-more { display: flex; justify-content: center; margin-top: 8px; }

      .tm-preview { max-width: 620px; padding: 24px; }
      .tm-pv-badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 99px; background: #fff6e6; color: #c47f17; margin-bottom: 16px; }
      .tm-pv-meta { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #8b879a; margin-bottom: 8px; }
      .tm-pv-q { font-size: 16.5px; font-weight: 600; margin-bottom: 16px; }
      .tm-pv-opt { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid #e9e5d8; border-radius: 12px; margin-bottom: 8px; cursor: pointer; font-size: 14px; }
      .tm-pv-opt:hover { border-color: #c9c2ad; }
      .tm-pv-nav { display: flex; justify-content: space-between; margin-top: 16px; }

      .tm-skel { height: 120px; border-radius: 14px; margin-bottom: 12px; background: linear-gradient(100deg, #f1eee6 30%, #f7f5ef 50%, #f1eee6 70%); background-size: 200% 100%; animation: tmShimmer 1.3s infinite; }
      @keyframes tmShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

      .tm-scrim { position: fixed; inset: 0; background: rgba(22,20,30,.5); display: grid; place-items: center; z-index: 100; padding: 24px; }
      .tm-modal { background: #fff; border-radius: 18px; padding: 24px; width: min(560px, 100%); max-height: 90vh; overflow-y: auto; }
      .tm-modal h3 { margin: 0 0 16px; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 700; font-size: 20px; }
      .tm-modal-scope { font-family: 'Instrument Sans'; font-size: 13px; font-weight: 600; color: #8b879a; }
      .tm-field { display: block; margin-bottom: 16px; }
      .tm-field > span { display: block; font-size: 13px; font-weight: 700; color: #4b4860; margin-bottom: 7px; }
      .tm-field textarea, .tm-field select { width: 100%; box-sizing: border-box; border: 1px solid #e2decf; border-radius: 12px; padding: 11px 14px; font: inherit; font-size: 14px; }
      .tm-field textarea { min-height: 80px; resize: vertical; }
      .tm-field textarea:focus, .tm-field select:focus { outline: none; border-color: #5840e0; box-shadow: 0 0 0 3px rgba(88,64,224,.12); }
      .tm-opt-edit { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #eee9dc; border-radius: 10px; margin-bottom: 8px; }
      .tm-opt-edit.correct { border-color: #c4ecd5; background: #f3fbf6; }
      .tm-opt-edit input[type=radio] { accent-color: #1a9e5f; width: 16px; height: 16px; }
      .tm-opt-input { flex: 1; border: none; outline: none; font: inherit; font-size: 14px; background: none; }
      .tm-hint { margin: 4px 0 0; font-size: 12.5px; color: #a8a4b8; }
      .tm-modal-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }

      @media (max-width: 720px) {
        .tm-title { font-size: 30px; }
        .tm-ov-row { grid-template-columns: 1.4fr 0.8fr 1fr auto; }
        .tm-ov-row > span:nth-child(3), .tm-ov-row > span:nth-child(4), .tm-ov-row > span:nth-child(6), .tm-ov-row > span:nth-child(7) { display: none; }
        .tm-opts { grid-template-columns: 1fr; margin-left: 0; }
      }
    `,
  ],
})
export class AdminTestManagerComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private destroyRef = inject(DestroyRef);

  protected readonly keys = KEYS;
  protected readonly subjects = SUBJECTS;

  // ── Scope ─────────────────────────────────────────────────
  protected mode = signal<'overview' | 'manage'>('overview');
  protected editScope = signal<'general' | number>('general'); // null-scope = 'general'
  protected categories = signal<{ id: number; name: string }[]>([]);
  protected overview = signal<TestOverview[]>([]);
  protected loadingOverview = signal(true);
  protected scopeCatId = computed<number | null>(() => (this.editScope() === 'general' ? null : (this.editScope() as number)));
  protected scopeName = computed(() => {
    if (this.editScope() === 'general') return 'General (shared)';
    return this.categories().find((c) => c.id === this.editScope())?.name ?? 'Category';
  });

  protected tab = signal<'config' | 'questions' | 'preview'>('config');

  // ── Config ────────────────────────────────────────────────
  private loadedCfg: TestConfig | null = null;
  protected passScore = signal(70);
  protected timeLimit = signal(30);
  protected perTest = signal(10);
  protected maxAttempts = signal(3);
  protected isActive = signal(true);
  protected shuffleQ = signal(true);
  protected shuffleO = signal(false);
  protected savingCfg = signal(false);
  protected numFields = computed(() => [
    { key: 'pass', label: 'Pass score', help: 'Minimum percentage a seller must score to pass.', unit: '%', sig: this.passScore },
    { key: 'time', label: 'Time limit', help: 'Total time allowed to complete the test.', unit: 'min', sig: this.timeLimit },
    { key: 'per', label: 'Questions per test', help: 'Randomly drawn from the active pool (own + General).', unit: '', sig: this.perTest },
    { key: 'att', label: 'Max attempts', help: 'How many times a seller can take this category test (0 = unlimited).', unit: '', sig: this.maxAttempts },
  ]);

  // ── Questions ─────────────────────────────────────────────
  protected questions = signal<TestQuestionAdmin[]>([]);
  protected total = signal(0);
  private page = signal(0);
  protected loadingQ = signal(true);
  protected loadingMore = signal(false);
  protected term = signal('');
  private search$ = new Subject<string>();
  protected activeCount = computed(() => this.questions().filter((q) => q.isActive).length);
  protected activePool = computed(() => this.loadedCfg?.totalActiveQuestions ?? this.activeCount());
  protected hasMoreQ = computed(() => this.questions().length < this.total());
  protected activeQs = computed(() => this.questions().filter((q) => q.isActive));
  protected previewIdx = signal(0);
  protected pv = computed(() => this.activeQs()[Math.min(this.previewIdx(), this.activeQs().length - 1)] ?? null);

  // ── Modal ─────────────────────────────────────────────────
  protected modalOpen = signal(false);
  protected saving = signal(false);
  protected editId = signal<number | null>(null);
  protected nq = { text: signal(''), subject: signal(SUBJECTS[0]), opts: signal(['', '', '', '']), correct: signal(0) };

  constructor() {
    this.loadOverview();
    this.api.getTaxonomy().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => this.categories.set((r.data?.categories ?? []).map((c) => ({ id: c.id, name: c.name }))),
      error: () => {},
    });
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchQuestions(0));
  }

  private loadOverview() {
    this.loadingOverview.set(true);
    this.api.getTestOverview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.overview.set(r.data ?? []); this.loadingOverview.set(false); },
      error: () => this.loadingOverview.set(false),
    });
  }

  protected showOverview() { this.mode.set('overview'); this.loadOverview(); }
  protected manage(scope: 'general' | number) { this.editScope.set(scope); this.enterManage(); }
  protected onScope(v: string) { this.editScope.set(v === 'general' ? 'general' : +v); this.enterManage(); }

  private enterManage() {
    this.mode.set('manage');
    this.tab.set('config');
    this.term.set('');
    this.previewIdx.set(0);
    this.loadConfig();
    this.fetchQuestions(0);
  }

  private loadConfig() {
    this.api.getTestConfig(this.scopeCatId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        const c = r.data; this.loadedCfg = c;
        if (c) {
          this.passScore.set(c.passScorePercent); this.timeLimit.set(c.timeLimitMinutes);
          this.perTest.set(c.questionsPerTest); this.maxAttempts.set(c.maxAttempts ?? 0);
          this.isActive.set(c.isActive); this.shuffleQ.set(c.shuffleQuestions); this.shuffleO.set(c.shuffleOptions);
        }
      },
      error: () => {},
    });
  }

  private fetchQuestions(page: number) {
    const initial = page === 0;
    initial ? this.loadingQ.set(true) : this.loadingMore.set(true);
    this.api.getTestQuestions(this.term().trim() || undefined, page, this.scopeCatId())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (r) => {
          const content = r.data?.content ?? [];
          this.questions.update((cur) => (initial ? content : [...cur, ...content]));
          this.total.set(r.data?.totalElements ?? 0);
          this.page.set(page); this.loadingQ.set(false); this.loadingMore.set(false);
        },
        error: () => { this.loadingQ.set(false); this.loadingMore.set(false); },
      });
  }
  protected onSearch(v: string) { this.term.set(v); this.search$.next(v); }
  protected loadMore() { if (!this.loadingMore() && this.hasMoreQ()) this.fetchQuestions(this.page() + 1); }

  protected saveConfig() {
    this.savingCfg.set(true);
    const cfg: TestConfig = {
      ...(this.loadedCfg ?? ({} as TestConfig)),
      passScorePercent: this.passScore(), timeLimitMinutes: this.timeLimit(),
      questionsPerTest: this.perTest(), maxAttempts: this.maxAttempts(),
      isActive: this.isActive(), shuffleQuestions: this.shuffleQ(), shuffleOptions: this.shuffleO(),
    };
    this.api.updateTestConfig(cfg, this.scopeCatId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.loadedCfg = r.data; this.savingCfg.set(false); this.toast.success('Config saved for ' + this.scopeName()); this.loadOverview(); },
      error: () => this.savingCfg.set(false),
    });
  }

  protected toggle(q: TestQuestionAdmin) {
    if (q.id == null) return;
    this.api.toggleTestQuestion(q.id, !q.isActive).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.questions.update((list) => list.map((x) => (x.id === q.id ? { ...x, isActive: !x.isActive } : x))),
      error: () => {},
    });
  }
  protected async remove(q: TestQuestionAdmin) {
    if (q.id == null) return;
    const ok = await this.confirm.ask({ title: 'Delete question?', message: 'This question will be removed from the pool.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    this.api.deleteTestQuestion(q.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.toast.success('Question deleted'); this.questions.update((l) => l.filter((x) => x.id !== q.id)); this.total.update((t) => Math.max(0, t - 1)); },
      error: () => {},
    });
  }

  protected openAdd() {
    this.editId.set(null);
    this.nq.text.set(''); this.nq.subject.set(SUBJECTS[0]); this.nq.opts.set(['', '', '', '']); this.nq.correct.set(0);
    this.modalOpen.set(true);
  }
  protected openEdit(q: TestQuestionAdmin) {
    this.editId.set(q.id ?? null);
    this.nq.text.set(q.questionText);
    this.nq.subject.set(q.subject || SUBJECTS[0]);
    const opts = ['', '', '', ''];
    (q.options ?? []).forEach((o) => { const idx = KEYS.indexOf(o.optionKey); if (idx >= 0) opts[idx] = o.optionText; });
    this.nq.opts.set(opts);
    this.nq.correct.set(Math.max(0, KEYS.indexOf(q.correctAnswerKey)));
    this.modalOpen.set(true);
  }
  protected setOpt(i: number, v: string) { this.nq.opts.update((o) => o.map((x, idx) => (idx === i ? v : x))); }

  protected save() {
    if (!this.nq.text().trim() || this.nq.opts().some((o) => !o.trim())) {
      this.toast.error('Fill the question and all 4 options.');
      return;
    }
    this.saving.set(true);
    const correct = this.nq.correct();
    const req: TestQuestionAdmin = {
      questionText: this.nq.text().trim(),
      subject: this.nq.subject(),
      categoryId: this.scopeCatId(),
      displayOrder: this.questions().length + 1,
      isActive: true,
      correctAnswerKey: KEYS[correct],
      options: this.nq.opts().map((text, i) => ({ optionKey: KEYS[i], optionText: text.trim(), isCorrect: i === correct })),
    };
    const id = this.editId();
    const obs = id ? this.api.updateTestQuestion(id, req) : this.api.createTestQuestion(req);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.toast.success(id ? 'Question updated' : 'Question added'); this.fetchQuestions(0); this.loadConfig(); },
      error: () => this.saving.set(false),
    });
  }
}
