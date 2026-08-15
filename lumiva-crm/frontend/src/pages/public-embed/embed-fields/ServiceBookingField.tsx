import React, { useEffect, useState } from 'react';
import { fetchPublicServices, type PublicBookingService } from '../../../api/publicBooking';
import type { EmbedFieldConfigItem } from '../../../api/embedForms';
import { compositeTokens, fieldLabelStyle, hintStyle, inputStyle } from './compositeFieldStyles';

export interface ServiceBookingValue {
  serviceId: string;
  startAt: string;
  endAt: string;
}

/** Составное поле "Услуга и время" (kind='booking') — выбор реальной услуги тенанта + дата/время.
 * startAt/endAt считаются на клиенте из выбранной услуги.durationMinutes, как в /store. */
export const ServiceBookingField: React.FC<{
  field: EmbedFieldConfigItem;
  clientKey: string;
  design: Record<string, unknown>;
  onChange: (value: ServiceBookingValue | null) => void;
}> = ({ field, clientKey, design: d, onChange }) => {
  const [services, setServices] = useState<PublicBookingService[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const t = compositeTokens(d);

  const allowed = field.sourceFilter?.serviceIds;

  useEffect(() => {
    fetchPublicServices(clientKey)
      .then((rows) => {
        const filtered = allowed?.length ? rows.filter((s) => allowed.includes(s.id)) : rows;
        setServices(filtered);
        if (filtered[0]) setServiceId(filtered[0].id);
      })
      .catch(() => {});
  }, [clientKey]);

  useEffect(() => {
    const service = services.find((s) => s.id === serviceId);
    if (!service || !date) {
      onChange(null);
      return;
    }
    const start = new Date(date);
    if (Number.isNaN(start.getTime())) {
      onChange(null);
      return;
    }
    const end = new Date(start.getTime() + service.durationMinutes * 60_000);
    onChange({ serviceId, startAt: start.toISOString(), endAt: end.toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, date, services]);

  const selected = services.find((s) => s.id === serviceId);

  return (
    <div style={{ width: '100%' }}>
      <div style={fieldLabelStyle(d)}>{field.label}</div>
      <select style={{ ...inputStyle(d), marginBottom: selected ? 6 : 10 }} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.durationMinutes} мин · {s.price} {s.currency}
          </option>
        ))}
      </select>
      {selected && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '3px 9px', background: t.field, border: `1px solid ${t.border}`, color: t.text }}>
            {selected.durationMinutes} мин
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '3px 9px', background: t.field, border: `1px solid ${t.border}`, color: t.text }}>
            {selected.price} {selected.currency}
          </span>
        </div>
      )}
      <input type="datetime-local" style={inputStyle(d)} value={date} onChange={(e) => setDate(e.target.value)} />
      {!services.length && <div style={hintStyle(d)}>Нет доступных услуг</div>}
    </div>
  );
};
