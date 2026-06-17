# TopNotes — Frontend Enhancement Backlog

Senior-engineer review of what to build next on the frontend, now that the core
marketplace (browse, dual-role, Cashfree payments, secure viewer, landing CMS,
footer, legal pages) is complete. Ordered by **impact**: features that widen the
funnel (see → trust → buy → share → new visitors) come first.

Legend: **FE** = frontend only · **BE** = needs a small backend change from Akshat

---

## 🟢 Tier 1 — Highest ROI (revenue & growth)

### 1. Sample preview — free pages before buying
**Problem:** Buyers pay blind — they only see a thumbnail, title and price. Seeing a
sample of the actual handwriting/quality is the #1 thing that converts.

**Build:**
- Seller upload: a "Free preview pages" field (e.g. first 3 pages).
- Buyer note-detail: a **"Preview sample"** button opens the existing secure viewer
  showing only those pages, ending with a "🔒 Buy to unlock all N pages" gate.
- Existing watermark / screenshot protection stays on.

**BE:** new `previewPages` column on note; the view endpoint serves only those pages
when the user hasn't purchased.
**Effort:** Medium · **Impact:** Highest (direct conversion lift)

### 2. Seller storefront — public topper page
**Problem:** The pitch is "notes from real verified toppers," but a topper is just a
tiny name under each card. No page to be proud of or share on Instagram/WhatsApp.

**Build:**
- Public page `/sellers/:id`: topper photo, bio, exam/rank, **verified badge**,
  total sales/rating, and a grid of all their notes.
- Seller name on every note card + review links to this page.
- "Share" button (copies link) — toppers post these → free traffic.

**BE:** mostly exists; maybe one "public seller profile by id" endpoint.
**Effort:** Medium · **Impact:** High (turns sellers into a marketing channel + indexable pages)

### 3. SEO / meta tags + SSR
**Problem:** Landing, browse and note pages are now guest-visible, but Angular ships a
blank HTML shell — Google and WhatsApp/Instagram link bots see no title, description
or image. Notes won't rank; shared links show empty previews.

**Build:**
- Per-route `<title>` + `<meta>` / Open Graph tags (title, description, thumbnail),
  dynamic per note.
- Prerendering / SSR (`@angular/ssr`) so crawlers and link bots get real HTML.

**BE:** none (pure frontend).
**Effort:** Medium-High · **Impact:** High long-term (free organic traffic — compounds)

---

## 🟡 Tier 2 — Retention & trust

### 4. Wishlist / "Save for later"
Heart icon on note cards. Guests stored in localStorage, synced on login.
**FE** · Low effort · Medium impact (people bookmark notes for exam time).

### 5. Notification bell dropdown
APIs already exist (`unread-count`, `mark-all-read`). Surface a polling dropdown
panel, not just a count badge.
**FE** · Low-Medium effort · Medium impact.

### 6. Downloadable PDF invoice
`invoiceNumber` is already stored. Add a "Download invoice (PDF)" button on
My Purchases and seller sales. Generated client-side.
**FE** · Low-Medium effort · Medium impact (buyer records + seller taxes).

### 7. Review prompts after reading
Reading progress is already tracked — nudge buyers to rate when they finish.
More reviews → more trust → more sales.
**FE** · Low effort · Medium impact.

---

## 🔵 Tier 3 — Quality & platform

### 8. Accessibility + performance pass
`note-view` bundle is ~629 kB (pdf.js) — move to a web worker / lazier load.
a11y: keyboard nav, focus traps in modals, ARIA, colour contrast.
**FE** · Medium effort · Medium impact.

### 9. PWA
Installable, offline app shell, "Add to home screen." Students on phones use it like
an app.
**FE** · Medium effort · Medium impact.

### 10. Empty / error / skeleton consistency
A global error/retry boundary and consistent loading/empty states.
**FE** · Low-Medium effort · Low-Medium impact.

### 11. Dark mode
CSS tokens already exist — mostly a token swap.
**FE** · Low-Medium effort · Low impact (nice-to-have).

---

## Recommended sequence
1. **Sample preview** — fixes the buy-blind trust gap (most direct revenue impact).
2. **Seller storefront** — turns toppers into a growth channel.
3. **SEO / SSR** — converts that sharing into free Google traffic.
4. **Wishlist + invoices** — polish, do anytime (small).

Tier 1 #1–#3 compound; the rest are quality-of-life. Items 1 and 2 need a small
backend change; everything else is pure frontend.
