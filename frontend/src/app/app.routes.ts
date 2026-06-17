import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@core/guards/auth.guard';
import { AppShellComponent } from '@layout/app-shell/app-shell.component';

export const routes: Routes = [
  // ── Public landing (no shell) ───────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('@features/landing/landing.component').then((m) => m.LandingComponent),
  },

  // ── Legal (public, no shell) ────────────────────────────────
  {
    path: 'terms',
    data: { kind: 'terms' },
    loadComponent: () => import('@features/legal/legal.component').then((m) => m.LegalComponent),
  },
  {
    path: 'privacy',
    data: { kind: 'privacy' },
    loadComponent: () => import('@features/legal/legal.component').then((m) => m.LegalComponent),
  },

  // ── Account (auth, no shell — buyer-facing top-nav world) ────
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('@features/account/account.component').then((m) => m.AccountComponent),
  },

  // ── Auth (no shell) ─────────────────────────────────────────
  { path: 'login', loadComponent: () => import('@features/auth/login/login.component').then((m) => m.LoginComponent) },
  {
    path: 'register',
    loadComponent: () => import('@features/auth/register/register.component').then((m) => m.RegisterComponent),
  },

  // ── Secure viewer (full-screen, no shell) ───────────────────
  {
    path: 'notes/:id/view',
    canActivate: [authGuard, roleGuard(['BUYER', 'SELLER'])],
    loadComponent: () => import('@features/buyer/note-view/note-view.component').then((m) => m.NoteViewComponent),
  },

  // ── Buyer-facing pages (shared top nav, no sidebar shell) ───
  {
    path: 'browse',
    loadComponent: () => import('@features/buyer/browse/browse.component').then((m) => m.BrowseComponent),
  },
  {
    path: 'notes/:id',
    loadComponent: () =>
      import('@features/buyer/note-detail/note-detail.component').then((m) => m.NoteDetailComponent),
  },
  {
    path: 'u/:id',
    loadComponent: () =>
      import('@features/seller-profile/seller-profile.component').then((m) => m.SellerProfileComponent),
  },
  {
    path: 'my-purchases',
    canActivate: [authGuard, roleGuard(['BUYER', 'SELLER'])],
    loadComponent: () =>
      import('@features/buyer/my-purchases/my-purchases.component').then((m) => m.MyPurchasesComponent),
  },

  // ── Seller & Admin consoles (wrapped in the sidebar shell) ──
  {
    path: '',
    component: AppShellComponent,
    children: [
      // Seller
      {
        path: 'seller',
        canActivate: [authGuard, roleGuard(['SELLER'])],
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('@features/seller/dashboard/seller-dashboard.component').then((m) => m.SellerDashboardComponent),
          },
          {
            path: 'verification',
            loadComponent: () =>
              import('@features/seller/verification/verification.component').then((m) => m.VerificationComponent),
          },
          {
            path: 'qualifications',
            loadComponent: () =>
              import('@features/seller/qualifications/seller-qualifications.component').then(
                (m) => m.SellerQualificationsComponent,
              ),
          },
          {
            path: 'upload',
            loadComponent: () =>
              import('@features/seller/upload-note/upload-note.component').then((m) => m.UploadNoteComponent),
          },
          {
            path: 'notes',
            loadComponent: () => import('@features/seller/my-notes/my-notes.component').then((m) => m.MyNotesComponent),
          },
          {
            path: 'notes/:id/edit',
            loadComponent: () =>
              import('@features/seller/upload-note/upload-note.component').then((m) => m.UploadNoteComponent),
          },
        ],
      },

      // Admin
      {
        path: 'admin',
        canActivate: [authGuard, roleGuard(['ADMIN'])],
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('@features/admin/dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
          },
          {
            path: 'users',
            loadComponent: () =>
              import('@features/admin/users/admin-users.component').then((m) => m.AdminUsersComponent),
          },
          {
            path: 'verifications',
            loadComponent: () =>
              import('@features/admin/verifications/admin-verifications.component').then(
                (m) => m.AdminVerificationsComponent,
              ),
          },
          {
            path: 'landing',
            loadComponent: () =>
              import('@features/admin/landing-editor/admin-landing-editor.component').then(
                (m) => m.AdminLandingEditorComponent,
              ),
          },
          {
            path: 'config',
            loadComponent: () =>
              import('@features/admin/config/admin-config.component').then((m) => m.AdminConfigComponent),
          },
          {
            path: 'test',
            loadComponent: () =>
              import('@features/admin/test-manager/admin-test-manager.component').then(
                (m) => m.AdminTestManagerComponent,
              ),
          },
          {
            path: 'taxonomy',
            loadComponent: () =>
              import('@features/admin/taxonomy/admin-taxonomy.component').then((m) => m.AdminTaxonomyComponent),
          },
          {
            path: 'payouts',
            loadComponent: () =>
              import('@features/admin/payouts/admin-payouts.component').then((m) => m.AdminPayoutsComponent),
          },
        ],
      },
    ],
  },

  { path: '**', redirectTo: 'browse' },
];
