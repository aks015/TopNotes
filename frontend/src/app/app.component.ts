import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { LandingContent } from '@core/models';
import { ToastComponent } from '@ui/toast/toast.component';
import { ConfirmDialogComponent } from '@ui/confirm-dialog/confirm-dialog.component';
import { ConsentDialogComponent } from '@ui/consent-dialog/consent-dialog.component';
import { SiteFooterComponent } from '@layout/site-footer/site-footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastComponent, ConfirmDialogComponent, ConsentDialogComponent, SiteFooterComponent],
  template: `
    <router-outlet />
    @if (showFooter()) {
      <app-site-footer [footer]="footer()" />
    }
    <app-toast /><app-confirm /><app-consent />
  `,
})
export class AppComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  /** Shared footer config (from the admin-editable landing content). */
  protected footer = signal<LandingContent['footer']>(undefined);
  /** Hidden on the full-screen secure reader and the self-contained auth pages. */
  protected showFooter = signal(this.footerVisible(this.router.url));

  constructor() {
    this.api
      .getLandingContent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.footer.set(r.data?.footer), error: () => {} });

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.showFooter.set(this.footerVisible((e as NavigationEnd).urlAfterRedirects)));
  }

  /** Auth pages and the secure reader own the full viewport — no shared footer. */
  private footerVisible(url: string): boolean {
    return !['/view', '/login', '/register'].some((p) => url.includes(p));
  }
}
