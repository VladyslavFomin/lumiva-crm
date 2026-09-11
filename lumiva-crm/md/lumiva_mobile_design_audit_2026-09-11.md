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
