import React, { useEffect, useMemo, useState } from 'react';
import { fetchPublicHotel, searchPublicHotels, type PublicHotelDetail, type PublicHotelSearchResult } from '../../../api/publicHotels';
import type { EmbedFieldConfigItem } from '../../../api/embedForms';

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

  const border = String(d.borderColor || '#e5e7eb');
  const radius = Number(d.borderRadiusPx || 8);
  const accent = String(d.accentColor || '#2563eb');
  const inputStyle: React.CSSProperties = {
    background: String(d.fieldBackground || '#f9fafb'),
    border: `1px solid ${border}`,
    color: d.textColor as string,
    borderRadius: radius,
    padding: Number(d.fieldPaddingPx || 12),
    boxSizing: 'border-box',
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontWeight: Number(d.labelWeight) || 600, fontSize: 13, marginBottom: 8 }}>
        {field.label}
      </div>

      <select style={{ ...inputStyle, width: '100%', marginBottom: 8 }} value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
        {hotels.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
      {!hotels.length && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Нет доступных отелей</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input type="date" style={{ ...inputStyle, flex: '1 1 120px' }} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        <input type="date" style={{ ...inputStyle, flex: '1 1 120px' }} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        <input type="number" min={1} style={{ ...inputStyle, width: 70 }} value={pax} onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))} />
        <button
          type="button"
          onClick={search}
          disabled={searching || !hotelId}
          style={{ borderRadius: 999, padding: '0 16px', fontSize: 13, fontWeight: 600, background: accent, color: '#fff', border: 'none' }}
        >
          {searching ? '…' : 'Найти'}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          {results.map((r) => (
            <button
              key={r.roomTypeId}
              type="button"
              onClick={() => setRoomTypeId(r.roomTypeId)}
              style={{
                textAlign: 'left',
                border: `1px solid ${roomTypeId === r.roomTypeId ? accent : border}`,
                borderRadius: radius,
                padding: 10,
                background: roomTypeId === r.roomTypeId ? String(d.fieldBackground || '#f9fafb') : 'transparent',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r.roomTypeName}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>от {r.pricePerNight} {r.currency}/ночь · {r.nights} ноч. · {r.total} {r.currency}</div>
            </button>
          ))}
        </div>
      )}
      {!searching && !hasSearched && results.length === 0 && detail && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Нажмите «Найти», чтобы увидеть свободные номера</div>
      )}
      {!searching && hasSearched && results.length === 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>На эти даты свободных номеров нет</div>
      )}

      {selectedRoomType && selectedRoomType.occupancyTypes.length > 0 && (
        <select style={inputStyle} value={occupancyTypeId} onChange={(e) => setOccupancyTypeId(e.target.value)}>
          <option value="">Выберите размещение</option>
          {selectedRoomType.occupancyTypes.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
};
