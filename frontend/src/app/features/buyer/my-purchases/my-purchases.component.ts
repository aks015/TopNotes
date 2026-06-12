import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { ReadingProgressService, ReadingEntry } from '@core/services/reading-progress.service';
import { Purchase } from '@core/models';
import { IllustrationComponent } from '@ui/illustration/illustration.component';
import { subjectGradientFlat } from '@shared/util/note-display';

@Component({
  selector: 'app-my-purchases',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, IllustrationComponent],
  template: `
    <div class="page-head">
      <div>
        <div class="crumb">Account</div>
        <h1>My purchases</h1>
        <p>{{ total() }} notes in your library.</p>
      </div>
    </div>

    @if (reading().length) {
      <div class="continue-reading">
        <div class="cr-head">
          <h3>Continue reading</h3>
          <button type="button" class="link-clear" (click)="clearReading()">Clear</button>
        </div>
        <div class="cr-strip">
          @for (r of reading(); track r.noteId) {
            <a class="cr-card" [routerLink]="['/notes', r.noteId, 'view']">
              <span class="cr-thumb" [style.background]="crThumb(r)">{{ crGlyph(r) }}</span>
              <span class="cr-body">
                <span class="cr-title">{{ r.title }}</span>
                <span class="cr-prog">Page {{ r.lastPage }} / {{ r.totalPages }}</span>
                <span class="cr-bar"><i [style.width.%]="crPct(r)"></i></span>
              </span>
            </a>
          }
        </div>
      </div>
    }

    @if (loading()) {
      <div class="skel" style="height:240px;border-radius:12px"></div>
    } @else if (purchases().length === 0) {
      <div class="card empty">
        <app-illustration name="purchases" />
        <h3>You haven't bought any notes yet</h3>
        <p>Browse verified topper notes for your exam and start your library.</p>
        <a class="btn btn-primary" routerLink="/browse">Browse notes</a>
      </div>
    } @else {
      <div class="table-wrap responsive">
        <table class="tn">
          <thead>
            <tr>
              <th>Note</th>
              <th class="hide-mobile">Date</th>
              <th class="hide-mobile">Amount</th>
              <th class="hide-mobile">Invoice</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (p of purchases(); track p.id) {
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:12px;">
                    <div
                      style="width:44px;height:56px;border-radius:6px;flex:none;"
                      [style.background]="thumbBg(p)"
                    ></div>
                    <div>
                      <div style="font-weight:700;">{{ p.note?.title }}</div>
                      <div class="muted" style="font-size:13px;">
                        {{ p.note?.seller?.fullName }} · {{ p.note?.subject }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="hide-mobile">{{ p.purchasedAt | date: 'd MMM y' }}</td>
                <td class="hide-mobile">₹{{ (p.amount || 0).toLocaleString('en-IN') }}</td>
                <td class="hide-mobile">
                  <span class="muted" style="font-size:13px;">{{ p.invoiceNumber }}</span>
                </td>
                <td>
                  <div class="tbl-actions">
                    <a class="btn btn-ghost btn-sm" [routerLink]="['/notes', p.note?.id]">Review</a>
                    <a class="btn btn-secondary btn-sm" [routerLink]="['/notes', p.note?.id, 'view']">Read</a>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mobile-cards">
        @for (p of purchases(); track p.id) {
          <div class="card card-pad">
            <div style="display:flex;gap:12px;">
              <div style="width:48px;height:60px;border-radius:6px;flex:none;" [style.background]="thumbBg(p)"></div>
              <div style="flex:1;">
                <div style="font-weight:700;font-size:14px;">{{ p.note?.title }}</div>
                <div class="muted" style="font-size:12px;margin-top:2px;">
                  {{ p.purchasedAt | date: 'd MMM y' }} · ₹{{ (p.amount || 0).toLocaleString('en-IN') }}
                </div>
                <div class="muted" style="font-size:12px;">{{ p.invoiceNumber }}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;">
              <a class="btn btn-secondary btn-sm btn-block" [routerLink]="['/notes', p.note?.id, 'view']">Read</a>
              <a class="btn btn-ghost btn-sm" [routerLink]="['/notes', p.note?.id]">Review</a>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class MyPurchasesComponent {
  private api = inject(ApiService);
  private readingService = inject(ReadingProgressService);
  private destroyRef = inject(DestroyRef);

  protected purchases = signal<Purchase[]>([]);
  protected total = signal(0);
  protected loading = signal(true);
  protected reading = signal<ReadingEntry[]>(this.readingService.list());

  constructor() {
    this.api
      .getMyPurchases(0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.purchases.set(r.data?.content ?? []);
          this.total.set(r.data?.totalElements ?? 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected thumbBg(p: Purchase): string {
    return subjectGradientFlat(p.note?.subject);
  }

  protected crThumb(r: ReadingEntry): string {
    return subjectGradientFlat(r.subject);
  }
  protected crGlyph(r: ReadingEntry): string {
    return (r.subject ?? '?').charAt(0).toUpperCase();
  }
  protected crPct(r: ReadingEntry): number {
    return r.totalPages ? Math.round((r.lastPage / r.totalPages) * 100) : 0;
  }
  protected clearReading(): void {
    this.reading().forEach((r) => this.readingService.remove(r.noteId));
    this.reading.set([]);
  }
}
