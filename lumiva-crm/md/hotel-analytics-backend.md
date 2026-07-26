# Hotel Analytics — Backend Requirements

Backend spec for `hotel-analytics.html`. Frontend is built with demo/mock data; every section below needs a real endpoint.

## Scope & Filters

**Endpoint:** `GET /api/hotels/analytics`

Query params:
- `hotel_ids[]` — one or more hotel IDs, or omit/`all` for aggregate across all hotels
- `room_type_id` — optional, filter to one room type
- `date_from`, `date_to` — season/report period (arrival date range)
- `market_id` — optional
- `agency_id` — optional

All sections below should respect these filters simultaneously (AND logic).

## 1. KPI cards
- `occupancy_now_pct` — current occupancy % for filtered scope
- `rooms_available` / `rooms_total`
- `revenue_sold` (sum of confirmed + partially-paid bookings' final price)
- `rooms_needed_per_day` — see Pacing calc below

## 2. Pacing chart + target curve
Need per-booking-date time series: for each day-before-arrival bucket (90/60/30/14/7/0), cumulative % of inventory sold **at the time each bucket was reached**, computed retrospectively from `booking.created_at` vs `booking.checkin_date`.

Target curve is currently hardcoded (10/40/65/80/92/100%) — should become a per-hotel or per-season configurable setting: `season_pacing_targets` table (`hotel_id`, `days_before_arrival`, `target_pct`).

## 3. Pickup / pacing table
For each bucket: `target_pct`, `actual_pct`, `gap_pct`, `rooms_needed_per_day`.

**Rollover logic (important):** if a bucket's target isn't met, the shortfall carries forward and increases the daily ask for the *next* bucket — not a flat recompute. Backend should expose either:
- raw daily sold-counts so frontend can compute, or
- pre-computed `rooms_needed_per_day` per bucket using the rollover formula:
  `needed_day[n] = (target_rooms[n] - actual_sold_rooms[n] + carryover[n-1]) / days_remaining[n]`

## 4. Arrival-date heatmap
`GET /api/hotels/analytics/arrivals?date_from&date_to&hotel_ids[]`
Returns per-day: `date`, `occupancy_pct`, `risk_level` (derive via threshold: <45% bad, 45–64% warn, ≥65% ok — thresholds should be a tenant setting, not hardcoded).

## 5. Revenue funnel (plan/actual/pending/remaining)
- `plan_revenue` — season target, editable per hotel (new setting needed: `hotel.season_revenue_target`)
- `actual_revenue` — sum of paid bookings
- `pending_revenue` — sum of confirmed-but-unpaid/partial bookings
- `remaining_revenue` = plan − actual − pending
- `max_possible_revenue` — 100% occupancy × current rate calendar, for the "Максимум сезона" line

## 6. Room-type breakdown table
Per room type: `qty_total`, `qty_sold`, `occupancy_pct`, `adr` (average daily rate), `avg_guests_per_booking`, `revenue`.

## 7. Revenue by market
Per market (`internal`, `DE`, `RU`, `UK`, etc.): `revenue_actual`, `revenue_target`, `rooms_sold`. Needs `booking.market_id` FK (already implied by pricing-by-market feature) joined with `market.revenue_target` (new field, settable in Цены и рынки).

## 8. Sales by agency/channel
Per agency/OTA/direct channel: `bookings_count`, `revenue`, `avg_rate`, `share_pct` (of total bookings or revenue — confirm which). Requires `booking.agency_id` FK → new `agencies` table (`id`, `name`, `type`: tour_operator | ota | direct).

## 9. Guest demographics
Per filtered scope: `adults_count`, `children_count` (3–17), `infants_count` (0–2), `avg_guests_per_booking`, and age-bucket breakdown (`0–2`, `3–6`, `7–11`, `12–17`).
Requires booking guest records to carry per-guest `age` or `age_category`, not just a total pax count — if current schema only stores total adults/children counts without ages, age-bucket breakdown needs a schema change (`booking_guests` table with `age` or `birth_date` per guest).

## Notes
- All monetary values in the response should include currency code (multi-market pricing means mixed currencies possible; recommend normalizing to hotel's base currency server-side and returning both raw + normalized).
- Recommend caching aggregates (hourly) since this page aggregates across bookings, pricing, and guest tables — not built for real-time per-request computation at scale.
