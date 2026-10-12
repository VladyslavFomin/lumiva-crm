/**
 * Ресепшн / бронирования для ИИ-отдела: брони модуля «Бронирования» (reservations) и гостиничные брони
 * («Отели», hotel_reservations). Время показываем в часовом поясе отдела — модель не пересчитывает UTC.
 * Без зависимостей от сервисов: используется пакетом данных отдела, программами и проверками действий.
 */
type Q = { query: (sql: string, params?: unknown[]) => Promise<any[]> };

export type BookingKind = 'booking' | 'hotel';

/** Заявка/событие про конкретную бронь: тип записи → вид брони. */
export function bookingKindOf(entityType: string | null | undefined): BookingKind | null {
  if (entityType === 'reservation' || entityType === 'booking') return 'booking';
  if (entityType === 'hotel_reservation') return 'hotel';
  return null;
}

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Получатель и данные брони — для письма гостю и проверок. */
export async function bookingContact(db: Q, tenantId: string, kind: BookingKind, id: string): Promise<{ id: string; name: string; email: string | null; leadId: string | null; status: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows =
    kind === 'booking'
      ? await db.query(
          `SELECT r.id, COALESCE(NULLIF(r."customerName", ''), c."fullName", l.name, '') name, COALESCE(NULLIF(r."customerEmail", ''), NULLIF(c.email, ''), l.email) email, r."leadId" lead_id, r.status
             FROM reservations r LEFT JOIN contacts c ON c.id = r."contactId" LEFT JOIN leads l ON l.id = r."leadId"
            WHERE r."tenantId" = $1 AND r.id::text = $2`,
          [tenantId, id],
        )
      : await db.query(`SELECT id, "guestName" name, NULLIF("guestEmail", '') email, NULL lead_id, status FROM hotel_reservations WHERE "tenantId" = $1 AND id::text = $2`, [tenantId, id]);
  const r = rows[0];
  return r ? { id: r.id, name: String(r.name ?? ''), email: r.email ? String(r.email).trim() : null, leadId: r.lead_id ?? null, status: r.status } : null;
}

/** Ближайшие брони и заезды + конкретная бронь задачи — блок для промпта. */
export async function receptionPack(db: Q, tenantId: string, tz: string, focus: { kind: BookingKind; id: string } | null): Promise<string> {
  const out: string[] = [];
  const fmt = `'YYYY-MM-DD HH24:MI'`;
  if (focus?.kind === 'booking') {
    const [r] = await db.query(
      `SELECT r.id, to_char(r."startAt" AT TIME ZONE $3, ${fmt}) starts, to_char(r."endAt" AT TIME ZONE $3, ${fmt}) ends, r.status, r."confirmationStatus" conf, r."paymentStatus" pay,
              r.price, r.currency, r.participants, r.source, s.name service, COALESCE(NULLIF(r."customerName", ''), c."fullName", l.name) customer,
              COALESCE(NULLIF(r."customerEmail", ''), c.email, l.email) email, COALESCE(NULLIF(r."customerPhone", ''), c.phone, l.phone) phone, r."leadId" lead_id
         FROM reservations r LEFT JOIN booking_services s ON s.id = r."serviceId" LEFT JOIN contacts c ON c.id = r."contactId" LEFT JOIN leads l ON l.id = r."leadId"
        WHERE r."tenantId" = $1 AND r.id::text = $2`,
      [tenantId, focus.id, tz],
    );
    if (r) {
      const act: any[] = await db.query(`SELECT type, description, "createdAt" at FROM reservation_activity WHERE "reservationId" = $1 ORDER BY "createdAt" DESC LIMIT 10`, [r.id]).catch(() => []);
      out.push(
        `THIS BOOKING (kind "booking", id ${r.id}): ${clip(r.service, 80) || 'service'} · ${r.starts} — ${r.ends} (${tz}) · status ${r.status} · confirmation ${r.conf} · payment ${r.pay}${r.price ? ` · ${r.price} ${r.currency ?? ''}` : ''} · ${r.participants} pers. · source ${r.source}\n` +
          `Client: ${clip(r.customer, 80)} · email ${r.email ? 'yes' : 'NO'} · phone ${r.phone ? 'yes' : 'no'}${r.lead_id ? ` · leadId ${r.lead_id}` : ''}` +
          (act.length ? `\nHistory: ${act.map((a) => `${new Date(a.at).toISOString().slice(0, 10)} ${clip(a.description || a.type, 80)}`).join('; ')}` : ''),
      );
    }
  }
  if (focus?.kind === 'hotel') {
    const [h] = await db.query(
      `SELECT r.id, r."guestName" guest, r."checkIn" ci, r."checkOut" co, r.status, r."paidStatus" paid, r.total, r.pax, r.market, r."bookingCode" code, r.notes,
              r."guestEmail" email, r."guestPhone" phone, ho.name hotel, ho.currency, ho."checkInTime" cit, ho."checkOutTime" cot, rt.name room
         FROM hotel_reservations r JOIN hotels ho ON ho.id = r."hotelId" LEFT JOIN hotel_room_types rt ON rt.id = r."roomTypeId"
        WHERE r."tenantId" = $1 AND r.id::text = $2`,
      [tenantId, focus.id],
    );
    if (h) {
      out.push(
        `THIS HOTEL BOOKING (kind "hotel", id ${h.id}): ${clip(h.hotel, 60)} · ${clip(h.room, 60)} · check-in ${h.ci}${h.cit ? ` from ${h.cit}` : ''} · check-out ${h.co}${h.cot ? ` until ${h.cot}` : ''} · status ${h.status} · paid ${h.paid} · total ${h.total} ${h.currency ?? ''} · ${h.pax} pax${h.code ? ` · code ${h.code}` : ''}\n` +
          `Guest: ${clip(h.guest, 80)} · email ${h.email ? 'yes' : 'NO'} · phone ${h.phone ? 'yes' : 'no'}${h.notes ? `\nNotes: ${clip(h.notes, 400)}` : ''}`,
      );
    }
  }
  // задача про конкретную бронь — только она, без списка остальных (иначе модель путает гостей)
  if (focus && out.length) return `RECEPTION DATA (the booking of this task; times are local, ${tz}; act ONLY on this booking — use exactly this id and kind):\n${out.join('\n\n')}`;
  const upcoming: any[] = await db.query(
    `SELECT r.id, to_char(r."startAt" AT TIME ZONE $2, ${fmt}) starts, r.status, r."confirmationStatus" conf, s.name service, COALESCE(NULLIF(r."customerName", ''), c."fullName", l.name) customer,
            (COALESCE(NULLIF(r."customerEmail", ''), c.email, l.email) IS NOT NULL) has_email
       FROM reservations r LEFT JOIN booking_services s ON s.id = r."serviceId" LEFT JOIN contacts c ON c.id = r."contactId" LEFT JOIN leads l ON l.id = r."leadId"
      WHERE r."tenantId" = $1 AND r."startAt" BETWEEN now() - interval '1 day' AND now() + interval '7 days'
        AND r.status IN ('draft','pending','confirmed','checked_in','in_progress')
      ORDER BY r."startAt" LIMIT 30`,
    [tenantId, tz],
  );
  if (upcoming.length) {
    out.push(
      `BOOKINGS from yesterday to +7 days (${tz}):\n` +
        upcoming.map((r) => `- booking ${r.id} · ${r.starts} · ${clip(r.service, 50)} · ${clip(r.customer, 50)} · ${r.status}${r.conf === 'pending' ? ' · NOT CONFIRMED' : ''}${r.has_email ? '' : ' · no email'}`).join('\n'),
    );
  }
  const hotel: any[] = await db.query(
    `SELECT r.id, r."guestName" guest, r."checkIn" ci, r."checkOut" co, r.status, ho.name hotel, (NULLIF(r."guestEmail", '') IS NOT NULL) has_email
       FROM hotel_reservations r JOIN hotels ho ON ho.id = r."hotelId"
      WHERE r."tenantId" = $1 AND r.status IN ('pending','confirmed','checked_in')
        AND (r."checkIn"::date BETWEEN current_date - 1 AND current_date + 7 OR r."checkOut"::date BETWEEN current_date - 1 AND current_date + 2 OR r.status = 'checked_in')
      ORDER BY r."checkIn" LIMIT 30`,
    [tenantId],
  );
  if (hotel.length) {
    out.push(`HOTEL arrivals / in-house / departures:\n${hotel.map((h) => `- hotel ${h.id} · ${clip(h.hotel, 40)} · ${clip(h.guest, 50)} · ${h.ci} → ${h.co} · ${h.status}${h.has_email ? '' : ' · no email'}`).join('\n')}`);
  }
  if (!out.length) return 'BOOKINGS: nothing booked for the next 7 days.';
  return `RECEPTION DATA (real bookings; times are local, ${tz}; message guests only with send_booking_message, change bookings only with booking_update):\n${out.join('\n\n')}`;
}

/** Программы ресепшена: кого напомнить завтра, кто не пришёл, что ждёт подтверждения, у кого попросить отзыв. */
export async function receptionQueues(db: Q, tenantId: string) {
  const tomorrow: any[] = await db.query(
    `SELECT 'booking' kind, r.id FROM reservations r
      WHERE r."tenantId" = $1 AND r.status IN ('pending','confirmed') AND r."startAt" BETWEEN now() + interval '12 hours' AND now() + interval '36 hours'
        AND COALESCE(NULLIF(r."customerEmail", ''), (SELECT email FROM contacts WHERE id = r."contactId"), (SELECT email FROM leads WHERE id = r."leadId")) IS NOT NULL
     UNION ALL
     SELECT 'hotel', h.id FROM hotel_reservations h
      WHERE h."tenantId" = $1 AND h.status IN ('pending','confirmed') AND h."checkIn"::date = current_date + 1 AND NULLIF(h."guestEmail", '') IS NOT NULL
     LIMIT 25`,
    [tenantId],
  );
  const noShow: any[] = await db.query(
    `SELECT 'booking' kind, id FROM reservations WHERE "tenantId" = $1 AND status = 'confirmed' AND "startAt" BETWEEN now() - interval '2 days' AND now() - interval '2 hours' LIMIT 15`,
    [tenantId],
  );
  const unconfirmed: any[] = await db.query(
    `SELECT 'booking' kind, id FROM reservations WHERE "tenantId" = $1 AND (status = 'pending' OR "confirmationStatus" = 'pending') AND status NOT IN ('cancelled_by_customer','cancelled_by_business','rejected','no_show','completed')
        AND "createdAt" < now() - interval '2 hours' AND "startAt" > now()
     UNION ALL
     SELECT 'hotel', id FROM hotel_reservations WHERE "tenantId" = $1 AND status = 'pending' AND "createdAt" < now() - interval '2 hours' AND "checkIn"::date >= current_date
     LIMIT 15`,
    [tenantId],
  );
  const review: any[] = await db.query(
    `SELECT 'booking' kind, r.id FROM reservations r
      WHERE r."tenantId" = $1 AND r.status = 'completed' AND r."endAt" BETWEEN now() - interval '3 days' AND now() - interval '3 hours'
        AND COALESCE(NULLIF(r."customerEmail", ''), (SELECT email FROM contacts WHERE id = r."contactId"), (SELECT email FROM leads WHERE id = r."leadId")) IS NOT NULL
     UNION ALL
     SELECT 'hotel', h.id FROM hotel_reservations h
      WHERE h."tenantId" = $1 AND h.status = 'checked_out' AND COALESCE(h."checkedOutAt", h."checkOut"::timestamptz) BETWEEN now() - interval '3 days' AND now() - interval '3 hours'
        AND NULLIF(h."guestEmail", '') IS NOT NULL
     LIMIT 25`,
    [tenantId],
  );
  const ids = (rows: any[]) => rows.map((r) => ({ kind: r.kind as BookingKind, id: String(r.id) }));
  return { tomorrow: ids(tomorrow), noShow: ids(noShow), unconfirmed: ids(unconfirmed), review: ids(review) };
}

/** Переменные шаблона письма гостю — из самой брони (модель их не пишет). */
export async function bookingVars(db: Q, tenantId: string, kind: BookingKind, id: string, tz: string): Promise<Record<string, string> | null> {
  if (kind === 'booking') {
    const [r] = await db.query(
      `SELECT COALESCE(NULLIF(r."customerName", ''), c."fullName", l.name, '') guest, to_char(r."startAt" AT TIME ZONE $3, 'DD.MM.YYYY') d, to_char(r."startAt" AT TIME ZONE $3, 'HH24:MI') t,
              COALESCE(s.name, '') service, COALESCE(loc.name, '') place, COALESCE(loc.address, '') address
         FROM reservations r LEFT JOIN booking_services s ON s.id = r."serviceId" LEFT JOIN booking_locations loc ON loc.id = r."locationId"
         LEFT JOIN contacts c ON c.id = r."contactId" LEFT JOIN leads l ON l.id = r."leadId"
        WHERE r."tenantId" = $1 AND r.id::text = $2`,
      [tenantId, id, tz],
    );
    return r ? { guest_name: r.guest, date: r.d, time: r.t, service: r.service, place: r.place, address: r.address } : null;
  }
  const [h] = await db.query(
    `SELECT r."guestName" guest, to_char(r."checkIn"::date, 'DD.MM.YYYY') d, COALESCE(ho."checkInTime", '') t, COALESCE(rt.name, '') service, ho.name place, COALESCE(ho.address, '') address
       FROM hotel_reservations r JOIN hotels ho ON ho.id = r."hotelId" LEFT JOIN hotel_room_types rt ON rt.id = r."roomTypeId"
      WHERE r."tenantId" = $1 AND r.id::text = $2`,
    [tenantId, id],
  );
  return h ? { guest_name: h.guest, date: h.d, time: String(h.t).slice(0, 5), service: h.service, place: h.place, address: h.address } : null;
}

/** Подставить переменные; пустые убираем вместе с висящими разделителями («, » в конце строки). */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return String(text ?? '')
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => vars[k] ?? '')
    .replace(/[ \t]*,[ \t]*(?=\n|$)/g, '')
    .replace(/—[ \t]*,[ \t]*/g, '— ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
