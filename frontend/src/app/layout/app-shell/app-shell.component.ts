import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { animate, query, style, transition, trigger } from '@angular/animations';
import { AuthService } from '@core/services/auth.service';
import { TopNavComponent } from '@layout/top-nav/top-nav.component';

const routeEnter = trigger('routeEnter', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('200ms cubic-bezier(.16,1,.3,1)', style({ opacity: 1, transform: 'none' })),
      ],
      { optional: true },
    ),
  ]),
]);

/**
 * Thin layout for the seller & admin consoles: the shared top nav plus a padded
 * content area. The marketplace pages (browse/purchases/note-detail) render the
 * same <app-top-nav> directly, so navigation is identical app-wide — no sidebar,
 * no two-paradigm bounce for dual-role users.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopNavComponent],
  animations: [routeEnter],
  template: `
    <app-top-nav />
    <main class="app-main">
      <div class="main-pad" [@routeEnter]="routeKey(o)"><router-outlet #o="outlet" /></div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        background: #fbfaf6;
        min-height: 100vh;
      }
    `,
  ],
})
export class AppShellComponent {
  private auth = inject(AuthService);

  constructor() {
    // Refresh the JWT once on entering the console so an admin-approved seller
    // picks up isVerified=true without logging out and back in.
    if (this.auth.isLoggedIn()) this.auth.refreshSession();
  }

  protected routeKey(o: RouterOutlet) {
    return o?.isActivated ? o.activatedRoute.snapshot.url.map((s) => s.path).join('/') || 'home' : '';
  }
}
