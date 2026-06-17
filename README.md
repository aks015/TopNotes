# TopNotes

A marketplace where verified toppers sell handwritten study notes (JEE/NEET/Boards). Buyers purchase and read notes in-browser; admins moderate users, seller verification, the MCQ test, and the revenue split.

**Stack:** Spring Boot 3.2 (Java 21) · Angular 17 · MySQL (local) / Postgres (Render) · JWT auth (ADMIN / SELLER / BUYER).

---

## Repository layout

```
Top_Notes/
├─ backend/          ← Spring Boot API (canonical) — owned by backend eng.
├─ frontend/         ← Angular 17 SPA
│   └─ src/app/
│       ├─ core/         services, guards, interceptors, models
│       ├─ shared/       reusable UI (navbar, …)
│       └─ features/     auth · buyer · seller · admin pages
├─ docs/             ← all project documentation (see table below)
├─ render.yaml       ← deployment config (backend + frontend + DB)
└─ README.md
```

## Documentation

| File | Purpose |
|------|---------|
| [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | Full local setup, test accounts, scenarios, deployment |
| [BACKEND_AUDIT.md](docs/BACKEND_AUDIT.md) | Backend architecture & code-quality audit |
| [BACKEND_ISSUES.md](docs/BACKEND_ISSUES.md) | Condensed backend fix checklist (engineer handoff) |
| [FRONTEND_AUDIT.md](docs/FRONTEND_AUDIT.md) | Frontend architecture & code-quality audit |
| [FRONTEND_CHECKLIST.md](docs/FRONTEND_CHECKLIST.md) | Industry-level frontend quality checklist |

## Quick start (local, via Docker for infra)

```powershell
# 1. MySQL
docker run -d --name topnotes-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=topnotes_db -p 3306:3306 mysql:8.0

# 2. Backend (builds Java 21 + Maven inside the image)
docker build -t topnotes-backend ./backend
docker run -d --name topnotes-backend -p 8080:8080 -e DB_HOST=host.docker.internal topnotes-backend

# 3. Frontend
cd frontend
npm install
node ".\node_modules\@angular\cli\bin\ng.js" serve --host 127.0.0.1 --port 4200
```

App: http://localhost:4200 · API: http://localhost:8080/api · Swagger: http://localhost:8080/api/swagger-ui.html

See [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for seed data, test accounts, and the full walkthrough.

## Frontend import aliases

The frontend uses TypeScript path aliases (configured in [frontend/tsconfig.json](frontend/tsconfig.json)):

| Alias | Resolves to |
|-------|-------------|
| `@core/*` | `src/app/core/*` |
| `@shared/*` | `src/app/shared/*` |
| `@features/*` | `src/app/features/*` |
| `@env/*` | `src/environments/*` |

Use these instead of deep relative paths, e.g. `import { ApiService } from '@core/services/api.service';`

---

## UPI Subscription Payments (no payment gateway)

Direct UPI payments to your personal bank account — no Razorpay/Cashfree/PayU required.

### Configure your UPI ID

Set in `backend/src/main/resources/application.properties` or via environment variables:

```properties
app.upi.id=yourname@paytm
app.upi.merchant-name=Your Name
```

Or: `UPI_ID`, `UPI_MERCHANT_NAME`

### Web UI (Thymeleaf + Bootstrap 5)

| URL | Description |
|-----|-------------|
| `/api/web/subscription/plans` | Browse subscription plans |
| `/api/web/login` | Sign in (form login for web UI) |
| `/api/web/subscription/pay/{planId}` | Ketto-style UPI payment modal with QR |
| `/api/web/subscription/dashboard` | User dashboard — status, history, pending |
| `/api/web/admin/payments` | Admin verification dashboard |

### REST API (JWT — for Angular/mobile)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription/plans` | List plans (public) |
| POST | `/api/subscription/pay/{planId}` | Initiate payment, get QR |
| POST | `/api/subscription/payment/submit` | Submit UTR proof |
| GET | `/api/subscription/dashboard` | User subscription dashboard |
| GET | `/api/admin/payments/dashboard` | Admin stats |
| GET | `/api/admin/payments?status=&utr=` | Search payments |
| POST | `/api/admin/payments/{id}/approve` | Approve & activate subscription |
| POST | `/api/admin/payments/{id}/reject` | Reject payment |

### Flow

1. User selects a plan → payment modal opens with dynamic UPI QR
2. User pays via GPay / PhonePe / Paytm / BHIM / Amazon Pay
3. User submits UTR, name, and mobile → status **PENDING**
4. Admin verifies in dashboard → **Approve** activates subscription instantly

SQL reference schema: `backend/src/main/resources/subscription_schema.sql`
