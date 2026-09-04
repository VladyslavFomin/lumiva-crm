import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPublicHotel, searchPublicHotels, type PublicHotelDetail, type PublicHotelSearchResult } from '../../../api/publicHotels';
import type { EmbedFieldConfigItem } from '../../../api/embedForms';
import { checkMark, compositeTokens, fieldLabelStyle, hintStyle, inputStyle, optionCardStyle, primaryButtonStyle } from './compositeFieldStyles';

export interface HotelBookingValue {
  hotelId: string;
  roomTypeId: string;
  occupancyTypeId: string;
  checkIn: string;
  checkOut: string;
  pax: number;
}

function todayPlus(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Составное поле "Отель и даты" (kind='hotel_reservation') — клиент сам выбирает отель прямо в
 * форме (подтверждено пользователем в plan mode), затем даты → живой поиск → номер → размещение.
 * Переиспользует ровно те же /public/hotels/:clientKey/* эндпоинты, что и /store на pl1. */
export const HotelBookingField: React.FC<{
  field: EmbedFieldConfigItem;
  clientKey: string;
  design: Record<string, unknown>;
  onChange: (value: HotelBookingValue | null) => void;
}> = ({ field, clientKey, design: d, onChange }) => {
  const { t } = useTranslation();
  const ef = (key: string, opts?: Record<string, unknown>) => t(`crm.embedFields.hotelBooking.${key}`, opts as any) as string;
  const [hotels, setHotels] = useState<Array<{ id: string; name: string }>>([]);
  const [hotelId, setHotelId] = useState('');
  const [checkIn, setCheckIn] = useState(todayPlus(7));
  const [checkOut, setCheckOut] = useState(todayPlus(10));
  const [pax, setPax] = useState(2);
  const [results, setResults] = useState<PublicHotelSearchResult[]>([]);
  const [detail, setDetail] = useState<PublicHotelDetail | null>(null);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [occupancyTypeId, setOccupancyTypeId] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const allowed = field.sourceFilter?.hotelIds;
  const t2 = compositeTokens(d);

  useEffect(() => {
    // Список отелей идёт из результатов поиска на широком диапазоне дат — переиспользуем /search
    // вместо отдельного публичного эндпоинта списка отелей, которого у нас для формы нет смысла
    // дублировать: если поиск ничего не нашёл на дефолтные даты, просто покажем пустой список.
    searchPublicHotels(clientKey, todayPlus(1), todayPlus(2))
      .then((rows) => {
        const seen = new Map<string, string>();
        rows.forEach((r) => seen.set(r.hotelId, r.hotelName));
        let list = Array.from(seen, ([id, name]) => ({ id, name }));
        if (allowed?.length) list = list.filter((h) => allowed.includes(h.id));
        setHotels(list);
        if (list[0]) setHotelId(list[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientKey]);

  useEffect(() => {
    if (!hotelId) return;
    fetchPublicHotel(clientKey, hotelId).then(setDetail).catch(() => setDetail(null));
    setRoomTypeId('');
    setOccupancyTypeId('');
    setResults([]);
    setHasSearched(false);
  }, [clientKey, hotelId]);

  useEffect(() => {
    if (!roomTypeId || !occupancyTypeId || !checkIn || !checkOut) {
      onChange(null);
      return;
    }
    onChange({ hotelId, roomTypeId, occupancyTypeId, checkIn, checkOut, pax });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, roomTypeId, occupancyTypeId, checkIn, checkOut, pax]);

  const search = () => {
    if (!checkIn || !checkOut) return;
    setSearching(true);
    setRoomTypeId('');
    setOccupancyTypeId('');
    searchPublicHotels(clientKey, checkIn, checkOut, pax)
      .then((rows) => setResults(rows.filter((r) => r.hotelId === hotelId)))
      .catch(() => setResults([]))
      .finally(() => {
        setSearching(false);
        setHasSearched(true);
      });
  };

  const selectedRoomType = useMemo(() => detail?.roomTypes.find((r) => r.id === roomTypeId), [detail, roomTypeId]);

  return (
    <div style={{ width: '100%' }}>
      <div style={fieldLabelStyle(d)}>{field.label}</div>

      <select style={{ ...inputStyle(d), marginBottom: 10 }} value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
        {hotels.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
      {!hotels.length && <div style={hintStyle(d)}>{ef('noHotels')}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 130px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.03em' }}>{ef('checkInLabel')}</span>
          <input type="date" style={inputStyle(d)} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <label style={{ flex: '1 1 130px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.03em' }}>{ef('checkOutLabel')}</span>
          <input type="date" style={inputStyle(d)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
        <label style={{ width: 72, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.03em' }}>{ef('guestsLabel')}</span>
          <input type="number" min={1} style={inputStyle(d)} value={pax} onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <button type="button" onClick={search} disabled={searching || !hotelId} style={primaryButtonStyle(d, searching || !hotelId)}>
          {searching ? ef('searchingBtn') : ef('searchBtn')}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          {results.map((r) => {
            const selected = roomTypeId === r.roomTypeId;
            return (
              <button key={r.roomTypeId} type="button" onClick={() => setRoomTypeId(r.roomTypeId)} style={optionCardStyle(d, selected)}>
                <span style={checkMark(d, selected)}>{selected ? '✓' : ''}</span>
                <span style={{ display: 'grid', gap: 2, textAlign: 'left', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 650, color: t2.text, fontSize: 13 }}>{r.roomTypeName}</span>
                  <span style={{ fontSize: 11.5, opacity: 0.65, color: t2.text }}>{ef('fromPricePerNightFormat', { price: r.pricePerNight, currency: r.currency })} · {ef('nightsShortFormat', { count: r.nights })}</span>
                </span>
                <span style={{ fontWeight: 700, color: t2.text, fontSize: 13, whiteSpace: 'nowrap' }}>{r.total} {r.currency}</span>
              </button>
            );
          })}
        </div>
      )}
      {!searching && !hasSearched && results.length === 0 && detail && (
        <div style={hintStyle(d)}>{ef('pressSearchHint')}</div>
      )}
      {!searching && hasSearched && results.length === 0 && (
        <div style={hintStyle(d)}>{ef('noRoomsForDates')}</div>
      )}

      {selectedRoomType && selectedRoomType.occupancyTypes.length > 0 && (
        <select style={inputStyle(d)} value={occupancyTypeId} onChange={(e) => setOccupancyTypeId(e.target.value)}>
          <option value="">{ef('chooseOccupancy')}</option>
          {selectedRoomType.occupancyTypes.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
};
