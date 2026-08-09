import React, { useEffect, useState } from 'react';
import { fetchPublicServices, type PublicBookingService } from '../../../api/publicBooking';
import type { EmbedFieldConfigItem } from '../../../api/embedForms';

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

  const border = String(d.borderColor || '#e5e7eb');
  const radius = Number(d.borderRadiusPx || 8);
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: String(d.fieldBackground || '#f9fafb'),
    border: `1px solid ${border}`,
    color: d.textColor as string,
    borderRadius: radius,
    padding: Number(d.fieldPaddingPx || 12),
    boxSizing: 'border-box',
  };

  const selected = services.find((s) => s.id === serviceId);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontWeight: Number(d.labelWeight) || 600, fontSize: 13, marginBottom: 8 }}>
        {field.label}
      </div>
      <select style={{ ...inputStyle, marginBottom: 8 }} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.durationMinutes} мин · {s.price} {s.currency}
          </option>
        ))}
      </select>
      {selected && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
          {selected.durationMinutes} мин, {selected.price} {selected.currency}
        </div>
      )}
      <input type="datetime-local" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      {!services.length && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Нет доступных услуг</div>}
    </div>
  );
};
