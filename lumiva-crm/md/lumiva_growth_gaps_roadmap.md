# Lumiva — Growth & Product Gaps Roadmap

_Compiled 2026-07-27. Full audit of the public marketing site (crm.lumiva.agency), the CRM product
itself (backend + frontend), the mobile app, and the platform-admin panel (pl1.lumiva.agency).
Working doc — check items off as we go, add new findings inline rather than starting a new file._

## How to use this

Each section is roughly ordered by impact-per-effort. The 🔴 section is real, live, silently-losing-
business-today stuff — do these first regardless of what else we pick up. Everything else is
grouped by area, not by priority, so scan a whole section before picking the next task.

---

## 🔴 Critical — fix first, real leads/traffic being lost right now

- [x] **`ContactPage.tsx` posts to a 404'ing endpoint.** Fixed 2026-08-03 — now posts to
      `/v1/public/demo-requests`, matching `LandingPage.tsx`'s demo drawer.
- [x] **Blog "Read" links are all dead.** Fixed 2026-08-03 — added a `/blog/:slug` route
      (`BlogPostPage.tsx`) with full article bodies for all 6 posts, shared post data extracted to
      `blogPosts.data.ts` so `BlogPage.tsx` and the new detail page stay in sync.
- [ ] **OpenAI platform key has exhausted its quota** (`insufficient_quota` from OpenAI itself,
      found 2026-07-27 — see `lumiva_ai_assistant_products_bookings_hotels.md` memory). Blocks the
      AI Assistant chat entirely, in every tenant, including any live demo. Needs billing
      top-up or a key swap in pl1 → Настройки; not something I can fix from here.
- [ ] **`FeaturesPage.tsx` publicly claims fake compliance certifications** — SOC 2 Type II,
      ISO 27001:2022, and a 152-ФЗ registration number ("77-19-00942"), all confirmed fabricated by
      the user 2026-08-03 (see the Security/Trust page item below). Doesn't fit this section's "lost
      traffic" framing, but sits here anyway because it's arguably the most urgent single item in
      this whole doc: a live public site telling enterprise buyers "valid certificates, reports on
      request" for audits that don't exist is a real legal/reputational liability, not just a growth
      gap. Needs an explicit decision from the user — remove, or relabel as "in progress" — not
      something to silently patch.

---

## Public marketing site

### Content / positioning
- [x] **No Booking or Hotels/PMS solution page at all.** Fixed 2026-08-03 — added
      `/solutions/booking` and `/solutions/hotels` (`BookingSolutionsPage.tsx`/`HotelSolutionsPage.tsx`,
      all 3 languages), matching the existing 6 pages' template exactly (hero, feature grid, data
      table, workflow, activity feed, metrics, CTA). Feature copy is pulled from real capabilities
      confirmed in `backend/src/bookings/`+`backend/src/hotels/` (staff scheduling/waitlist/no-show
      tracking for Bookings; pacing-vs-target/low-availability-risk/market+agency rates for Hotels) —
      not invented. Deliberately **dropped the template's "customer quote" block** for both new pages
      instead of writing a new fake testimonial, since the roadmap's own "zero social proof" finding
      below flags that pattern as a problem to fix, not extend. Wired into the header's Solutions
      dropdown (now 8 items), the footer's Solutions column, `sitemap.xml`, and `prerender.mjs`.
- [x] **Products module was filed under `/solutions/inventory`**, confusing next to the real
      Warehouse page. Fixed 2026-08-03 — renamed the route to `/solutions/products`, the file to
      `ProductsSolutionsPage.tsx`, and the nav key from `inventory`→`products` (label "Товары") in
      `PublicHeader.tsx`/`PublicFooter.tsx`/all 3 locale files. Old `/solutions/inventory` URL now
      302s via `<Navigate>` so no existing links/bookmarks break. Updated `sitemap.xml` and
      `prerender.mjs` to match.
- [x] **Workspace (no-code), AI Assistant, and "AI Employees"** weren't in `FeaturesPage.tsx`'s
      9-item feature taxonomy. Fixed 2026-08-03 — added as items 10/11/12 (all 3 languages), with
      copy based on real capabilities confirmed in code (`ai-employee-role-catalog.ts`'s 10 role-based
      agents with `read_only/suggest/assisted/auto` autonomy modes and an approval-action workflow;
      Workspace's Kanban/Calendar/Gantt/formula-field/entity-ref capabilities from the Changelog).
      Verified in-browser — the 3 new items sit in the TOC grid and render their own spotlight
      section correctly (no visual mockup for these three, which is fine — the section gracefully
      renders text-only when no mockup component exists at that index).
- [ ] **Zero social proof anywhere.** No testimonials, no case studies. The "Trusted by" logo
      marquee on the homepage (`Northwind, Contour BI, Parallax...`) reads as invented placeholder
      names — no logos, nothing backing them up. Needs either real customer quotes/logos or removal.
      **Still open — deliberately not done. Needs real customer input from the user; refused to
      fabricate more placeholder names/quotes on top of the ones already there.**
- [x] **Pricing FAQ contradicts the pricing cards on the same page.** Fixed 2026-08-03. Turned out
      the mismatch went deeper than plan names: only `enterprise` actually carries the 14-day trial
      (`Standard`/`Professional` are self-serve "start free," `Ultimate` is sales-assisted) — the
      bottom CTA banner ("14 days on Professional/Pro") was *also* pointing at the wrong plan, not
      just the FAQ. Rewrote the trial FAQ answer and the CTA banner (all 3 langs) to match what the
      plan cards actually offer, and unified the lead-overage fee to **€5**/1,000 leads across all 3
      languages — matching the live calculator's own rate in `PricingPage.tsx` — instead of the
      previous USD/RUB/TRY mix.
- [x] **No dedicated Security/Trust page.** Fixed 2026-08-03 — added `/security`
      (`SecurityPage.tsx`, all 3 languages, linked from the footer next to Privacy/Terms). **Important
      correction, confirmed directly with the user**: the SOC 2 Type II / ISO 27001:2022 / 152-ФЗ
      registration "77-19-00942" callout on `FeaturesPage.tsx` (`VisualSec` component, ~line 538) is
      **not real** — placeholder marketing copy, not an actual audit/certification. The new
      `/security` page was deliberately built from *only* code-verifiable facts instead (TLS 1.3,
      AES-256 at rest, bcrypt password hashing, multi-tenant DB-level isolation, RBAC, rate limiting
      20 req/s·100 req/10s, Helmet headers, mandatory `JWT_SECRET` with no fallback, configurable
      `CORS_ORIGINS`) and does not mention SOC 2/ISO 27001/152-ФЗ at all. **`FeaturesPage.tsx` still
      has the fake certification claims live on the site — this needs a decision**: remove them,
      replace with "in progress," or pursue the real certifications. Publishing a fabricated SOC 2
      report validity range and a fabricated Russian government registration number is a real
      legal/reputational exposure, arguably more urgent than most of this doc.
- [x] **`FeaturesPage.tsx`/`PricingPage.tsx` sell IP telephony/call recording as a real, paid feature**
      ("Call recording — transcription, dialog search, tags"; a fabricated demo stat block "IP
      Telephony · 4,240 calls · 1.8min avg · 68% PICK"; `PricingPage.tsx` prices it as a real add-on,
      "+€14/mo", "✓ + запись 3 года / 3yr rec."). Confirmed 2026-08-04 — zero telephony/SIP/IVR/PBX/
      click-to-call code exists anywhere in `backend/src`. Same class of risk as the fake SOC 2/ISO
      27001/152-ФЗ item above (advertising a feature that doesn't exist), arguably worse since it's
      tied to a specific price customers could actually be charged. **Decision from the user,
      2026-08-04: build the real thing, don't remove the copy** — the published description (call
      recording, transcription, dialog search, tags, per-number stats, 3-year retention, +€14/mo
      gate) becomes the actual spec to implement, not something to walk back. **Built 2026-08-04** —
      see the "Built the real IP-telephony feature..." entry in the Omnichannel section below for
      what's real vs. what still needs external setup. This checkbox covered the *decision*; the build
      is now done, so the marketing copy is no longer false — it just needs Twilio/Stripe configured
      per-tenant/platform before it's live, same as every other credential-gated integration in this
      doc.
- [ ] **Changelog publicly discloses past security remediations** (removal of a `JWT_SECRET`
      fallback, disabling live-schema-sync in prod). Informative for transparency, but also hands
      anyone a list of past weaknesses — worth a deliberate call on whether to keep, reword, or trim.
- [x] **No comparison page.** Fixed 2026-08-03, but **deliberately not** a "Lumiva vs. HubSpot/
      amoCRM/Bitrix24/Pipedrive" feature-table page — asked the user first, since fabricating
      specific "competitor X doesn't have Y" claims about real companies I have no verified current
      data on is the same class of risk as the fake certifications (false-advertising exposure). User
      confirmed: build a competitor-agnostic "why Lumiva" page instead. Added `/compare`
      (`ComparePage.tsx`, all 3 languages, linked from the footer) — 6 real differentiators (vertical
      modules built into the CRM, no-code Workspace, AI Assistant + AI Employees, single data model
      across modules, transparent per-plan-not-per-feature pricing, security-by-facts) with links out
      to `/pricing` and `/security`. No competitor named anywhere on the page.
- [ ] No careers page, no partner/reseller page, no live status/uptime page (uptime is only a
      static "99.9%" stat, not a real status page). **Still open** — all three need real inputs I
      don't have (actual open roles, an actual partner program with terms, real historical uptime
      data from monitoring infra) rather than something safe to fabricate.

### Localization (bigger than it looks — the fix is mostly "wire up copy that already exists")
- [x] **`AboutPage`, `ContactPage`, `FaqPage`, `PrivacyPage`, `TermsPage`, `ChangelogPage`, and the
      homepage's own hero headline are hardcoded Russian.** Fixed 2026-08-03. Correction to the
      original note: only page *chrome* (titles/labels) pre-existed in `locales/{en,tr}`; the actual
      body content (FAQ answers, About values/history, Terms/Privacy clauses, Changelog entries,
      hero copy) had no EN/TR translation anywhere and had to be drafted fresh, not just rewired —
      added under `publicPages.{about,contact,faq,terms,privacy,changelog}` and `landing.hero/.nav`
      in all 3 locale files. **Terms of Service and Privacy Policy translations are AI-drafted and
      should get a legal/human review before being treated as binding**, same as the Russian
      originals presumably were. Verified in-browser (EN + TR, all 6 pages + homepage hero) with no
      console errors and no raw `publicPages.*` keys leaking. Also fixed a pre-existing bug found
      along the way: the header's login button (`landing.nav.login`) silently fell back to Russian
      on EN/TR because that key didn't exist outside the ru locale file.

### SEO / technical
- [x] **No per-page `<title>`/meta description/OpenGraph tags anywhere. No `sitemap.xml` or
      `robots.txt`.** Fixed 2026-08-03 — correction to the original note: a postbuild
      `scripts/prerender.mjs` already existed and *did* generate per-route static HTML with real
      meta tags for 11 routes, the auditor just missed it. Extended it to cover the 16 remaining
      public routes (`/solutions/*`, `/development`, `/scenarios`, `/api-integration`, all 6
      `/blog/:slug` posts) — 27 prerendered pages total now — fixed its stale `lumiva.agency` domain
      to the real `crm.lumiva.agency`, and made it idempotent (strips old tags before injecting) so
      it can't double up regardless of what `index.html` contains. Also added `sitemap.xml` and
      `robots.txt` (disallowing authenticated app routes, allowing marketing pages) to
      `frontend/public/`. Note: initially tried a `react-helmet-async` runtime approach layered on
      top of the existing static prerender — that produced duplicate/conflicting tags after
      hydration, so it was reverted in favor of just extending the working static mechanism.
- [x] **Favicon was still the default Vite logo.** Fixed 2026-08-03 — now uses the real
      `lumiva-default-logo.svg` in both `index.html` and the prerender script's output.

### Navigation / discoverability
- [x] **`/development`, `/scenarios`, `/api-integration` had zero inbound links anywhere.** Fixed
      2026-08-03 — added all 3 to the footer's "Продукт"/Product column.
- [x] **Footer's "Solutions" column only listed 3 of 6 (now 8) items.** Fixed 2026-08-03 — footer
      now lists all 8 (added Client Accounts, Products, Warehouse, and the new Booking/Hotels pages).
- [x] **No phone number in the persistent header/footer.** Fixed 2026-08-03 — footer now shows
      `hello@lumiva.agency` and `+7 499 653 78 83` on every page (the same real phone number already
      used in the homepage demo drawer, not a new one). **No physical address added** — there's no
      real address anywhere in the codebase to reuse, and I won't invent one.
- [ ] **No live chat widget on the marketing site.** Investigated 2026-08-03 — the backend side is
      real and complete (`public-online-chat.controller.ts`: session/message/history/poll endpoints,
      keyed by tenant `clientKey`), but **no visitor-facing widget UI exists anywhere in the frontend
      to embed** — only the CRM-side staff inbox (`OnlineChatPage.tsx`) exists. Building the widget
      itself (bubble + panel + polling) is real, scoped work I can do, but wiring it live on the
      marketing site needs **Lumiva's own `clientKey`** (the tenant representing the company's own
      sales/support account) to route real visitor messages somewhere staff actually monitor — I
      couldn't find one anywhere in the codebase/env, and using the `demo-client` seed tenant would
      silently send real visitor messages into a demo account nobody watches, which is worse than no
      widget. **Needs the user to confirm/create a real tenant for this before the widget gets wired
      up** — the component itself can be built anytime once that exists.

### Conversion mechanics (mostly fine, one inconsistency)
- [x] **Self-serve signup only really lived on the homepage; every other page's "Попробовать
      бесплатно" CTA routed to `/login` instead of straight to signup.** Fixed 2026-08-03 —
      `LandingAuthPanel` now reads `?mode=signup` from the URL and opens straight to the signup tab;
      every non-homepage "try free" CTA across `PublicPageLayout.tsx`, `FeaturesPage.tsx`, and
      `PricingPage.tsx` (5 links total) now points to `/?mode=signup` instead of `/login`. Left the
      header's actual "Вход"/Log in button pointing at `/login` — that one's correct as-is. Verified
      in-browser: clicking a pricing-plan CTA lands on the homepage with the Registration tab already
      active.
- [ ] Two different contact identities shown across the site (`hello@lumiva.agency` on
      `/contact` vs. `vlad@lumiva.agency` + a personal phone number in the homepage demo drawer) —
      **still open**, deliberately not touched. This replaces a real person's personal contact info
      with a company one across the site — a decision for the user to make, not something to change
      unilaterally. (Standardized on `hello@lumiva.agency` for the *new* header/footer phone-number
      fix above, but left the demo drawer's existing `vlad@lumiva.agency` + personal number alone.)

---

## CRM product

### Automations / proactivity
- [x] **No `PRODUCT_*` automation trigger events exist at all.** Fixed 2026-08-03 — added
      `PRODUCT_PRICE_CHANGED`, `PRODUCT_STATUS_CHANGED`, `PRODUCT_STOCK_LOW` to `TriggerEvent`
      (`automation.entity.ts`) and wired them into `products.service.ts`'s existing write paths
      (`updateProduct()`'s change-log block for the first two; the existing `notifyLowStock()`
      threshold-crossing check for the third — no new polling, fire-on-write like Booking/Hotels).
      Registered in the automation builder's trigger picker (new "Товары" group) with labels in all
      3 locales, so they're actually selectable, not just backend-only. `ProductsModule` now imports
      `AutomationsModule` directly (no `forwardRef` needed — confirmed `AutomationsModule` doesn't
      import `ProductsModule` back, so no real circularity like Bookings/Hotels have). **Not deployed
      to the live container** — `lumiva_crm_api` runs a prebuilt `dist/main.js` with no source bind
      mount, so this needs an image rebuild + redeploy to take effect; typechecked clean, not
      runtime-verified against the live DB.
- [x] **No stale-lead/stale-deal alerting anywhere.** Fixed 2026-08-03 — added `LEAD_STALE`/
      `SALE_STALE` trigger events plus `AutomationsService.runStaleEntityChecks()`, run once daily at
      08:00 UTC by a new cron in `scheduler.service.ts`. Unlike the fire-on-write triggers, staleness
      is inherently time-based (nothing gets written while a lead just sits idle), so this is a real
      scheduled scan — the first genuinely new cron in the automations subsystem since the
      report-email one. Threshold defaults to 14 days, configurable per-automation via
      `meta.staleDays` (reuses the existing jsonb `meta` column, no migration). Findings are batched
      into **one digest event per automation per day** (not one event per stale lead) — firing
      per-entity would let `triggerAutomation`'s own `cooldownSeconds` on the first match suppress
      every subsequent one, silently dropping most of the list. No UI yet to actually set
      `staleDays` from the automation builder (defaults to 14 for everyone) — worth a follow-up if
      tenants want it configurable. Same live-deploy caveat as the Products triggers above.

### Dashboard / analytics
- [x] **Home dashboard had zero widgets for Products, Bookings, or Hotels.** Fixed 2026-08-03 —
      added `ProductsAnalyticsWidget`/`BookingsAnalyticsWidget`/`HotelsAnalyticsWidget` in
      `frontend/src/dashboard/widgets/`, following the existing self-fetching `FunnelTodayWidget`
      pattern (own `useEffect` + API call, no changes to `DashboardPage`'s central data-fetch),
      reusing the already-shipped `fetchProductsAnalytics()`/`fetchBookingAnalyticsSummary()`/
      `fetchHotelAnalyticsSummary()` calls — no new backend work needed. Registered as hidden-by-
      default `DASHBOARD_EXTRA_WIDGET_IDS` (same opt-in pattern as `sales-analytics` etc.), with
      titles/labels in all 3 locales. Verified end-to-end in a real browser against the live demo
      tenant (`owner@demo.com`) — all three widgets render correct live KPI numbers matching the
      backend API responses exactly (e.g. Products: 17 active / 6 low+out-of-stock / €10,580.47
      catalog value), no console errors, and the "add widget" picker lists them correctly.
- [x] **No unified cross-module BI.** Fixed 2026-08-04 — new `BiDashboardModule`
      (`backend/src/bi-dashboard/`), a standalone read-only aggregation service, not a rework of the
      existing per-user `DashboardModule` home page. `BiDashboardService.getSummary(tenantId, days)`
      queries Lead/Sale/Product/Reservation/HotelReservation/Call/SmsMessage repos directly (same
      "fetch + aggregate in JS" pattern as `TelephonyService.getAnalytics`, not each module's own
      bespoke DTO-driven analytics service) and returns one `GET /bi-dashboard/summary?days=30|90`
      payload: Leads (count/won/lost/open pipeline/conversion %), Sales (revenue + avg deal, grouped
      by currency, `status: 'confirmed'` only), Products (active count, inventory value = price ×
      qty grouped by currency, low-stock count), Bookings (revenue from `status: 'completed'`
      reservations), Hotels (revenue from non-cancelled reservations, using the tenant's first
      hotel's currency — same simplification `HotelAnalyticsService` already uses), and Telephony
      (calls/SMS/pickup rate, zeroed out honestly if the add-on isn't enabled, same pattern as the
      SMS+telephony merge). No currency conversion is invented — amounts are grouped and shown
      per-currency (`123 EUR + 40 USD`) rather than faking an exchange rate, mirroring
      `ProductAnalyticsService`'s existing "no rate supplied → no conversion" convention.
      Frontend: new `/bi` page (`pages/analytics/BiDashboardPage.tsx`), added to the sidebar as
      "BI-дашборд" (ru) / "BI Dashboard" (en) / "BI Panosu" (tr) right under the home Dashboard link,
      gated by the existing `analytics` permission (same one `/sales/analytics` etc. already use —
      no RBAC changes needed). Reuses `telephony-design.css`'s `.px-scope` primitives
      (`.tel-hero`/`.tel-kpis`/`.ha-section`/multi-series `LineChart`/`.rev-bar-row`) rather than
      inventing new visual language, plus one small `bi-dashboard-design.css` for the KPI-grid and
      module-link-card wrappers. Each of the 6 KPI cards and the "detailed analytics" row link
      straight to that module's own existing analytics page for drill-down (Leads/Sales/Products/
      Bookings/Hotels/Telephony) — this is explicitly a summary + router, not a replacement for the
      per-module analytics pages. Typechecked clean on both backend and frontend (only the 4
      pre-existing unrelated errors remain: 2 `IntegrationsHubPage.tsx`, 2 `.spec.ts`). Not deployed
      — no new migration needed (read-only, no new entities/columns).
- [x] **No general cross-entity audit/activity log.** Fixed 2026-08-04 — new `AuditLogModule`
      (`backend/src/audit-log/`, table `audit_logs`, migration `1781400000000-AuditLogs.ts`):
      `tenantId, entityType, entityId, entityLabel, action ('create'|'update'|'delete'), summary,
      changes (jsonb field-diff array), actorUserId, actorName, createdAt`, with a best-effort
      `AuditLogService.log()` that swallows its own write failures (logs a warning) so an audit-log
      bug can never break the real mutation it's attached to. This is a separate, additive global
      feed — it does **not** replace the existing per-entity logs (`LeadActivity`, `ProjectActivity`,
      `ReservationActivity`, `ProductChangeLog`), which keep working as-is for their own "history"
      tabs. Wired into: Leads (via the single `LeadActivityService.add()` choke point — covers every
      lead status/assignee/comment event for free), Contacts (create/update/delete), Companies
      (create/update/delete), Sales (`update()` — Sales has no manual `create`, sales only arrive via
      WooCommerce/import sync, so update is the only real user-driven mutation), and Hotel
      reservations (create/update/remove). `GET /audit-log` (paginated, filterable by entityType/
      action/actorUserId/search/date range) is gated behind the existing `settings` permission
      (owner/developer only by default — same bucket as `StaffPermissionsPage`), not `analytics`,
      since a global "who changed what" feed is more sensitive than a read-only KPI dashboard.
      Frontend: new `/settings/audit-log` page (`pages/settings/AuditLogPage.tsx`), added under the
      sidebar's Settings section next to Deduplication, reusing `telephony-design.css` primitives.
      **Explicitly deferred, not silently skipped:** Projects (`ProjectActivity`), Bookings
      (`ReservationActivity`), and Products (`ProductChangeLog`) are not yet feeding into the unified
      table — each writes activity at multiple call sites rather than through one shared method like
      `LeadActivityService`, so wiring them in cleanly is a bigger, separate pass; Custom Objects and
      Marketing entities have no activity concept at all yet and are out of scope for this iteration.
      Typechecked clean on both backend and frontend (only the known pre-existing errors remain).
      Not deployed — needs `npm run migration:run` for the new `audit_logs` table before use.

### Structural gaps (bigger initiatives) — ✅ all done 2026-08-05 (Phase 3 batch)
- [x] **Helpdesk/ticketing.** New `HelpdeskModule` (`HelpdeskTicket` + `HelpdeskTicketMessage`,
      shape copied from whatsapp-crm's contact+message pattern). Staff two-pane inbox at
      `/helpdesk`. Customer side wired into the new self-service portal (item below) — a portal
      contact can open/reply to tickets with no separate auth. New tickets/replies notify staff via
      the existing in-app notifications. New `helpdesk` RBAC key.
- [x] **E-signature — own PDF + email confirmation**, deliberately not an external provider
      (DocuSign etc. — explicit user choice). Staff writes a plain-text template with
      `{{contact.name}}`/`{{tenant.name}}`/`{{date}}` placeholders; `pdfkit` renders a draft PDF
      (same pattern as the existing price-list PDF export); sending emails a magic-link-style
      token to the contact; the public signing page captures a checkbox + typed name + IP +
      timestamp as consent evidence, baked into a final signed PDF with a visible signature block.
      Verified by reading the actual generated PDF bytes, not just the API response.
- [x] **General team calendar.** New `CalendarModule` aggregates Lead meetings (from
      `Lead.meta.meetings[]`), Project task deadlines (from `Project.tasks[]`), Bookings
      (`Reservation`), and Hotel reservations into one `/calendar` view with type filters.
- [x] **Tenant-wide export/backup.** `GET /export/backup` → single JSON with all core entities
      (leads/contacts/companies/sales/products/bookings/hotel reservations/projects/staff).
      Button in Settings → Экспорт и бэкап.
- [x] **In-app customer/partner self-service portal.** New `PortalModule`: email magic-link login
      (no password) scoped to a `Contact`, `/portal/:clientKey/{login,verify,dashboard,tickets}`.
      Shows the contact's own Bookings + Sales (both have a real `contactId` FK) and now Helpdesk
      tickets. **Known gap**: Hotel reservations aren't in the portal — `HotelReservation` has no
      `contactId` FK at all, a pre-existing deliberate design choice (guest is free-text
      name/email/phone), not something this pass changed.
- [x] **RBAC normalized** — full write-up in `lumiva_bi_dashboard_redesign`-adjacent session memory
      (`lumiva_rbac_granularity_normalization`). Reality was worse than this bullet implied: Leads/
      Sales/Projects had **zero** RBAC enforcement at all (hardcoded role arrays), and Contacts/
      Companies were silently neutralized by a `RbacGuard` bug that always returned `true`. Both
      fixed; added granular keys (`leads_view_roi`, `projects_manage_trash`, `sales_manage_import`,
      `contacts_manage_bulk`, `companies_manage_tasks`) matching the Products/Bookings/Hotels
      pattern. Verified live with throwaway `viewer`/`developer` test accounts before and after.
- [x] **Onboarding wizard + sample data.** New `/onboarding` 4-step wizard (welcome → invite team →
      load example data or skip → done) for genuinely new signups only — existing tenants backfilled
      as already-onboarded via migration so nobody sees it retroactively. Sample-data seeder is
      idempotent and fully reversible (tracked via a join table, not an `isSample` flag scattered
      across entities).
- [x] **Public developer API + docs.** Found and fixed a real security gap: `ApiTokenGuard` never
      checked `isActive`/`expiresAt` — a revoked or expired token kept working forever (confirmed
      live pre/post-fix). Built the missing token-management UI at `/settings/api-tokens` (backend
      CRUD already existed, nothing in the frontend called it except one narrow single-purpose
      "Bookings connector" flow, left untouched). New public docs page at `/api-integration/docs`
      documents only the endpoints that actually exist and are already token-reachable today
      (inbound-lead, products read/ingest/stock, bookings ingest, custom-object ingest) — no
      invented endpoints or response shapes. Swagger (`/v1/docs`) left as-is: already sensibly
      gated behind `SWAGGER_ENABLED`, but no controller has `@ApiTags`/DTO decorators, so it's not
      the real source of truth yet — the hand-written docs page is.

Full detail, verification steps, and every bug found along the way: session memory
`lumiva_growth_roadmap_phase3_batch` and `lumiva_rbac_granularity_normalization`.

### Omnichannel messaging / telephony / campaign automation
_Added 2026-08-04. A first pass wrongly assumed WhatsApp/Telegram integrations didn't exist at all —_
_they do, in varying states of completeness — so this section is grounded in a full audit rather than_
_guesswork. See "Where each finding came from" below for scope._

- [x] **WhatsApp had no CRM inbox UI — inbound messages only ever became a Lead note.** Fixed
      2026-08-04 — added a new `whatsapp-crm` module (`WhatsappContact`/`WhatsappMessage` entities,
      migration `1780900000000-WhatsappCrmInbox`, mirrors `telegram-crm`'s shape) plus
      `WhatsappInboxPage.tsx` (`/whatsapp/inbox`, nav entry under Инструменты → WhatsApp · Диалоги,
      all 3 locales). `whatsapp-webhook.service.ts::handleInbound` now delegates persistence to
      `WhatsappCrmService.recordInboundMessage` instead of only writing a Note — the Note still gets
      created too (nothing downstream that reads it breaks), plus a real message row, contact/lead
      resolution, and now a webhook-retry idempotency check on `waMessageId` that didn't exist before
      (Meta redelivers on timeout; the old Note-only path had no dedup and could have been writing
      duplicate notes on retries — not confirmed it ever did, but the gap was real). Backend:
      `GET /whatsapp-crm/{connections,contacts,messages}`, `POST /whatsapp-crm/{send,contacts/:id/
      read}`. Reply reuses the existing `WhatsappCloudService`/`IntegrationConnection` credentials —
      no new secrets needed, same `IntegrationConnection` row a tenant already fills in today.
      Registered `whatsapp` as a proper RBAC permission key + plan-gated component (mirrors
      `telegram`'s treatment exactly: `professional` plan minimum, default-allow in the RBAC guard's
      new-module list) — previously WhatsApp had no permission key at all. **Typechecked clean, not
      deployed** — same migration + rebuild + redeploy caveat as everything else in this phase.
- [x] **Telegram had no CRM inbox UI despite the backend having everything needed.** Fixed
      2026-08-04 — added `TelegramInboxPage.tsx` (`/telegram/inbox`, nav entry under Инструменты →
      Telegram · Диалоги, all 3 locales) — two-pane inbox (contact list w/ unread badges + search,
      thread view, reply box), same layout pattern as `OnlineChatPage.tsx`. Backend additions: `GET
      /telegram-crm/contacts` (conversation list with last-message preview + unread count, built with
      `distinctOn` + a grouped unread-count query) and `POST /telegram-crm/contacts/:id/read`.
      Discovered and fixed a real gap while building this: neither `TelegramContact` nor
      `TelegramMessage` tracked *which bot* a conversation belonged to, so a tenant with >1 bot had no
      reliable way to know which bot token to reply through — added a nullable `botId` column to both
      (migration `1780800000000-TelegramContactMessageBotId`), stamped on every new inbound/outbound
      write, contact's `botId` kept fresh to whichever bot most recently touched it. Attachments
      (photo/voice/document/etc.) show a typed label in the thread rather than rendering inline —
      Telegram's `file_id`s aren't public URLs, so displaying them needs a getFile-and-proxy endpoint,
      deliberately out of scope for this pass. **Typechecked clean (backend + frontend), not
      deployed** — same caveat as the Products triggers/stale-lead cron from Phase 2:
      `lumiva_crm_api` runs a prebuilt `dist/main.js` with no source bind mount, so this needs a
      migration run + image rebuild + redeploy to go live, not done without a separate go-ahead.
- [x] **SMS was outbound-only — no inbound webhook despite the data model already expecting one.**
      Fixed 2026-08-04, Twilio only (SMSC.ru/SMS.ru don't have a documented inbound-webhook mechanism
      to match) — turned out to need less new plumbing than WhatsApp/Telegram: `SmsMessage` already
      had `direction: 'inbound'` and `fromPhone`/`toPhone` columns, and `SmsPage.tsx` was **already
      rendering inbound rows correctly** (`↓ Вх.` badge, `msg.fromPhone`) — built ahead of the
      backend that never arrived. Added `POST /webhooks/sms/twilio/:tenantId`
      (`sms-webhook.controller.ts`, public) + `SmsService.recordInboundTwilio`: resolves/creates a
      Lead by phone (same pattern as the other channels), inserts the message row, syncs a Lead note
      for timeline consistency with Telegram/WhatsApp, and skips duplicates on `MessageSid` (Twilio
      retries on timeout). Verifies `X-Twilio-Signature` against the tenant's own stored Auth Token
      (HMAC-SHA1 per Twilio's documented algorithm) before touching anything — the WhatsApp/Telegram
      webhooks don't validate inbound authenticity at all, so this is stricter than existing
      precedent, not weaker. `GET /sms/config` now returns `inboundWebhookUrl` (built from
      `PUBLIC_API_URL`, same env var convention as the WhatsApp/CF7 webhook hints elsewhere) and
      `SmsSettingsPage.tsx` shows it with setup instructions when Twilio is configured. No automation
      trigger event added (e.g. `SMS_RECEIVED`) — kept scope to the webhook itself, matching how the
      WhatsApp inbox pass above also didn't add new triggers. **Typechecked clean, not deployed** —
      same caveat as the rest of this phase.
- [x] **No real marketing-campaign/cadence tool.** Fixed 2026-08-04 — added a new
      `marketing-broadcasts` module: `MarketingBroadcast`/`MarketingBroadcastRecipient` entities
      (migration `1781000000000-MarketingBroadcasts`), a linear multi-step drip sender (each step has
      a `delayDays` relative to the previous one — not conditional/branching, that's deliberately left
      to the BPM item below so the two don't overlap), and a `@Cron('*/2 * * * *')` scheduler
      (`MarketingBroadcastsSchedulerService`) that activates due `scheduled` broadcasts and advances
      `running` ones. **Deliberately named "Broadcast" not "Campaign"** — `CampaignsPage.tsx` already
      means ad-spend/ROAS analytics in this codebase, reusing the word for a send tool would create
      two different things called "Campaign" in the same nav. Audience targeting reuses the *existing*
      `MarketingService.runSegment` (segment picker, same segments the Segments page already builds)
      instead of re-implementing lead-filter logic a third time — avoids the "duplicated source of
      truth" bug pattern flagged elsewhere. Sending reuses `EmailService.sendEmail` and
      `SmsService.sendFromAutomation` directly — no new send path, so per-tenant email/SMS config
      (accounts, Twilio/SMSC/SMS.ru credentials) work unchanged. Each cron tick batches at most 200
      due recipients per broadcast, a basic throttle rather than blasting an entire audience in one
      transaction. Frontend: `BroadcastsPage.tsx` (list, cancel, delete) + `BroadcastFormPage.tsx`
      (audience/steps/schedule builder), `/marketing/broadcasts`, nav entry "Рассылки" next to the
      existing (unrelated) "Кампании (ROAS)" item, fully localized (ru/en/tr) — matching the
      *majority* convention among marketing pages (`SegmentsPage.tsx`, `CampaignsPage.tsx` etc. are
      all i18n'd; `SmsSettingsPage.tsx` is a pre-existing hardcoded-Russian exception, left as-is).
      **Typechecked clean, not deployed** — same caveat as the rest of this phase.
- [x] **Automations were strict flat IF/THEN — no per-step branching, delay, or approval gate.**
      Fixed 2026-08-04. Found a real "dead frontend" bug while scoping this: `AutomationFormPage.tsx`
      already had a full per-action condition editor (`selAction.config._conditions`, its own
      params/conditions/logs tabs) that the backend's `executeAction` loop never read at all — the UI
      promised per-step branching that silently did nothing. Wired it up instead of building a new
      one: `runActionsFrom` (the refactored execution loop) now skips a step if its `config._conditions`
      don't pass against the running context. Added two genuinely new step-level flags in the same
      `config._underscoreKey` convention — `_delayMinutes` (wait N minutes after the previous step)
      and `_requireApproval` (stop and wait for a staff decision) — plus a new "Задержка/подтверждение"
      tab in the action panel to set them, and a `/automations/pending-approvals` page (approve/reject,
      nav entry next to Automations) to act on the latter. **Real delay, not a blocking sleep**: a
      paused execution saves `AutomationExecution.status='paused_delay'|'paused_approval'` +
      `pausedAtStep`/`ctxSnapshot` (migration `1781100000000-AutomationExecutionPauseResume`) and a new
      `@Cron('* * * * *')` (`resumeDueExecutions`) picks delay-pauses back up when due; approval-pauses
      resume via `POST /automations/executions/:id/approve|reject`. **Backward compatible by
      construction**: every automation that doesn't set `_conditions`/`_delayMinutes`/`_requireApproval`
      on any step takes the exact same code path as before (same loop, same result shape, same
      `automation.lastError`/`executionCount` bookkeeping) — verified by re-reading the refactored
      `runActionsFrom` against the original loop line-by-line, not just by testing the new-feature
      case, since this touches execution for every existing automation on every tenant. **Known real
      limitation, not fixed here**: the paused context is a static snapshot taken at pause time, not
      re-fetched from the DB on resume — a "wait 3 days, then check if the lead is still 'new'"
      pattern will check the day-0 snapshot, not the lead's state 3 days later. Fixing that generically
      needs per-trigger-type re-fetch logic (Lead vs Sale vs Contact vs Booking...) that's a separate,
      larger piece of work. Also fixed a smaller pre-existing bug found in the process: `runNow` judged
      success/failure from the automation's *stale* `lastError` field instead of the actual execution
      result, which would have silently misreported "success" for a run that only *paused* (never
      actually completed) once this feature existed — now reads `execution.status` directly.
      **Typechecked clean, not deployed** — same caveat as the rest of this phase, but this one in
      particular should get a careful staging pass before going live given the blast radius (every
      tenant's existing automations run through this same refactored loop).
- [x] **Built the real IP-telephony feature the marketing site was already advertising.** Fixed
      2026-08-04, resolving the 🔴-critical false-advertising item from earlier in this doc. Provider:
      **Twilio Voice** (user's choice — Twilio was already integrated for SMS, same credentials
      reusable). Transcription: **Whisper via the existing `AiOpenAiService`** (user's choice, same
      path Telegram voice-message transcription already uses) — inherits that service's current
      `insufficient_quota` outage (🔴 Critical section), so transcription will silently fail (marked
      `transcriptStatus: 'failed'`, calls still work) until the OpenAI billing issue is resolved.
      **Architecture**: no browser WebRTC/softphone — outbound click-to-call is "call me, then connect
      me" (Twilio rings the staff member's own phone first via `TelephonyService.initiateCall`; once
      answered, `connectLegTwiml` bridges to the real destination and starts recording), avoiding an
      in-browser audio-permissions/softphone UI that would have been its own multi-day project.
      New `telephony` module: `TelephonyConfig`/`Call` entities (migration
      `1781200000000-TelephonyAddon`), recording via Twilio's `record-from-answer`, transcription
      triggered from the `recordingStatusCallback` webhook (downloads the Twilio recording, same
      Whisper call Telegram voice messages use), full-text dialog search + tags, per-tenant stats
      (call count / avg duration / pickup rate — computed for real from `calls`, not the fabricated
      "4,240 calls · 68% PICK" demo numbers on the marketing page), and a daily cron
      (`TelephonySchedulerService`) that actually deletes call rows + Twilio recordings older than 3
      years, enforcing the advertised retention rather than just stating it. Recordings are proxied
      through our own API (`GET /telephony/calls/:id/recording`, Twilio-authenticated server-side) —
      the browser never sees Twilio credentials. Extracted the Twilio webhook-signature check (added
      for SMS earlier in this phase) into a shared `common/twilio-signature.util.ts` used by both.
      **Billing gate is real, not just a settings toggle**: added `Tenant.telephonyAddonEnabled`
      (boolean, default false) — deliberately *not* wired through the existing `COMPONENT_KEYS`/
      `plan-entitlements.ts` mechanism used for Telegram/WhatsApp/chat, because that mechanism treats
      "not configured" as "allowed by plan tier," which would have made telephony free-by-default for
      whichever plan tier it was assigned to — wrong for a flat paid add-on sold on top of every tier.
      Extended the existing `POST /billing/checkout-ai-addon` Stripe Checkout flow (already used for
      AI-credit/storage add-ons) with a third `telephony_addon` kind — `mode: 'subscription'`
      (recurring, unlike the other two one-time add-ons), €14/mo, falls back to inline Stripe
      `price_data` if the platform admin hasn't created a real `stripePriceTelephonyAddon` Price object
      yet (same graceful-degradation pattern the other two add-ons already use). The webhook
      (`checkout.session.completed` → `applyAddonSession`) flips `telephonyAddonEnabled` to `true` on
      successful payment. **Known gap, consistent with the rest of this billing subsystem**: no
      Stripe subscription-cancellation webhook handling exists anywhere in `billing.service.ts` today
      (not for the main plan, not for the other two add-ons either) — cancelling the Stripe
      subscription won't auto-disable the CRM-side flag. Not a regression I introduced, but worth
      flagging: this whole billing module has no cancellation-lifecycle handling yet. A `GET
      /telephony/status` endpoint (deliberately outside the paywall) lets the frontend show a real
      "€14/mo — activate" upsell instead of erroring for tenants who haven't bought it, at
      `/telephony` and `/telephony/settings`, nav entry next to SMS. **Typechecked clean, not
      deployed** — same caveat as the rest of this phase, plus this one needs a platform admin to
      actually configure `stripePriceTelephonyAddon` (or accept the inline fallback price) and a
      tenant to configure real Twilio Voice credentials before any of it does anything live.
      **Update 2026-08-04, same day**: first deploy attempt hit the live Stripe account not having
      a business name set ("In order to use Checkout, you must set an account or business name"),
      blocking the upsell entirely. Per the user's request, added `isTelephonyIncludedInPlan()`
      (`tenants/plan-entitlements.ts`) — Ultimate-plan tenants get telephony free, no Stripe checkout
      involved at all. Checked in `TelephonyAddonGuard`, `TelephonyService.assertAddonEnabled`, and
      `GET /telephony/status` (now also returns `includedInPlan`, which the settings page uses to
      show "included in your Ultimate plan" instead of the paywall). Deliberately kept out of
      `COMPONENT_KEYS`/`COMPONENT_MIN_PLAN` for the same reason as before — this is "free at exactly
      one tier, paid at every other," not the "included starting at tier X" shape that mechanism
      expects.
      **Also found and fixed two real bugs surfaced by the actual deploy** (both now fixed in source,
      not yet in the redeployed image as of this note): (1) `SmsService`/`WhatsappCrmService` injected
      `LeadsService`/`NotesService` as plain constructor params instead of
      `@Inject(forwardRef(() => X))` — `TelegramCrmService` already had this right, I didn't copy the
      pattern precisely when writing the other two, and it crashed the app on boot with
      `UndefinedDependencyException` (non-deterministically — it depends on module instantiation
      order in the `LeadsModule ↔ AutomationsModule ↔ SmsModule` cycle, so it may not reproduce on
      every restart, but it can). (2) Migrations were never run against the live DB after the image
      rebuild — every JWT-authenticated request started failing with `column
      Tenant.telephonyAddonEnabled does not exist` because `JwtStrategy` loads the Tenant on every
      request. Ran all 5 pending migrations directly against the live container
      (`docker exec lumiva_crm_api npm run migration:run`) to stop the active outage; the DI fix
      still needs a rebuild + redeploy to actually take effect.
- [x] **Integration hub connectors audited 2026-08-04 — no dead stubs found.** Slack, MS Teams,
      Zapier, Make, amoCRM, Bitrix, HubSpot, Mailchimp, Google/Outlook Calendar, Google/Meta Ads, 1С,
      SAP, Jira, WooCommerce, Shopify — every entry in `integration-hub-catalog.ts` has a real service
      behind it making real API calls (verified in `third-party-link.adapter.ts` plus each
      integration's own module). `live`/`beta` lifecycle labels are honest, not aspirational. Nothing
      to fix here — noted so this doesn't get re-flagged as a gap in a future audit.
- [ ] Mobile app has zero coverage of any of the above (WhatsApp/Telegram/SMS/real campaigns) — only
      a `CampaignsScreen.tsx` mirroring the ads-analytics page, and an unrelated internal staff-chat
      module (`screens/chat/*` → `api/chat.ts`).

---

## Mobile app (`/root/mobile`)

- [ ] **Products, Bookings, Hotels: completely absent** — zero mentions anywhere in the mobile
      codebase, no partial scaffolding.
- [ ] **"Automations" screen is 100% fake** — hardcoded local mock data, toggle only changes local
      component state, no backend calls at all (`api/automations.ts` doesn't even exist on mobile).
      Actively misleading if demoed as a real feature.
- [ ] **Push notifications: dependency installed, nothing implemented** — no permission request
      flow, no token registration, no backend endpoint wired.
- [ ] Several screens exist on disk but are never wired into navigation (standalone Companies/
      Contacts/Sales/Chat/Settings stacks, plus an abandoned "dynamic drawer menu" feature reading
      pl1 component entitlements) — finish and wire them in, or delete to cut confusion.
- [ ] Most modules besides Leads/Departments/Email-templates are **read-only on mobile** even
      though the backend supports full CRUD — e.g. the "+" add button on the Clients tab has no
      `onPress` handler at all.
- [ ] No AI Assistant chat on mobile (only the separate visitor-facing live-chat widget).
- [ ] Not published to any app store yet — bundle IDs and an EAS project exist, but no submit
      config/store credentials are in the repo.

---

## pl1 (platform admin panel)

Mostly healthy after this session's security/logout/entitlements fixes. Remaining known gap:

- [ ] **`BillingMonitorPage` is a Stripe-config health checker, not a real revenue/ops dashboard** —
      it shows whether Stripe keys/price IDs are configured, not actual MRR, subscription status
      per tenant, or failed payments. If real billing-ops visibility across the growing tenant base
      is needed, this would have to be built separately (or the founder checks each tenant's own
      `/app/billing` one at a time today, which doesn't scale).
- `GlobalLogsPage` and `ApiStatusPage` are confirmed solid, real, already-functioning tools — no
  further work needed there.

---

## Suggested phasing

**Phase 1 — cheap, high-impact, do first: ✅ done 2026-08-03.**
ContactPage endpoint fix → blog link fix → wire up the already-written EN/TR translations →
reconcile pricing FAQ plan names → per-page meta tags + sitemap/robots + real favicon → Products/
Bookings/Hotels dashboard widgets (same pattern as existing Leads/Sales/Projects widgets).
Only the OpenAI quota item (🔴 critical section) remains open — needs the user's billing action.

**Phase 2 — bigger but well-scoped: ✅ done 2026-08-03, except social proof.**
Booking + Hotels marketing solution pages → `PRODUCT_*` automation triggers → stale-lead/stale-deal
alerting → Security/Trust page. **Real social proof (testimonials/logos) intentionally skipped —
needs actual customer quotes/logos from the user, not something to fabricate.** Also surfaced a new
🔴-severity finding along the way: `FeaturesPage.tsx` has fake SOC 2/ISO 27001/152-ФЗ certification
claims (confirmed fabricated by the user) — see the 🔴 Critical section, needs a decision. Both new
backend features (Products triggers, stale-lead cron) are code-complete and typechecked but **not
deployed** — `lumiva_crm_api` runs a prebuilt image with no source bind mount, so activating them
needs a rebuild + redeploy, which wasn't done without the user's separate go-ahead.

**Everything else in "Public marketing site" (unphased items): ✅ done 2026-08-03**, at the user's
request to "do the rest" after explicitly deprioritizing the fake-certs decision and the OpenAI quota
top-up. Covered: Products/Inventory rename+redirect, Workspace/AI Assistant/AI Employees added to
`FeaturesPage.tsx`'s taxonomy, orphan-page nav links, footer Solutions column completed, signup CTA
routing fixed sitewide, real phone number surfaced in the footer, and a competitor-agnostic `/compare`
page (declined to name HubSpot/amoCRM/Bitrix24/Pipedrive specifically — same fabrication-risk class as
the fake certs, confirmed with the user before proceeding). **Still open, deliberately**: real social
proof (needs the user's actual customer input), careers/partner/status pages (all need real business
inputs I don't have), the live-chat-widget (backend's real and complete, but needs the user to confirm
which tenant `clientKey` represents Lumiva's own account before wiring a visitor-facing widget to it),
two-contact-identity cleanup (touches a real person's personal info, not mine to decide unilaterally),
and the Changelog security-disclosure trim (a judgment call, not a bug).

**Phase 3 — larger initiatives: ✅ done 2026-08-05, 9 items, same session** (unified BI dashboard was
done earlier the same day as its own pass — see that entry above — the other 9: onboarding wizard,
team calendar, tenant export/backup, pl1 real revenue dashboard, RBAC normalization, self-service
portal, helpdesk, e-signature, public API+docs). Mobile app (automations/push/Products-Bookings-
Hotels screens) explicitly deferred at the user's request — not started. See "Structural gaps" above
for what's real per item, and session memory `lumiva_growth_roadmap_phase3_batch` for full detail.

**Phase 4 — omnichannel/BPM/telephony: ✅ done 2026-08-04, all six items, same session.**
Telegram inbox UI → WhatsApp conversation-thread entity + CRM inbox/reply UI → SMS inbound webhook
(Twilio) → real scheduled/multi-step email-SMS broadcast builder → branching/delay/approval steps in
the automation engine → real IP-telephony feature (Twilio Voice + Whisper transcription, real €14/mo
Stripe add-on gate, real 3-year retention cron). See each item's own entry above for what's real vs.
what still needs external setup (Twilio/Meta/OpenAI credentials, a configured Stripe Price) before it
does anything live. **Nothing in this phase is deployed** — every backend change is typechecked but
sitting on top of a prebuilt `dist/main.js` container with no source bind mount, same as Phase 2's
Products triggers; all of it needs a migration run + image rebuild + redeploy, and the automations
engine change specifically deserves a staging pass first given its blast radius (see its own entry).

---

## Where each finding came from

- Public site audit: full read of all 21 `frontend/src/pages/public/*` files, `LandingPage.tsx`,
  header/footer components, router, and all 3 locale JSON files.
- CRM product audit: full scan of `backend/src/*` (48 modules) and `frontend/src/pages/*` (32
  areas), cross-checked against recent git history so already-shipped work (Booking/Hotels
  automation triggers, AI chat tool coverage) wasn't re-flagged as missing.
- Omnichannel/telephony/BPM audit (2026-08-04): full read of `integrations/whatsapp/*`,
  `telegram-crm/*` + `telegram/*`, `sms/*`, `integrations/catalog/integration-hub-catalog.ts` cross-
  checked against every connector's real service file (`third-party-link.adapter.ts` and per-
  integration modules), `marketing/*` + `EmailBulkSendModal.tsx`, `automations/automation.entity.ts` +
  `automations.service.ts`'s execution loop, a full-backend grep for telephony/SIP/IVR/PBX terms, and
  `mobile/src` for any of the above. Done specifically to correct an initial wrong assumption (see the
  new section above) rather than repeat it.
- Mobile + pl1 audit: full read of `mobile/src/navigation/AppNavigator.tsx`, every screen directory,
  `mobile/src/api/*.ts`, `app.config.js`/`eas.json`, and the four previously-unaudited pl1 pages
  (DemoRequests, BillingMonitor, GlobalLogs, ApiStatus).

Related memory: [[lumiva_pl1_platform_admin]] (auth/logout/entitlements fixes shipped 2026-07-27),
[[lumiva_ai_assistant_products_bookings_hotels]] (AI tool coverage + the OpenAI quota outage).
