# Mobile design/functionality audit — 2026-09-11

Continuation of the ongoing liquid-glass design import into `/root/mobile`. This round
was triggered by direct user feedback (screenshots) rather than a scheduled sweep.

## Round 2: liquid-glass fidelity vs styles/mobile-glass.css + components/mglass-core.jsx

User reported the bottom tab bar rendering as a plain white pill with a black outline — "нет
ничего от жидкого стекла" — then asked for a token-by-token check against the actual Claude
Design project (`3affa7c1-b28d-4e49-b8bb-c7af7123c758`, `mobile-app-screens.html` +
`components/mglass-*.jsx`), read live via `DesignSync`.

**Root cause of the white/black-outline look**: two Android-only RN bugs, both real, both fixed
in `GlassCard.tsx` (and everywhere that duplicated its logic):
1. `expo-blur`'s `BlurView` does not actually blur on Android without
   `experimentalBlurMethod="dimezisBlurView"` — without it the "blur" layer is a no-op, so all
   that showed was the flat overlay tint.
2. RN's `elevation` always draws a flat, unthemeable dark shadow ring on Android (can't be
   tinted via `shadowColor`) — on a translucent glass surface that reads as a harsh black
   outline instead of the design's soft `0 10px 30px rgba(16,24,40,.10)` lift. Fixed with
   `Platform.select` — real `shadow*` on iOS, `elevation: 2` (or none) on Android.

**Deeper fidelity gap found on the "check against the design system" pass**: `.g`/`.g2` in the
CSS are `background: linear-gradient(180deg, <lighter-top>, <more-transparent-bottom>)` — a
glass "sheen" — but the RN port had flattened this to a single flat `colors.cardElevated`/
`colors.card` overlay with no gradient at all. `expo-linear-gradient` was already a dependency
but literally unused anywhere in the app. Added exact-value gradient-stop tokens to
`ThemeContext.tsx` (`glassGradient`, `glass2Gradient`, copied verbatim from `--glass`/`--glass-2`
in both themes) and render them via `<LinearGradient>` in `GlassCard`. Also added the CSS's
`inset 0 1px 0 var(--glass-hl)` top highlight (RN has no inset shadow — approximated with a 1px
tinted `View` at the top, `.g` only, `.g2` doesn't have it in the CSS either).

Also fixed while doing the token-by-token comparison:
- `.g-flat`'s border is `var(--line)`, not `var(--glass-b)` — the RN `flat` variant was
  (wrongly) using `glassBorder` (the near-white border meant only for blurred `.g`/`.g2`) for
  its background chip's border. Added an exact `glassLine` token and fixed both `GlassCard`'s
  `flat` variant and `Segmented`'s track border.
- `--sh` (the `.g` shadow) was `rgba(16,24,40,.12)`/`rgba(0,0,0,.55)` in the theme vs the CSS's
  exact `.10`/`.5` — corrected to match.
- The tab bar (`GlobalTabBar.tsx`) and bottom sheet (`AppBottomSheet.tsx`) each hand-rolled their
  own `BlurView` + flat-overlay implementation instead of using `GlassCard` — meaning they'd
  drift from any future `.g` fix (as just happened) and already differed subtly (different blur
  `intensity` numbers for what the design treats as the identical `.g` class on
  `<nav className="mg-tabs g">` / `<div className="mg-sheet g">`). Rewrote both to literally
  render `<GlassCard variant="g">`, so the glass system now has exactly one implementation.
  `AppBottomSheet`'s radius corrected 16→28 to match `.mg-sheet{border-radius:28px}` (which wins
  over `.g`'s 22px later in the same stylesheet cascade).
- `Segmented`'s active pill (`.mg-seg button.on`) is also `background:var(--glass)` with an inset
  highlight — was a flat `cardElevated` swap. Added the same gradient + highlight treatment,
  deliberately skipping the CSS's `backdrop-filter:blur(10px)` (nothing behind it worth blurring —
  the track itself is a flat `--fill` color) and its box-shadow (same Android elevation-halo risk
  as everywhere else).
- Two spots (`GlobalTabBar` inactive icon color, `AppBottomSheet` grip color) were reading
  `colors.fg3` — a **different**, older token system (`fg2/fg3/fg4/line2/line3`, mirrors the
  *desktop site's* own `--fg-*` vars, unrelated to mglass) — where the design calls for
  `--ink3`/`textTertiary`. Both currently evaluate to ~the same opacity so this was a
  zero-visual-diff correctness fix, not a visible change; left `textTertiary`'s own value
  (`0.4`) un-"corrected" to the CSS's `--ink3` (`.58`, oddly close to `--ink2`'s `.62`) since
  that field is used for de-emphasized text/icons on ~90 screens app-wide and darkening it
  everywhere on an unverified guess (this box can't render RN screens) felt like the wrong risk
  trade — flagging for a future round with device access to confirm before touching it.

**Verification**: `tsc --noEmit` and `expo export --platform android` both clean after every
step. No device/emulator available in this environment — all of the above is verified by exact
token comparison against the fetched CSS/JSX, not by eye. Next real confirmation needs the
dev-client APK on an actual phone (see `MOBILE_APP_PLAN.md` §1 for the standing dev-client
build).

**Chat images/Telegram send** (same round, different complaint): see the two prior memory
entries this session — real gap was Telegram attachments (`file_id`s stored, no way to fetch the
bytes — added `GET /telegram-crm/messages/:id/attachment` server-side proxy + inline photo
bubbles/tap-to-open other types in `DialogThreadScreen.tsx`); Telegram *sending* was verified
working end-to-end against the live tenant DB (real Telegram `message_id` returned) — could not
reproduce a send failure, improved error-surfacing instead of guessing at a fix.

## Round 3: full walkthrough against the mglass-*.jsx mockups (user-requested)

User asked for a systematic pass comparing real screens against the design mockups, not just
the glass tokens. Read `mglass-home.jsx`, `mglass-kit.jsx`, `mglass-sheets.jsx`, `mglass-more.jsx`
in full; spot-checked structure of the rest via the plan doc's own "не сделано"/"stragglers"
notes rather than re-deriving everything from zero (~30 design files is too much for one pass to
cover exhaustively at screen-pixel level without a device).

**Built**: `HomeScreen.tsx` was missing the design's header "+" quick-create button entirely
(`<button className="mg-ib solid" onClick={() => openSheet('create')}>` in `mglass-home.jsx`).
Added a real bottom sheet (Лид/Проект/Компания/Контакт — matches the design's own `CreateSheet`
in `mglass-sheets.jsx`, which explicitly excludes Задача/Заметка since those need a parent entity
the home screen doesn't have, and Продажи/Брони since the design's own copy says those "создаются
из своих разделов") wired to the four create screens that already exist.

**Design-system straggler swept: `StatusPill` → `Pill` everywhere (28 files, 44 call sites).**
This was flagged in the plan doc as "a handful of screens" — actually turned out to be the
majority of detail/list screens. `StatusPill` (`components/ui`) is a leftover from the
pre-liquid-glass "Swiss minimal" language (uppercase, JetBrains Mono, 10px, always-dot) and does
not match `.mg-pill` in `styles/mobile-glass.css` at all (sentence case, `Inter` medium, 11px, dot
optional). `Pill` (`components/mg`) is the correct, exact port. Migrated every call site: Leads
(list/detail/calendar), Projects (list/detail/task-board), Sales (detail/payments), Companies
(detail/co-tasks), Contacts (detail), Staff (list/detail), Bookings (detail/calendar), Hotels
(list/detail/reservations-list/reservation-detail), Marketing (segment-detail/email-templates),
Products (detail), Esign (list/detail), Helpdesk (list/detail), AI agents (list/detail),
Automations (detail). Each file's local `*_TONE` lookup map was re-keyed from the old vocabulary
(`success/warning/error/info/neutral`) to `Pill`'s (`pos/warn/neg/acc/default`) — same underlying
color tokens, just renamed, so this is a **zero visual-behavior-change refactor** for every
mapped status, not a re-design of any status's actual color. `StatusPill.tsx` and its `StatusTone`
export were then dead code with zero remaining references — deleted rather than left as an
unused backwards-compat shim. `tsc --noEmit` and `expo export` clean throughout, after every
batch, not just at the end.

**Confirmed already solid** (no changes needed): `MoreScreen.tsx`'s 13 nav groups match
`mglass-more.jsx`'s `NAV` array exactly, group-for-group; the theme-toggle/CurrencyChip/ThemeChip
fixes from Round 1 already covered its header. `HomeScreen.tsx`'s widget set (hero sales card,
Pulse KPIs, funnel, tasks, activity stream, sources, recent sales) already matches
`mglass-home.jsx` structurally — differences are legitimate (real backend data vs the mockup's
fixtures), not gaps.

**Deliberately not built this round** (flagging, not fixing — each is a real feature, not a
cosmetic fix, and none was reported broken by the user):
- Home screen widget drag-to-reorder (`mglass-home.jsx`'s edit-mode + `useDnD`) — a genuine
  feature build, not a design-token fix.
- Global omnisearch sheet (`mglass-sheets.jsx`'s `SearchSheet`, searches leads/projects/companies
  at once) — `HomeScreen`'s search bar currently just navigates to Leads. Real gap, sizeable
  build (three parallel API calls + grouped results UI).
- `ProfileCompletion` widget (design shows a fabricated-looking "profile completion %" card) —
  didn't check whether the backend has a real concept of this; don't add without checking first,
  per this project's zero-fabrication rule.
- `DepartmentsListScreen`/`DepartmentDetailScreen` still on the older plain-card visual style
  (flagged in the plan doc since 2026-08-31, not re-touched this round — functionality is real
  and complete, purely a restyle-to-`GlassCard` task, same shape as the `Pill` sweep above but
  for cards instead of badges).

**Next round, if continued**: the same "which screens are behind" method — grep for a legacy
pattern used before the `components/mg`/`GlassCard` vocabulary existed (`StatusPill` is done;
`Departments*` cards, raw `colors.card`+`elevation` combos outside the ones fixed in Round 1,
and manual `BlurView` usage were already swept and came back clean) — is more tractable than
re-reading all ~30 `mglass-*.jsx` files node-by-node without a device to verify against.

## Round 4: worked through the Round 3 backlog

- **`DepartmentDetailScreen.tsx` restyle** — turned out to be more than cosmetic: the screen had
  **no back-navigation affordance at all** (`DepartmentsStack` runs `headerShown: false`, and the
  screen never drew its own nav row like every sibling detail screen does — only the system back
  gesture/button could leave it) and no delete action despite `deleteDepartment()` already
  existing in `api/departments.ts` and being completely unused. Rewrote to match the established
  detail-screen pattern (custom back+edit+delete nav row, `AvatarInitials` hero instead of an
  oversized 80px icon circle, uppercase kicker section labels outside `GlassCard`s instead of
  bold in-card titles, `colors.line3` hairline separators) — same one already used by
  `CompanyDetailScreen`/`ProjectDetailScreen`. `DepartmentsListScreen` was already on `GlassCard`
  rows and needed no change; only the detail screen had drifted.
- **Home screen global search** — the search bar previously just navigated to Leads. Built the
  real thing per `mglass-sheets.jsx`'s `SearchSheet`: a bottom sheet, grouped Лиды/Проекты/Компании
  results (leads/projects reuse data already fetched for the dashboard; companies fetched lazily
  on first open, not on every Home load). One deliberate improvement over the mockup: its
  `SearchSheet` renders company rows as plain unclickable `<div>`s (nothing to click through to in
  the static mockup) — ours navigates to the real `CompanyDetail` screen, since that screen exists
  and every other entity type in the same sheet is tappable; leaving companies dead here would
  have been an inconsistency the mockup just didn't have to solve.
- **`ProfileCompletion` widget — checked, not built.** `api/profile.ts`'s `UserProfile` has no
  completion-score concept at all (no tracked flags for avatar/2FA/phone/etc.) — the design's
  `pc.percent`/`pc.steps` is pure mockup fixture data (`window.DASHBOARD.profileCompletion`).
  Confirmed via the API surface before deciding, per this project's zero-fabrication rule, rather
  than skip it on assumption.
- **Home widget reordering** — built, but deliberately *not* as real drag gestures. The design's
  version uses a pointer-based DnD engine (`mglass-core.jsx`'s `useDnD`) with **no persistence** —
  `order` is local `useState`, lost on reload. Every other "reorder/move" surface already in this
  RN app (`ProjectTaskBoardScreen`, `CoTasksScreen` Kanban columns) deliberately downgrades real
  drag gestures to a long-press → bottom-sheet move picker, per `MOBILE_APP_PLAN.md` §3's own
  documented reasoning (drag-and-drop needs backend ordering support the API doesn't have, or
  is judged not worth the gesture-handler complexity). Matched that established convention instead
  of introducing the app's first real pointer-drag surface for a personalization feature with no
  backend concept: an "Изменить порядок"/"Готово" toggle reveals ↑/↓ buttons per widget, order
  persisted to `AsyncStorage` (device-local, same pattern `ThemeContext` already uses for theme
  mode) — actually *better* than the mockup, which forgets the order on every reload. The
  always-pinned hero "Продажи в этом месяце" card matches the design too (`HeroCard` is rendered
  outside the mockup's reorderable `W` map).

All four verified with `tsc --noEmit` + `expo export --platform android` (clean); no device
available in this sandbox, so the actual on-screen result of the reorder buttons and the search
sheet's layout on a real phone is still unconfirmed.

## Round 5: Leads + Projects + Sales against mglass-leads/projects/sales.jsx

- **Leads — 4 dead buttons found and fixed.** `LeadDetailScreen.tsx`'s quick-action grid
  (Позвонить/WhatsApp/Email/Telegram) had every handler written as `lead.phone && Linking.openURL(...)`
  — on a lead with no phone/email, tapping did *nothing*, no feedback at all; Telegram's handler
  was a literal no-op (`() => {}`) regardless of data, since leads don't store a Telegram handle
  and there's no reliable phone→chat deep link. All four now either act or show a `showToast`
  explaining why not, matching the "never a button that silently does nothing" standard already
  used elsewhere in this app.
- **Leads — built "Конвертировать" (lead→contact/company).** `POST /leads/:id/convert` was a
  fully real, fully unused backend endpoint (finds-or-creates a Contact by phone/email match,
  optionally a Company, links both to the lead) — the design has this as a core action
  (`ConvertSheet` in `mglass-sheets.jsx`, a grid button in `mglass-leads.jsx`'s `LeadDetail`) and
  nothing on mobile called it. Added `convertLead()` to `api/leads.ts` and a bottom sheet
  (optional company name, "mark as won" toggle) behind a repurposed nav-bar icon — the icon slot
  used to be a bare `ellipsis-horizontal` with no `onPress` at all (another silent dead button).
- **Leads — UTM section.** Design shows a dedicated `utm_source`/`utm_medium`/`utm_campaign`
  block when present. The data was already on the mapped `Lead.meta` (mobile was collapsing it
  into a single generic "channel" label and discarding the rest) — added the section reading
  straight from `lead.meta`, no backend change needed.
- **Leads — everything else already matches.** `LeadsListScreen`'s Канбан/Список/Утраченные
  modes, manager chips, filters sheet, and `LeadDetailScreen`'s Обзор/Шаги/Поля/История tabs all
  already mirror `mglass-leads.jsx` closely — this block was built first and most carefully back
  on 2026-09-05, and it shows.
- **Projects — built the missing global "Задачи" screen.** `mglass-projects.jsx`'s `TasksScreen`
  (every task across every project, one 6-column status kanban) had no mobile equivalent —
  `OverdueScreen` only surfaces the overdue subset, and `ProjectTaskBoardScreen` is scoped to one
  project. New `AllTasksScreen.tsx` reuses the exact long-press→move-sheet pattern already
  established by `ProjectTaskBoardScreen`/`CoTasksScreen` (not real drag gestures, same reasoning
  as the Round 4 home-widget-reorder entry above), registered in `ProjectsStack`, linked from a
  new toolbar icon on `ProjectsListScreen`'s header and from "Ещё" → Проекты → «Задачи».
- **Sales — already solid**, no changes: `SaleDetailScreen` already has real Подтвердить/Отменить
  status actions and real comments, matching `mglass-sales.jsx`'s `SaleDetail` action grid (its
  "Счёт"/invoice button has no mobile equivalent — likely a PDF-generation feature better left
  desktop-only, not confirmed either way this round).
- **Not checked this round, flagged for later**: `mglass-sales.jsx` also defines `StockScreen`
  (inventory levels) — Products module (`ProductsStack`) has no dedicated stock screen, only
  per-product stock fields inline on `ProductDetailScreen`. Lower priority (not a primary tab),
  didn't chase it down this round.

All verified with `tsc --noEmit` + `expo export --platform android` (clean).

## Round 6: read the design's own screen index (`mobile-app-screens.html`) — walkthrough scope decision

Read the canvas file that assembles every `mglass-*.jsx` screen into one indexed gallery
(`SCREENS` map + 15 `DCSection`s, ~90 named screens total) rather than continuing to fetch
design files one at a time — this is the authoritative map of what the design actually contains,
including sections not obviously guessable from filenames alone (`mglass-w1..w5-*.jsx` turn out
to be waves 1–5 of screens: auth/create-forms, calendars/overdue/archive/inbox, analytics/
marketing/ops, admin/AI, and a final "point gaps" wave — not desktop-only reference material).

Spot-checked the sections not yet touched this session against real screen files (existence
check, not full read-and-compare, given the size): Companies/Contacts detail, Marketing
(traffic/campaigns/UTM/segments/broadcasts — each already its own dedicated screen, matching or
exceeding the design's tabbed single-screen layout), AI employees/approvals, Automations,
Duplicates, BI, Team calendar, Client accounts (CCP — confirmed in an earlier round to be a
genuinely different real domain, deliberately left unbuilt), and the full Auth wave
(login/OTP/forgot/set-password/signup+verify/tenant-suspended, plus a shared `AccessDenied`
component instead of the design's one global "denied" screen — arguably the better
architecture). All present, all real (backend-wired), most already covered by their own
dedicated deep-redesign rounds documented elsewhere in this memory (Staff Permissions,
Departments, Telegram, Hotels, Booking, Esign, Helpdesk, Web-forms, Integrations Hub, Tariff
billing — see `lumiva_mobile_app.md` and the other per-feature memory files for those).

**Decision: concluding the exhaustive file-by-file walkthrough here.** The pattern across 6
rounds has been consistent — genuine gaps are specific and findable (a missing feature, a dead
button, a wrong token), not systemic; the app is not "behind" the design in the way the first
message in this session's design thread implied. Continuing to fetch and diff all ~90 named
screens one at a project file at a time has sharply diminishing returns against this session's
own budget. If a future round wants to continue, the screen index above is the map — grep the
`SCREENS` object's keys against real route names to find any screen genuinely never checked
rather than re-reading files already confirmed solid.

## Fixed this round

1. **Marketing → "Каналы" chart disappearing.**
   Root cause: `useDateDrilldown()` defaulted to the "all-time" zoom level (`from`/`to`
   undefined). The user's real tenant has 625 distinct days of `marketing_traffic` data
   — fetching/rendering that as a single line chart by default was overwhelming the
   `TapChart` component. Fixed by defaulting to the 90-day window instead (all-time is
   still reachable via zoom-out). See `src/components/mg/useDateDrilldown.ts`.

   Also fixed a real, independent backend bug found while investigating:
   `MarketingService.getTrafficDailySeries()` built the `date` field via
   `String(rawPgDateObject).slice(0, 10)` — since `getRawMany()` bypasses TypeORM's own
   date-column string transformer, `rawPgDateObject` is a JS `Date`, and
   `String(date)` uses `Date.prototype.toString()` ("Tue Sep 01 2026 …"), not ISO. The
   slice produced a garbage/wrong-year string. Fixed with a SQL-side
   `to_char(t.date, 'YYYY-MM-DD')` cast, matching the pattern already used correctly in
   `BookingsAnalyticsService.getDailyTrend()`. Confirmed no other daily-series method in
   `marketing.service.ts` has the same bug (the other `.slice(0,10)` call sites are
   either import-time string sanitization or TypeORM-hydrated entity fields, which are
   already safe strings).

2. **Bottom tab bar missing on most screens.** Root cause: the root navigator is a plain
   `Stack.Navigator` where `App` (the `Tab.Navigator` with the bar) is just one sibling
   screen among ~20 others (Sales, Products, Bookings, Marketing, Clients, Staff, …).
   Those module stacks are pushed as separate full-screen root routes entirely outside
   the tab navigator, so the old `GlassTabBar` (wired via `Tab.Navigator`'s `tabBar` prop)
   never rendered for any of them — only the 5 literal `Tab.Screen` routes ever showed it.

   Restructured so the bar is a **persistent layout sibling at the root**, always
   rendered above `Stack.Navigator` in a flex column (`src/navigation/AppNavigator.tsx`),
   driven by a `navigationRef` + `onStateChange`/`onReady` that maps the current route to
   one of the 5 tab keys (`src/navigation/GlobalTabBar.tsx`, replacing the old
   `GlassTabBar.tsx`, now deleted). The bar hides only for `Auth`/`Offline` and for the 6
   modal-presentation create screens (Lead/Project/Company/Contact/Product/
   EmailTemplateCreate). Every other module screen — reached only via "Ещё" today — now
   highlights the "Ещё" tab while active. Verified `tsc`/`expo export` stay clean.

3. **Active segmented-control item showing a black outline; "Ещё" theme-toggle row
   cramped.** Root cause: `Segmented`'s active pill used `shadowColor + elevation`, and
   Android's `elevation` renders as a hard dark halo around the pill rather than the
   design's flat `.on` background swap — this affects every screen using `Segmented`
   (Project/Contact/Company detail tabs, Analytics, Marketing, etc.), not just "Ещё".
   Removed the shadow/elevation entirely; the active state is now a flat background
   color change only, matching the CSS. Added a `compact` variant (auto-width buttons,
   tighter padding) for the design's small inline theme-toggle usage
   (`components/mglass-more.jsx`'s `.mg-seg` with `padding: 2`), used in
   `MoreScreen.tsx`'s "Тема оформления" row. Also added the header `CurrencyChip`/
   `ThemeChip` pair to "Ещё" — present in the design's `Head` but missing from our
   implementation.

## Fixed: "Почта" (Email) — root cause was a real backend bug, not a mobile issue

The screenshots show the real `EmailInboxScreen`/`EmailComposeScreen` (not a stray/
native screen — string search confirmed) rendering, but with 0 messages in whichever
folder was selected.

Findings from direct DB inspection of the user's own tenant
(`263d247c-4928-40d4-9025-5a8adaa3065e`):
- Exactly one email account: `lumiva.agency@gmail.com`, Gmail OAuth (no IMAP
  password — this account syncs via the Gmail API, not raw IMAP).
- `status = 'error'`, `lastError` last written 2026-09-09 20:04 (2 days stale). Despite
  the stuck status, **48 real inbox messages already existed** in `email_messages`
  (correctly linked to the "Входящие" folder) from before the sync broke.
- **Root cause found**: `EmailSyncService.cronSyncAllTenants()` (runs every 2 minutes)
  only ever selects accounts `where status: 'active'`. The moment any account's sync
  fails once and gets marked `status: 'error'`, it is permanently excluded from every
  future cron tick — there is no backoff-and-retry, just total exclusion forever, since
  the only thing that could flip `status` back to `'active'` is a successful sync, and
  a successful sync can only run if this same query picks the account up in the first
  place. A single transient failure (network blip, a momentary token-refresh race)
  permanently disables a mailbox with no code path back to health.
- Fixed in `email-sync.service.ts`: the cron now selects `status: In(['active',
  'error'])` instead of just `'active'`, so a previously-failed account gets a real
  retry every 2 minutes instead of being stuck forever.
- **Verified live**: rebuilt + restarted the API container, watched the next cron tick.
  Account flipped back to `status: 'active'`, `lastError` cleared, and the message
  count went from 52 → 53 (a genuinely new message was imported). The Gmail OAuth
  refresh token was fine the whole time — this was never an "account needs
  reconnecting" situation, purely the cron-exclusion bug above. The mobile
  `EmailInboxScreen`'s "Входящие" tab should now show real messages on the next load.
- Secondary, lower-priority design-fidelity gap for a later round: the design's actual
  `EmailScreen` (`mglass-comms.jsx`) doesn't have folder tabs at all — it's always just
  "Входящие", filtered by **account** (chips: "Все ящики" + one per connected mailbox),
  with search behind a sheet icon and compose behind a solid "+" button in the header.
  Our `EmailInboxScreen` instead added folder tabs (Входящие/Отправленные/Избранные) —
  functionally richer than the design (uses real folder data the backend already
  tracks) but a deliberate deviation, not an oversight. Left as-is for now since the
  user's complaint was "doesn't work," not "doesn't match design" — flagging in case a
  future round wants to reconcile it either by adding account-chips alongside the
  folder tabs, or by matching the design 1:1.

## Built this round: Hotels analytics screen

New `HotelsAnalyticsScreen.tsx` (registered in `HotelsStack`, linked from "Ещё" → "Резервации
отелей"), 3 tabs (Сводка/Отели/Рынки) matching the design's `HotelAnalyticsScreen` shape as
closely as the already-real, already-scoped mobile API surface allows:
- Тенант-wide KPIs (`occupancyNowPct`, `roomsAvailable`/`roomsTotal`, `revenueSold`) +
  top-markets funnel, both from the existing `GET /hotels/analytics` endpoint.
- Per-hotel list (occupancy %, revenue, free rooms) via a client-side fan-out — one
  `fetchHotelAnalytics({hotelId})` call per hotel, same pattern as this session's earlier
  `fetchAllCompanyTasks` — since there's no single endpoint returning all hotels' summaries
  at once.
- Deliberately **not** included (would be fabricated): the design's ADR/RevPAR figures, a
  12-month occupancy trend, per-channel/agency revenue split, meal-plan (board) mix, and
  guest age demographics. A prior round already trimmed the mobile-facing
  `HotelAnalyticsSummary` type down to `{kpis, markets}` specifically because the backend's
  richer `pacing`/`funnel`/`roomTypes`/`agencies`/`guests` fields were judged "out of scope
  for a read-only mobile view" (see the comment above `fetchHotelAnalytics` in
  `api/hotels.ts`) — and `guests` is explicitly a stub (`dataAvailable: false`) on the
  backend itself. Left that trim in place rather than re-opening it; a future round could
  deliberately widen it (real ADR/RevPAR exist per room-type in `roomTypes`, and `agencies`
  is a genuine real channel-style breakdown) if a fuller hotels analytics view is wanted.

## Investigated, not built: "Аналитика счетов" (CCP / client accounts)

The design's `AccAnalyticsScreen` assumes an accounts-receivable domain: aging debt
buckets, per-client credit limits, overdue-days tracking, cash in/out. Checked the real
backend module (`src/modules/ccp/`) this maps to on mobile ("Ccp" route, "Счета клиентов")
and **it is not that domain at all**: `CcpClientEntity` tracks EUR/USD balances for
WordPress-linked investment/broker-style client accounts, with fields like
`investmentStyle`, `investmentAnnualPercent`, `creditLeverage`,
`creditRepayMonthlyPercent` — a real, already-fairly-rich domain (per-client analytics at
`GET /ccp/clients/:id/analytics` already categorizes transactions into
profit/investment/fee/credit/expense), just a completely different one from what the
design's aging/credit-limit UI assumes. Building the design's screen literally would mean
inventing "overdue days" and "credit limit" concepts that don't exist here — a real
zero-fabrication violation, not a simplification like the Hotels case above.

Also: there is no tenant-wide analytics endpoint yet, only the per-client one — a tenant-wide
view would need a genuine new backend aggregate (sum balances across clients, aggregate the
existing txn-category logic across all clients/sites for the tenant), which is more than a
mobile-only task. **Left unbuilt** — needs a product decision on what a tenant-wide "Счета
клиентов" summary should actually show for this real domain, not a straight design port.

## Built this round: Bookings waitlist convert-to-reservation flow

`WaitlistScreen.tsx` only ever listed `status: 'waiting'` entries and could delete them — the
real backend (`bookings-waitlist.service.ts`) already had a full `waiting → offer → confirmed`
flow (`POST :id/offer` sets a slot + flips status to `'offer'`; `POST :id/convert` turns an
offered entry into a real reservation) that mobile never exposed. Added:
- `offerWaitlistSlot()`/widened `WaitlistEntry` type (`locationId`, `offeredStartAt`,
  `offeredEndAt` — already returned by the API, just untyped on mobile) in `api/bookings.ts`.
- The screen now lists both `waiting` and `offer` entries; "Предложить слот" opens a sheet to
  set start/end (same free-text `ГГГГ-ММ-ДД ЧЧ:ММ` convention used elsewhere on mobile — no
  native date picker anywhere in this app); an offered entry gets a "Записать" button that
  calls convert and jumps to the new reservation's `BookingDetail`. Backend validation errors
  (missing location, no offer yet) are surfaced verbatim via toast instead of a generic message.

## Built this round: Projects archive & trash

Projects already had a **complete, real** archive/trash backend
(`PATCH :id/archive`/`:id/unarchive`, `DELETE :id` = soft-delete, `PATCH :id/restore`,
`DELETE :id/permanent`, `DELETE trash/empty`, list filters `?archived=`/`?deleted=`) with zero
mobile surface at all — not even a way to archive/trash a project in the first place. Built:
- New `ProjectsArchiveScreen.tsx` (Segmented Архив/Корзина tabs), linked from "Ещё" →
  "Проекты" → "Архив и корзина проектов". Restore is one tap in both tabs; "В корзину" from
  Архив and "Удалить навсегда" from Корзина (the latter behind a native confirm — the only
  genuinely irreversible action here, consistent with the one other confirm dialog pattern
  already used elsewhere on mobile). Added a real "Очистить корзину" bulk action too
  (`DELETE /projects/trash/empty`), also confirmed.
- Added the missing entry point: `ProjectDetailScreen`'s nav bar now has archive/trash icon
  buttons (mirroring the existing trash icon convention on Company/Contact detail).
- **Deliberately did not add the design's "удаляются окончательно через 30 дней" countdown**
  — checked, there is no auto-purge cron on the backend at all; trashed projects stay in trash
  indefinitely until a human restores or permanently deletes them. Showing a fake day-count
  would have been a fabrication.
- **Leads' equivalent was investigated and left unbuilt**: leads only have a `meta.deleted`/
  `meta.archived` JSON-flag convention (used to *exclude* trashed leads from a couple of
  relation queries) with no dedicated archive/unarchive/restore/permanent-delete endpoints at
  all, and `DELETE /leads/:id` is a genuine **hard** delete already. There's no real backend
  lifecycle here to build a screen on top of — whatever web-side convention sets
  `meta.deleted` was never traced down, so mobile can't safely replicate it without guessing.
  Flagging for a future round with backend input on what (if anything) should be built for
  leads.

## Built this round: Telephony call-detail screen

`TelephonyScreen.tsx` only ever listed calls and dialed the number on tap — `recordingUrl`,
`transcript`, `sentiment`, `tags`, `linkedLeadId` were all already fetched (real fields,
`Call` type in `api/telephony.ts` already had them) but completely inaccessible. Built a new
`CallDetailScreen.tsx` (tap a call row now opens it; a separate small phone icon on the row
still quick-dials): status/duration/date, AI sentiment as a Pill, tags, a link through to the
linked lead, the full AI transcript, and a real "Открыть запись" action for the recording.

The recording needed more than a plain `Linking.openURL(item.recordingUrl)` — checked the
backend and `GET /telephony/calls/:id/recording` is an **authenticated proxy** (it holds the
Twilio credentials and streams the audio bytes back; the raw external URL isn't independently
fetchable). Added `expo-file-system` + `expo-sharing` (neither was installed before) to
download the file with the same bearer/tenant headers the axios instance attaches, then hand
it to the OS share sheet so the user can pick a player. **Note**: `expo-file-system` v19
(bundled with SDK 54) replaced the old `downloadAsync`/`cacheDirectory` API with a new
File/Directory API — used the explicit `expo-file-system/legacy` import path to keep the old
imperative API, since that's the better fit for "download to a temp file, then share it."
**Since these are new native dependencies, the next APK build needs a fresh native
compile (not just a JS bundle) before this actually works on-device** — `tsc`/`expo export`
both pass, but that only proves the JS side.

## Built this round: E-sign document-issue flow + template management

Mobile had full read/list/send/duplicate/delete for e-sign documents but **no way to create
one at all** — the backend's issue wizard (`POST /esign/documents`, key-catalog,
auto-values-from-contact, per-contact amount suggestions pulled from Leads/Projects/Sales,
atomic `{CONTRACT_NO}` sequence claiming) and full template CRUD
(`GET/POST/PATCH/DELETE /esign/templates`) were both completely real and completely unused.
Built:
- `EsignDocumentCreateScreen.tsx` — pick a contact and a template, then real contract fields
  (amount — prefillable from a real per-contact suggestion list sourced from their
  Leads/Projects/Sales; currency; date; service/term/pay-terms). `{CONTRACT_NO}` is **not** a
  mobile field — the backend claims it atomically on issue, so exposing it here would risk a
  stale/duplicate value. Client/org keys ({NAME}, {PHONE}, {ORG_NAME}, {MANAGER}, …) need no
  UI at all — confirmed the backend resolves them itself from the contact/tenant/user records.
- `EsignTemplatesScreen.tsx` + `EsignTemplateFormScreen.tsx` — full template CRUD (name, kind,
  description, file-name pattern, and the {KEY}-templated body text as a multiline field).
- **Deliberately out of scope** (matches the design's own minimal `EsignScreen`, which has no
  wizard UI at all beyond a "Отправить на подпись" button): the products/booking-services
  line-item picker with per-item master assignment ({PRODUCT_*}/{SERVICE_*} keys), and a live
  rendered preview of the document while filling the form — both real backend capabilities,
  both left as "на ПК" per the established convention for genuinely desktop-scale editing
  tasks, not fabricated or faked on mobile.

## Built this round: Departments tree/summary/stats

`DepartmentsListScreen`/`DepartmentDetailScreen` only ever did a flat list + direct-member
filtering — `GET /departments/tree`, `/summary`, `/:id/stats`, `/:id/staff` (recursive) were
real and completely unused. Added:
- List screen: real tenant KPIs (staff in departments, unassigned staff, departments without a
  manager, total active staff) via `StatGrid2`, and switched from a flat list to the real
  parent/child tree (indented rows, branch icon for children) instead of a same-level list that
  silently ignored `parentId`.
- Detail screen: real stats (`staffCountRecursive`, `leadsInProgress`, `salesClosed30d`,
  `salesClosed30dAmount`, `conversionPct` — all genuinely Lead/Sale-derived, per the backend's
  own comment ruling out the mockup's fabricated "load %"/"avg response time"), a real
  sub-departments list, and switched the "Состав" member list from `staff.departmentId === id`
  (direct reports only) to the real recursive endpoint so a parent department shows everyone
  under it, not just direct hires.

## Built this round: Marketing Segments (create/detail/run) + Marketing Automations

Both were completely real on the backend and completely unused/broken on mobile:

- **Segments**: `SegmentsScreen.tsx`'s "Создать сегмент" button was a literal `{/* TODO */}`,
  and the card's `item.contactsCount`/`item.conditions` fields **don't exist** on the real
  `SegmentDto` at all (a pre-existing type mismatch — the real fields are `leadStatuses`,
  `source`, `country`, `manager`, `createdFrom/To`, `trafficPresets`, `lastMatchedCount`,
  `lastRunAt`) — so every card was silently rendering blanks. Fixed the type to match reality,
  and built `SegmentCreateScreen.tsx` (name/description + status/source/country/manager/date
  filters) and `SegmentDetailScreen.tsx` (shows the filter definition, a real "Запустить"
  button hitting `POST /segments/:id/run`, and the actual matched-leads list). Note: despite
  the DTO naming them `statuses`/`sources`/etc. as arrays, the backend only ever reads index 0
  of each ("legacy" single-value filters) — confirmed by reading `createSegment`'s own
  `hasLegacy` check — so the mobile form is a single-select per filter, not multi-select.
  Campaign/UTM-based targeting (`trafficPresets`, matched against real ad-campaign names) was
  left as "на ПК" — real capability, but its own reasonably complex picker UI.
- **Automations**: `/marketing/automations` (full CRUD: name, type, `webhookUrl`, `isActive`,
  `lastStatus`, `lastRunAt` — an n8n/webhook integration registry, distinct from the app's
  separate general-purpose "Automations" module) had zero mobile surface. Built
  `AutomationsListScreen.tsx` (list + active/inactive `Switch`, matching the exact toggle
  pattern already used by the sibling general-Automations screen, + delete) and
  `AutomationFormScreen.tsx` (create/edit). Linked from "Ещё" → "Маркетинг".

## Deliberately left desktop-only (explicit user instruction)

- **Permissions screen**: user confirmed this should stay a desktop-only feature, not built on
  mobile at all.

## Not yet re-audited this round (carried over / still open)

These were already known from earlier rounds this session and remain untouched:
- Products revenue/top-sellers analytics (blocked — no `Sale`↔`Product` line-item link).
- Archive/Trash for **leads** specifically (Projects is now done — see above; leads have no
  real backend lifecycle to build on, see the dedicated note above).
- Staff CRUD (mobile is read-only).
- AI-agent approval-rules UI (no mobile coverage).
- Design-system stragglers: some screens still use the older `StatusPill` (from
  `components/ui`) instead of the newer `Pill` (`components/mg`); a handful of
  Leads/Clients screens don't use `MgHeader` yet; `DepartmentsListScreen`/`DepartmentDetailScreen`
  still use their older plain-card visual style rather than the newer "mg" component vocabulary
  (functionality is now real and complete, just not restyled).

## Method note

Per this session's standing lesson: background `Agent` tasks do **not** have access to
`DesignSync` (verified independently by 6 separate agents earlier this session) — any
further design-vs-code comparison has to be done directly in the main/interactive
session, not delegated.

## 2026-09-11, later same day: real-device liquid-glass debugging (Rounds 7-10)

User tested the built APK on a real Android phone and reported the glass look was completely
missing (flat, hazy cards) and a hard crash on the Projects tab. Root causes found, in order:

1. **Gradle was silently bundling a stale JS build.** `createBundleReleaseJsAndAssets` reused a
   cached `index.android.bundle` across several rebuilds despite source changes — confirmed by
   extracting the Hermes bytecode from the shipped APK and grepping for ASCII markers unique to
   recent commits (Cyrillic strings don't survive in a directly greppable form in compiled Hermes
   bytecode, but ASCII identifiers like screen/icon names do). Fix: clear
   `android/app/build/{generated,intermediates}/**/*release*` (not just `.expo`/metro cache)
   before every rebuild, or `./gradlew clean` when in doubt. Documented as a standing gotcha —
   every APK build in this project must clear these paths first.
2. **`expo-blur`'s Android `dimezisBlurView` produced a uniform pale haze on every screen**
   (including the unrelated Auth stack) instead of a frosted-card look. Its native implementation
   blurs whichever `react-native-screens` "Screen" ancestor it finds (or falls back to the app
   root) — plausibly a blur-root/snapshot-timing mismatch with this app's persistent-tab-bar
   layout, not debuggable further without on-device native logs. **Removed native blur entirely**
   from `GlassCard` (the single shared implementation `GlobalTabBar`/`AppBottomSheet` already
   route through) — "glass" now comes from gradient + border + shadow only, which is reliable
   across devices instead of a native blur implementation we can't fully control here.
3. **The CSS's `.80→.56` gradient opacity assumes a blurred backdrop.** Without blur, that same
   gradient became a window straight onto sharp, saturated `AuraBackground` colors — read as a
   harsh "block within a block" rather than a sheen. Raised both `glassGradient`/`glass2Gradient`
   tokens to a denser, narrower range (`.97→.90` light / `.20→.13` dark) for a consistently
   near-solid surface.
4. **Android `elevation`, at any nonzero value, drew a visible dark ring** on translucent glass
   surfaces on this device — even the "modest" value (2-3) used to avoid the original harsh-ring
   bug was still visible as an unwanted black outline. Removed Android elevation from `GlassCard`
   and the `Charts.tsx` `StatCard` entirely (iOS keeps its real shadow via `shadow*`).
5. **The actual black outline around the tab bar was unrelated to shadow/border at all.**
   `AppNavigator.tsx`'s two outermost wrapper `View`s had no `backgroundColor` — transparent, so
   the padding/gaps around the floating tab bar pill exposed Android's default window background
   (black, since `AppTheme` never set `android:windowBackground`). Fixed at both layers: an
   explicit `backgroundColor: colors.background` on the JS wrapper, and a proper
   `android:windowBackground` (`res/values/colors.xml`/`styles.xml`) matching the light theme's
   bg0 as a static native fallback.
6. **Active tab bar item had no background fill.** The CSS (`.mg-tab.on{background:var(--fill)}`)
   specifies a highlight pill behind the active tab; `GlobalTabBar.tsx` only ever changed
   icon/text color. Added `backgroundColor: colors.surfaceVariant` on the focused item.
7. A `-Pandroid.enableMinifyInReleaseBuilds=true -Pandroid.enableShrinkResourcesInReleaseBuilds=true`
   release build also revealed `@expo-google-fonts/*` was bundling **all 18 weights of every
   font family** (~18MB) because `App.tsx` imported named exports from each family's barrel
   `index.js`, which unconditionally `require()`s every weight file as a side effect of the
   module loading — Metro doesn't tree-shake that away. Fixed by importing each of the 7
   actually-used weights from its own subpath (`@expo-google-fonts/inter/400Regular` etc.)
   instead of the family barrel.

Net effect after all of the above: real device screenshots (light theme) show the intended
"glass" look — solid-but-layered cards, correct floating tab bar with no black fringe and a
visible active-tab highlight. Not yet re-verified on a device in dark mode.

## 2026-09-14: Lead detail vs `mglass-leads.jsx` `LeadDetail`, + checklist gap

User pointed at the design's own "02 · Карточки и задачи" canvas section (Lead/Project/Tasks
cards) and flagged the Lead screen specifically as still not matching.

- **Lead "Действия" block rebuilt to match spec exactly.** The screen previously had a 4-icon
  quick-action row (Call/WhatsApp/Email/Telegram — WhatsApp/Telegram were this session's own
  earlier addition, not in the design) plus a separate 2-button bottom CTA bar (В работу/Закрыть
  сделку). Replaced with the design's actual `mg-card` "Действия" grid — Позвонить (accent) /
  Письмо / Конвертировать / Сменить статус — plus the explanatory `POST /leads/:id/convert` note
  line. "Сменить статус" now opens a proper 5-option status sheet (matching the `openSheet(
  'lead-stage')` pattern) instead of the old two-shortcut CTA bar. Convert is reachable only from
  this grid now (dropped the redundant nav-bar icon that did the same thing).
- **Task checklist progress was completely unmapped.** `mglass-projects.jsx`'s `TaskBoard` card
  shows a progress bar + "чек-лист X/Y" when a task has checklist items — confirmed real on the
  backend (`projects.service.ts`'s `normalizeTasks` already returns a full `checklist: {id,
  title, done, doneBy, doneAt}[]` per task) but mobile's `ProjectTask` interface didn't declare
  the field at all, so it silently never rendered anywhere. Added the field + a progress bar to
  both `AllTasksScreen` and `ProjectTaskBoardScreen` cards (the two places task cards render).
- **Verified, not a bug: `CampaignsScreen`/`SegmentsScreen` looked unreachable** (no
  `Stack.Screen` registers them) but are correctly rendered inline as tab content inside
  `MarketingScreen` (`{tab === 'campaigns' && <CampaignsScreen/>}`) — a valid composition
  pattern my route-based grep methodology doesn't catch. Worth remembering before flagging a
  screen as "dead code" from a `Stack.Screen name=` grep alone.
- **Confirmed real, not buildable: "Рассылки" (Broadcasts/`bcform`)** — the design's
  `window.BROADCASTS` fixture has zero backing on either side: no `broadcast` concept anywhere
  in `lumiva-crm/backend/src/marketing/` and no frontend code either. Not a mobile gap to fix;
  would need real backend work first.
- **Not yet re-verified this round** (time-boxed, didn't chase further): Products `stock`
  screen (flagged missing in Round 5, still missing); hotel `frontdesk`/`hotelcal` design
  screens — Hotels has had 4+ dedicated deep rounds per `lumiva_hotels_module.md`, plausible
  this is already covered inline within `HotelDetailScreen`/`HotelReservationsScreen` rather
  than as separate routes, but not directly confirmed; AI chat `aimemory`/`ailetter` tabs and
  `aireports` screen — likewise plausible but unconfirmed.

All changes verified with `tsc --noEmit` (clean, only the pre-existing unrelated `App.tsx`
`global` and `client.ts` `AxiosHeaders` errors) and a full release APK rebuild.

## 2026-09-14, continued: building the confirmed-missing pages (all except Broadcasts)

Chased down the four items left unconfirmed above, checking real backend support before
building anything (per this session's standing zero-fabrication rule) — three were fully real
and unwired, one was real-but-thin and built at reduced scope, one turned out to need more
product input than a mobile session can resolve alone:

- **`aireports` — already built, false alarm.** `AiAgentDetailScreen.tsx` already has
  `fetchAiAgentReports`/`generateAiAgentReport` wired (a per-agent reports tab). Not a gap.
- **AI "Память" — built.** `GET/POST/DELETE /ai/memory` (storage-quota-aware server-side) had
  zero mobile surface. New standalone `AiMemoryScreen.tsx` (this app's AI chat is a
  sessions-list + thread pair, not one tabbed screen like the design, so a linked screen fits
  better than forcing in a 3rd tab) — linked from both `AiChatSessionsScreen`'s toolbar and a
  new icon button on `AiChatThreadScreen`'s nav bar.
- **Hotel `frontdesk` — built, with a real write exception.** `GET /hotels/frontdesk/today` +
  `POST /hotels/reservations/:id/check-in|check-out` all existed, fully unused. New
  `FrontDeskScreen.tsx` (hotel chip selector, Заезды/Выезды/В отеле segmented tabs, real
  check-in/check-out actions) registered in `HotelsStack` and linked from "Ещё". This
  deliberately breaks `api/hotels.ts`'s file-level "read-only, every write stays on web" rule —
  documented inline at both the API functions and the stack file, since front-desk check-in is
  an at-the-counter operational action, not a back-office pricing/config edit like everything
  else that file intentionally excludes.
- **Products `stock` — built, design's reserved/free split dropped.** `Product.quantity` +
  `lowStockThreshold` are real; there's no per-item "reserved" stock concept anywhere, so the
  design's На складе/Резерв/Свободно three-way split would have meant fabricating "Резерв". New
  `StockScreen.tsx` shows real quantity + inventory value, with the bar recoloring at
  `lowStockThreshold` instead (small, honest improvement using data the design didn't have).
- **`prodloc` (Локации хранения) — built at reduced scope.** `GET/POST/DELETE
  /products/locations` is real but the `ProductLocation` shape is just `{name, code,
  isDefault}` — no per-location stock allocation, fill %, value or shelf breakdown like the
  design shows, because that data doesn't exist (would need real per-location inventory
  tracking, a backend feature that isn't there). Built the honest version: a plain named-
  locations list with create/delete. **Side finding**: `MoreScreen.tsx` already listed
  "Категории и локации" marked `desktopOnly: true` — stale, since `ProductCategoriesScreen` was
  already real and reachable via `ProductsListScreen`'s toolbar the whole time. Split into
  proper Категории/Локации/Склад entries, all now genuinely linked.
- **Hotel `hotelcal` (occupancy/rate calendar) — investigated, NOT built.** The backend has
  `room-pricing`/`pricing-periods`/`period-summary` endpoints, but `api/hotels.ts`'s own
  standing comment already flags these as "dense structures built for the web pricing/pacing
  tools" deliberately left out of the read-only mobile surface — unlike front desk, this isn't
  a case of "real simple endpoint nobody wired up," it's a genuinely more complex aggregation
  (7-day × room-type sold/rate grid) that would need either a new purpose-built endpoint or
  meaningfully more investigation time than this round had. Left unbuilt rather than guess at
  an aggregation shape from three dense, not-obviously-mobile-shaped endpoints.
- **AI "Письмо" (freeform letter composer/regenerate/send) — still not built.** No AI
  email-drafting endpoint of the kind the design assumes (compose-only, tone/length knobs,
  regenerate). Found *adjacent* real capabilities — `POST /ai/outreach-email/:leadId`
  (lead-scoped cold-outreach draft) and `POST /ai/email-reply-suggest` — but neither matches the
  design's standalone/any-topic composer shape. Not chased further this round.

New screens registered: `AiChatStack` (`AiMemory`), `HotelsStack` (`FrontDesk`),
`ProductsStack` (`Stock`, `ProductLocations`). All verified with `tsc --noEmit` + `expo export`
(clean) and a full release APK rebuild.

## 2026-09-14, final: the last two ("not built") items, built after deeper investigation

User asked to go back and actually build the two items closed out above as "too complex for one
round" / "no matching backend." Both turned out buildable once dug into properly.

- **Hotel occupancy/rate calendar — built as `HotelCalendarScreen.tsx`.** The earlier note was
  right that `room-pricing`/`pricing-periods`/`period-summary` are the wrong endpoints (dense
  web-pacing structures), but a second pass found the *right* real pieces instead:
  - Occupancy (sold rooms per room-type per day) isn't exposed via any route at all —
    `HotelRoomTypesService.getConcurrentCountsByDay()` does the exact overlap math internally
    for overbooking checks, but only `HotelAvailabilityService` calls it, no controller route.
    Rather than add a new backend endpoint, computed the identical thing client-side from
    `fetchHotelReservations({hotelId})` (already fully real data this app already fetches
    elsewhere) — same `checkIn <= day < checkOut` overlap logic, so the numbers match exactly
    what the backend would compute, just done in the client.
  - Rate **is** exposed (`GET /hotels/room-types/:roomTypeId/daily-rates`) but returns a rate
    *per market group per day* (`hotels-pricing.service.ts`'s `getDailyRates` — this tenant
    prices Germany/Turkey/etc. differently for the same room-night), not one number. The design
    assumes a single "Тариф" per cell. Resolved honestly rather than picking one market
    arbitrarily: average `netPP` across whichever market groups have a rate set that day, and
    label the toggle "Тариф (в среднем)" so nobody reads it as one authoritative number.
  - New `api/hotels.ts` additions: `fetchHotelRoomTypes`, `fetchHotelDailyRates`. Registered in
    `HotelsStack` as `HotelCalendar`, linked from "Ещё".
- **AI "Письмо" freeform composer — built as `AiLetterScreen.tsx`.** Confirmed (again) there's
  no dedicated email-drafting AI endpoint matching the design's shape. Built on the real
  general-purpose `POST /ai/chat` instead: Тон/Длина/Тема/brief fields get folded into one
  explicit instruction prompt sent as a normal chat message (`sessionId: null`, so each
  generation is its own throwaway session rather than polluting a real conversation), the
  reply becomes an editable draft body, and "Отправить" is a real send through
  `POST /email/send` (already used elsewhere in the app for the same purpose) — not a
  simulated action like the design's own click-handler-less "Отправить" button. Picks the first
  `active` connected mailbox as the from-address automatically (matches the design's own
  single-implied-sender assumption); no account-switcher, since this tenant's design reference
  assumes one outbound address. Registered in `AiChatStack` as `AiLetter`, linked from both AI
  chat screens.

Both verified with `tsc --noEmit` + `expo export` (clean) and a release APK rebuild. This closes
out every item flagged across the whole 2026-09-11/09-14 audit except Broadcasts/`bcform`
(no backend concept anywhere, explicitly out of scope per the user).

## Round 11 (2026-09-14): data/charts gap sweep — `mglass-analytics.jsx` + `mglass-w3-analytics.jsx` + `mglass-booking.jsx`

User asked specifically: "what else is in the design that we don't have — maybe data, charts,
pages?" Went through every analytics screen in the design and diffed it against the real mobile
screens field-by-field (not just tab-name matching).

**Already fully covered, no action needed:**
- `AnalyticsScreen` (Лиды/Продажи/Компании/ROI) — all 4 tabs present in
  `src/screens/analytics/AnalyticsScreen.tsx`, all on real endpoints. Specifically checked the
  design's `RoiAnalyticsTab`, which computes CPL/ROAS from a **hardcoded per-channel ad-spend
  map** baked into the mockup (fixture-only fake cost data) — the real screen correctly built its
  ROI tab on `fetchLeadRoi()` (real revenue-by-channel) and never replicated that fabricated cost
  table. Correct call, re-confirmed, no change needed.
- `ProjAnalyticsScreen` (Сводка/Структура/Команда/Задачи) — all 4 tabs present in
  `ProjectsAnalyticsScreen.tsx` with real data (revenue timeline, status/category funnels,
  per-manager breakdown, task status + overdue list).
- `HotelAnalyticsScreen` (Сводка/Отели/Рынки) — 3 tabs present in `HotelsAnalyticsScreen.tsx`.
  Deliberately labels itself as deferring ADR/RevPAR/channel-mix/monthly trend to the web app
  ("в веб-версии") rather than faking them — correct, no fabricated data.
- `AccAnalyticsScreen` (aging debt/credit-limit analytics) — re-confirmed still out of scope, same
  finding as an earlier session round: the real CCP module is investment/broker-style client
  balances, not aging accounts-receivable. Different domain, not buildable without fabrication.
- `BookingsAnalyticsScreen` / `HotelTodayScreen` (generic services booking module,
  `mglass-booking.jsx`) — real mobile equivalent is `BookOverviewScreen.tsx`, which already
  covers today's arrivals/departures/revenue/no-shows plus **real per-resource utilization %**
  from `fetchResourceStats()`. Notably the *design's* resource-utilization numbers
  (92/64/78/41%) are hardcoded fixture values, not computed — the real app's version is more
  honest than the design here. `WaitlistScreen` also already exists and matches.

**Real gap found and fixed: Products analytics.**
`ProductsAnalyticsScreen.tsx` was a from-scratch client-side stub: fetched only the first 100
products via `fetchProducts({limit:100})`, computed status/category counts in JS, no tabs. Turns
out the backend already has a full `GET /products/analytics` endpoint
(`product-analytics.service.ts`/`product-analytics.controller.ts`, also used by the real web
frontend at `/products/analytics`) that the mobile app never called: KPIs (catalog value, cost
value, avg margin %, stock units, low/out-of-stock counts), margin-bucket histogram, real
stock-movement timeline (in/out/net per month from `ProductStockMovement`), by-category/
by-currency/by-location breakdowns, top-10 products by stock value, low-stock and out-of-stock
lists — all computed server-side over the *entire* catalog, not a 100-row slice.

Rebuilt `ProductsAnalyticsScreen.tsx` as 3 tabs (Сводка/Топ/Склад — mirrors the design's
sum/top/stock structure) wired to the real endpoint via a new `fetchProductsAnalytics()` in
`api/products.ts`. No revenue-by-product/turnover data exists (that would need Sales↔Products
line-item joins, already flagged as deferred in an earlier round — [[lumiva_products_sales_link_deferred]]) so "Топ" ranks by
stock value, not sales revenue — labeled honestly, nothing fabricated.

Verified: `tsc --noEmit` (no new errors), `expo export --platform android` (clean bundle), release
APK rebuilt and grepped for `products/analytics` + `marginBuckets` in the compiled Hermes bundle
to confirm the new code actually shipped. APK copied to `/root/lumiva-crm-mobile.apk`.

Not yet checked this round (lower priority — filenames suggest fixture data / forms, not charts):
`mglass-data.jsx`–`mglass-data5.jsx`, `mglass-w1-forms.jsx`, `mglass-w2-daily.jsx`,
`mglass-w2-records.jsx`, `mglass-w3-marketing.jsx`, `mglass-w4-admin.jsx`, `mglass-w5-screens.jsx`.

## Round 13 (2026-09-14): ru/en/tr language switcher + start of screen-by-screen translation

User asked for a language switcher in settings — Russian/English/Turkish, default English, "like on
the website." The web app uses i18next + react-i18next with two ~19k-line nested JSON translation
files; mobile had **zero** i18n before this round — every screen hardcoded Russian.

**Infrastructure** (not i18next — a lighter flat-key Context+AsyncStorage system matching this
app's existing `ThemeContext` convention, since there was no established i18n pattern to be
consistent with): `src/i18n/translations.ts` (`Lang = 'ru'|'en'|'tr'`, flat `key → string` dicts,
`DEFAULT_LANG = 'en'`) + `src/i18n/LanguageContext.tsx` (`useLanguage()` → `{lang, setLang, t}`,
persists to AsyncStorage key `lumiva_lang`). `LanguageProvider` wired into `App.tsx`. Switcher UI:
a 3-way compact `Segmented` (RU/EN/TR codes, not full names — avoids overflow on narrow phones)
added to the "Ещё"/More screen's settings card, right below the existing theme toggle.

**Important recurring distinction, applies to every future round**: this app has several places
where what looks like a translatable status/label string is actually the *raw backend data value*
— tenant-configurable Project status (`'Новый'|'В работе'|...`), task priority (`'Обычный'|
'Высокий'`), Product status keys compared directly. These must NOT be translated (would break
`===` comparisons against real data and misrepresent tenant-customized values as fixed app
strings) — only literal UI chrome (labels, buttons, section headers, toasts, placeholders) gets a
translation key. Established convention: real backend enum comparisons and Pill labels that
display a raw entity field are left as-is, with a comment where non-obvious.

**Also found and fixed a real bug while doing this**: `ProjectDetailScreen.tsx`'s task-list `.map`
used `t` as the loop variable, shadowing the `t()` translation function — renamed to `task`
before wiring in `t('projectDetail.highPriority')`. Worth grep'ing for `.map((t` / `.map((t,` in
any screen before adding `t()` calls inside a callback — this codebase uses `t` as a short name
for both "task" and "translate" and the shadowing is a silent runtime crash (task object called as
a function), not a type error.

**Screens fully translated this round** (all UI chrome — labels, toasts, empty states, section
titles, sheet copy — every string checked against a grep for remaining Cyrillic, `tsc --noEmit`,
and a release APK bundle-content grep): the 5 bottom tabs' labels, `MoreScreen` (full, done in the
prior round), `HomeScreen` (dashboard widgets, search sheet, create sheet), `LeadsListScreen`
(kanban/list/lost modes, filter+move sheets), `LeadDetailScreen`, `LeadCreateScreen`,
`EntityFormShell`+`FieldCard` (shared component — every future `*CreateScreen` benefits
automatically), `ProjectsListScreen`, `ProjectDetailScreen`, `ProjectCreateScreen`,
`AnalyticsScreen` (all 4 tabs — leads/sales/companies/roi), `ProfileScreen` (Account), `ClientsScreen`
(Contacts/Companies list hub).

**Not yet translated** — the bulk of the app, ~125 screens still hardcoded Russian. Priority order
for continuing, roughly by traffic: `CompanyDetailScreen`/`CompanyCreateScreen`/
`ContactDetailScreen`/`ContactCreateScreen` (next, completes the Clients module), then Sales,
Products, Bookings, Hotels, Dialogs/Telegram/WhatsApp, Telephony, Marketing, AI chat, Settings/
Staff/Departments, Auth screens (Login/OTP/Signup — arguably should be *high* priority since
they're pre-login and language should ideally be choosable there too, not yet addressed), and the
many smaller admin/settings screens. **This is explicitly a multi-round incremental project, same
shape as the website's own page-by-page i18n effort** ([[lumiva_i18n_translation_project]]) —
continue via bare "продолжай" messages, translating a handful of screens per round, always
verifying with `tsc` + a Cyrillic-string grep + (periodically, not every round) a release APK
bundle grep before reporting a batch done.

## Round 14 (2026-09-14, same day continued): Clients + Sales + Products + Bookings modules fully translated

User said to keep going without building an APK each time ("Пока не собирай APK, делаем перевод,
дальше решим") — so this round is translation-only, verified via `tsc --noEmit` + a per-file grep
for leftover Cyrillic UI strings after every screen, no release build.

**Completed this round**: `CompanyDetailScreen`, `CompanyCreateScreen`, `ContactDetailScreen`,
`ContactCreateScreen` (closes out Clients); `SalesListScreen`, `SaleDetailScreen`,
`SalesChannelsScreen`, `PaymentsScreen` (closes out Sales); `ProductsListScreen`,
`ProductDetailScreen`, `ProductCreateScreen`, `ProductCategoriesScreen`, `StockScreen`,
`ProductLocationsScreen` (closes out Products); `BookingsCalendarScreen`, `BookingDetailScreen`,
`BookOverviewScreen`, `WaitlistScreen`, `AvailabilityScreen` (closes out Bookings). ~24 more
screens, on top of the 13 from Round 13 — roughly 37 screens now fully translated.

**Two real bugs caught and fixed while doing this** (both worth re-checking for in every future
screen before wiring in `t()`):
1. A `.map((t) => …)` or `const { total: t } = …` local variable named `t` silently shadows the
   `t()` translation function — found in `ProjectDetailScreen` (Round 13), `SalesChannelsScreen`
   (`Object.keys(TYPE_LABEL).filter((t) => …).map((t) => …)`), and `ProductsListScreen`
   (`const { items, total: t } = await fetchProducts(...)`). Renamed the shadowing variable in
   each case (`task`, `ty`, `totalCount`) rather than avoiding `t()` nearby. Always grep a file for
   `(t)`/`(t,` / `: t}` patterns before adding `useLanguage()` to it.
2. None new this round beyond the pattern above — same fix, different files, worth calling out
   because it recurred three times independently, meaning it's a real recurring landmine in this
   codebase's existing code (short-name conventions collide with the new `t()` global).

**Fabricated-data judgment calls, consistent with the zero-fabrication policy applied all
project**: `CompanyCreateScreen`'s `INDUSTRIES` preset list and `ProductCreateScreen`'s `UNITS`
preset list are both free-text values stored verbatim in the entity (not a fixed backend enum
with separate keys/labels like status fields) — translating the *display* would silently change
the *stored* value depending on which language was active at creation time, so both are left
in Russian with an explanatory comment, matching how Project/Product status enums were already
handled in Round 13.

Remaining: Hotels, Dialogs/Telegram/WhatsApp/Chat, Telephony, Marketing, AI chat, Settings/Staff/
Departments/Auth, Helpdesk, Esign, EmailInbox, Automations, BI, CCP, AuditLog, TeamCalendar,
Duplicates — still ~90 screens. Continue via "продолжай".

## Round 12 (2026-09-14): design's own gaps audit (`mobile-app-gaps.html`) — found the design project ships a self-audit doc

Went looking for the requested remaining `mglass-*` files and found the project also has
`mobile-app-gaps.html` — a dated (8 сентября 2026) coverage audit written by the design side
itself, comparing all 178 web pages against the mobile screen registry (106 screens: 97 covered,
19 not started, 33 deliberately desktop-only). This is more authoritative than diffing JSX by eye,
so used it as the primary source for this round instead of continuing the file-by-file sweep.

Cross-checked every item still tagged "нет" (not started) as of that doc against the *current*
state of the repo (a lot has shipped since 8 Sept, across this whole 09-11→09-14 audit) and against
real backend availability:

**Real gap found and fixed: Telephony analytics.** The design flags `TelephonyAnalyticsPage` as
not started — confirmed still true: `TelephonyScreen.tsx` only called `GET /telephony/stats` (4
flat KPIs) and had no dedicated analytics screen. The backend already has a full
`GET /telephony/analytics` endpoint (`telephony-status.controller.ts` → `telephony.service.ts
getAnalytics()`, deliberately reachable even for tenants without the paid call add-on since it
blends in always-on SMS metrics) returning: KPIs (calls/SMS totals, pickup rate, SMS delivery
rate, avg call duration), a 30-day daily calls+SMS series, hourly call-load histogram (0-23),
per-manager calls+SMS breakdown, and AI sentiment analysis (positive/neutral/negative counts +
top negative topics) — none of it was wired into mobile. Built `TelephonyAnalyticsScreen.tsx`:
KPI grid, a `TapChart` two-series line (calls/SMS over 30 days), per-manager `FunnelBars`,
sentiment `FunnelBars` + top-negative-topics line, and an hourly-load bar histogram (plain Views,
no chart library needed for 24 static bars). Added `fetchTelephonyAnalytics()` to
`api/telephony.ts`, registered as `TelephonyAnalytics` in `TelephonyStack`, linked via a new
stats-chart icon button in `TelephonyScreen`'s header.

**Checked and correctly left alone:**
- `ProductModerationQueuePage`, `ProductLabelsPrintPage` — design's own doc puts these in "Фаза 6"
  (next phase, not yet prioritized even by the design side), and neither is chart/data-shaped —
  out of scope for this data/charts-focused round.
- `SeoPage`/`SmmPage` — design's own doc says the backend sections aren't finished yet; nothing to
  wire up.
- Workspace module (12 pages) and the client portal (5 pages) — both explicitly, deliberately
  out of scope per prior user decisions documented in the design's own doc ("по решению заказчика
  модуль целиком остаётся веб-только" / separate app).
- Account Center "active sessions / revoke / danger zone" — backend session management
  (`tenants.controller.ts` `GET/DELETE sessions`, `user-sessions.service.ts`) exists but is
  **owner-only, tenant-wide** (lists/revokes every staff member's sessions) — an admin capability,
  not the self-service "log out my other devices" the design's Account Center tab implies. Needs
  a product decision on scope/placement (Settings/Staff vs. Account Center) before building;
  flagged, not built this round.
- Unified search scope (orders/bookings/docs/messages, currently leads/projects/companies only)
  — real gap per the design doc but not chart/data-shaped, out of scope for this round.

Verified via `tsc --noEmit`, `expo export` (clean), and a release APK rebuild grepped for
`telephony/analytics` + `hourlyLoad` in the compiled Hermes bundle. APK re-copied to
`/root/lumiva-crm-mobile.apk`.

---

## 2026-09-21 — сверка данных сайт ↔ приложение (валюты, суммы, полнота списков, видимость разделов)

Метод: не сравнение вёрстки, а чтение того, что реально уходит бэкенду и что возвращается; проверка кода бэкенда (`sales.service.ts`, `product-analytics.service.ts`, `leads.service.ts`, `marketing.service.ts`), сверка с БД (только SELECT).

### Найдено и исправлено (все корни — «приложение не делает то же, что сайт»)

1. **Курсы валют не передавались бэкенду.** `/sales/analytics` в режиме `converted` берёт курсы ТОЛЬКО из параметра `rates` → продажи не в валюте отчёта = **0** (главная «Продажи за месяц», вкладка «Продажи» в Аналитике). `/products/analytics` без `rates` считает 1 TRY как 1 EUR (в ~56 раз завышение для тенантов с TRY-товарами). `/leads/roi` шёл в режиме `native` с «доминирующей валютой» — итог как сумма разных валют. Исправлено: `CurrencyModeContext` теперь отдаёт `fxParams`/`fxKey`/`ready` (тот же контракт, что шлёт сайт: `{currencyMode, displayCurrency, rates: JSON, [cur]: 1}`), экраны ждут `ready` и перезагружаются при смене валюты/режима.
2. **Маркетинг: `currency: 'MIXED'`.** Бэкенд суммирует cost/revenue по строкам разных валют и подписывает `MIXED` — приложение показывало «36 395 MIXED». Теперь Traffic/Campaigns/ChannelDetail конвертируют по строкам (у каждой своя валюта) в валюту отображения, как `convertMarketingAmount` на сайте.
3. **Списки обрезались пагинацией.** `/sales` по умолчанию `pageSize=25` — Продажи показывали максимум 25 заказов и считали счётчики/оборот по ним; `/projects` по умолчанию `limit=50`. `fetchSales` теперь идёт по всем страницам (200/стр, предохранитель 25 стр.), `fetchProjects` просит `limit=2000` одним запросом. **Не page-walk для проектов**: у не-владельцев бэкенд фильтрует «мои» проекты ПОСЛЕ пагинации, `total` и границы страниц ненадёжны.
4. **Нет скрытия разделов по тарифу/правам.** На сайте меню фильтруется `isComponentEnabled` (`/tenants/components`) + `canAccess` (`/rbac/*`, персональные overrides выигрывают у роли, owner видит всё). В приложении `fetchMenu` — мёртвый код, всё показывалось всем → сотрудник видел разделы, дающие 403. Добавлен `AccessContext` (та же логика, fail-open при ошибках, как на сайте), применён к «Ещё» (42 пункта, пустые группы скрываются) и к нижней панели.
5. **Провайдеры валюты монтировались до логина.** Запрос валют тенанта падал без токена и не повторялся после входа — дефолтная валюта тенанта подхватывалась только после перезапуска. Добавлен флаг `enabled` (перезагрузка при входе).
6. `fmt()` при отсутствии курса больше не подписывает «чужую» сумму символом валюты отображения — показывает в валюте записи (как `missingRate` на сайте).

### Найдено, НЕ исправлено (решение нужно / вне мобильного)

- **Отели, обзорные KPI (`/hotels/overview-kpis`)**: бэкенд суммирует брони в разных валютах (в БД у отелей USD/EUR/RUB) без указания валюты; сайт хардкодит `$`. Ошибка бэкенда+сайта, мобильный показывает число без символа. Нужно решение: конвертировать на бэкенде.
- **`/projects` для не-владельцев**: пост-фильтр «мои» после пагинации — на сайте тоже может терять проекты при >50 записей. Бэкенд.
- **Платежи**: список 50 последних (счётчик `total` верный) — оставлено.
- Числа везде форматируются `ru-RU` независимо от выбранного языка приложения — для раунда переводов.

### Проверка
`tsc --noEmit` (чисто, кроме давних ошибок `App.tsx`/`api/client.ts`), `expo export --platform android` собирается. На устройстве НЕ проверено — нужен release APK.

### 2026-09-21, продолжение (по решению пользователя)

- **Отели KPI — сделано, задеплоено (api пересобран `--no-cache`, фронт rsync, бэкап `crm-frontend-pre-hotel-currency-*`)**: `HotelsService.getOverviewKpis` конвертирует каждую бронь из валюты её отеля (`hotels.currency`; у брони своей валюты нет) в `tenant.primaryCurrency` через `CurrencyRatesService`, отдаёт `currency`. Сайт: убран хардкод `$` (overview KPI → валюта тенанта, карточка отеля и шапка деталей → валюта отеля, `Intl` по локали). Мобильное: `fmt(kpi, kpis.currency)`. Не проверено вызовом эндпоинта под реальным логином (нет тестового входа) — проверено: `tsc`, старт Nest (DI ок), код в `dist`.
- **Числа/даты по языку приложения**: новый `mobile/src/i18n/format.ts` (`appLocale()`, `formatDecimal`, `compactUnits`), `LanguageProvider` синхронно обновляет локаль в рендере. 101 `'ru-RU'` в 56 файлах → `appLocale()` (числа, даты, время), 8 `toFixed().replace('.',',')` → `formatDecimal`, «тыс/млн» → `K/M`/`B/Mn`. Новый код: не писать литерал локали и не вычислять `appLocale()` на уровне модуля (замёрзнет).

### 2026-09-21, раунд «поля»: кастомные поля + полнота полей сущностей

**Кастомные поля (`[object Object]`)**: сайт хранит `daterange` как `{start, end|null}` (`date` — `'YYYY-MM-DD'`, `datetime` — `'YYYY-MM-DDTHH:mm'`, `number` — число, `multiselect` — массив), приложение ждало `{from, to}` и падало в `String(obj)`. Переписан `CustomFieldsSection`: показ всех типов в форматах сайта (диапазон + число дней, локаль), редактирование датами через календарь (`DateCalendar`, `utils/dateValues.ts`), числа сохраняются числами, `required`/`helpText`, безопасный fallback без `String(object)`. Даты `'YYYY-MM-DD'` парсятся как ЛОКАЛЬНАЯ полночь (новый `Date(str)` = UTC → сдвиг дня).

**Метод аудита полей**: автоматическая матрица «поле бэкенд-сущности → читает ли API-слой мобилки → показывает ли экран → есть ли в форме» + сверка с тем, что реально сохраняет сайт (`ContactPage`/`CompanyPage`/`LeadFormPage`/`ProjectFormPage`). Целевой набор = поля сайта, а не все колонки (у контакта сайт не показывает `timezone/linkedin/telegram`).

**Сделано** (новые экраны редактирования — через `EntityFormShell`, переиспользуемый `LinkPicker` с поиском вместо `slice(0,20)`):
- Проект: `ProjectEditScreen` (название, описание, сумма+валюта, статус через отдельный endpoint, категория, теги из `/project-tags`, владельцы, лид/компания/контакт); деталь: владелец, лид/компания/контакт (переход), приоритет, заметки, обновлён; фокус-рефетч. Сумма/владельцы — по правам `projects_edit_amount`/`projects_edit_owner` (бэкенд иначе 403 весь PATCH).
- Контакт: `ContactEditScreen` (+страна, адрес, статус, ответственные, теги, паспорт в customFields — как на сайте).
- Компания: `CompanyEditScreen` (+юр.название, ИНН, стадия `type`, размер, страна, ответственные, теги).
- Лид: `LeadEditScreen` (+страна, источник, 5 UTM-колонок вместо `meta.utm_*`, сумма по `leads_edit_amount`, статус, ответственные, компания/контакт).
- Товар: `ProductEditScreen` (+штрихкод, цена со скидкой и период, единица, порог остатка, вес, габариты, теги); деталь: штрихкод/вес/габариты/период скидки. Остаток не редактируется (движения/склады).
- Продажа (деталь): клиент-ссылка, гость, агент, заезд/выезд, внешний ID.

**Найдено и исправлено попутно (реальные баги)**: создание лида в приложении писало ответственных ТОЛЬКО именами (`assignedToList`), без `assignedUserIds` — видимость записей по сотрудникам опирается на id (то же у контакта/компании — теперь пишутся оба). Кнопка «звезда» в шапке лида была мёртвой → теперь «Изменить».

**Не сделано / следующий раунд**: поля Бронирований и Отелей (не аудировались); кастомные поля товаров (`/products/field-defs`, отдельная система от `custom_fields`); история изменений проекта/лида без значений «было→стало» (сайт показывает); карточки/списки: колонки кастомных полей; формы «Создать» контакта/компании всё ещё короткие (полные — в редактировании); редактирование продажи (кроме статуса) и связанных проектов (`relatedProjectIds`), файла-брифа.

Проверка: `tsc` чисто, `expo export` собирается, форматтер дат прогнан кодом приложения на реальном значении из БД (ru/en/tr). На устройстве не проверено.

### 2026-09-21, добивка остатка раунда «поля»

- **Бронирования**: деталь + сотрудник/ресурс/клиент-ссылка/подтверждение, доп. поля, вкладка **Заметки** (`api/notes.ts` + `NotesSection`, `/notes`, RBAC `notes`), `BookingEditScreen` (те же поля, что «Редактировать бронь» на сайте; сервер сам проверяет конфликты). Услуги/ресурсы/локации — настройки, осознанно только на сайте.
- **Отели**: агентство и фактический заезд/выезд в брони, овербукинг и план выручки сезона в отеле. Себестоимость (`costPerNight/ppPerNight`) не показывается — как и у товаров.
- **Кастомные поля товаров** (`/products/field-defs`, отдельная система): `CustomFieldsSection` принимает `defs`, типы text/textarea/wysiwyg/number/date/datetime/boolean/select/radio/multiselect/url/colorpicker редактируются, media/gallery/relation/repeater — только показ. **Важно**: сервер пересобирает `customFields` товара из присланного и теряет пропущенные ключи → всегда слать объект целиком.
- **История «было → стало»**: `utils/changeFormat.ts` (`{changes:[{field,from,to}]}` бэкенда; кастомные поля по схеме, диапазон дат — как диапазон); подключено в проект и `ActivityFeed` (audit_log).
- **Формы создания контакта/компании = полные формы** (`ContactEditScreen`/`CompanyEditScreen` работают и как создание; старые короткие удалены, обязательное поле только имя — как на сайте, а не «ответственный + телефон» из макета).
- **Продажа**: `SaleEditScreen` — ровно то, что сохраняет сайт (статус, менеджеры, заметка, лид).
- **Проект**: связанные проекты (`LinkMultiPicker`), бриф; автоподстановка email/phone/url у пустых кастомных полей из лида/компании/файла.

**Сознательно не делалось**: колонки кастомных полей в списках (списки в приложении — карточки, не таблицы); значения `media/gallery/relation/repeater` товара; редактирование настроек бронирований/отелей (`desktopOnly` по продуктовому решению).
