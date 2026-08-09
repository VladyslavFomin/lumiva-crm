import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { createBookingRequest, fetchLocations, fetchServices } from "../../../api/storeBooking";
import type { StoreBookingLocation, StoreBookingService } from "../../../api/storeBooking";
import { getApiErrorMessage } from "../../../api/publicClient";

const BookingRequestPage: React.FC = () => {
  const { clientKey = "" } = useParams<{ clientKey: string }>();
  const [services, setServices] = useState<StoreBookingService[]>([]);
  const [locations, setLocations] = useState<StoreBookingLocation[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchServices(clientKey).then((rows) => {
      setServices(rows);
      if (rows[0]) setServiceId(rows[0].id);
    });
    fetchLocations(clientKey).then((rows) => {
      setLocations(rows);
      if (rows[0]) setLocationId(rows[0].id);
    });
  }, [clientKey]);

  const selectedService = services.find((s) => s.id === serviceId);

  const submit = async () => {
    if (!serviceId || !locationId || !date || !name.trim()) {
      setError("Заполните услугу, филиал, дату/время и имя");
      return;
    }
    const startAt = new Date(date);
    const endAt = new Date(startAt.getTime() + (selectedService?.durationMinutes || 60) * 60_000);
    setSubmitting(true);
    setError(null);
    try {
      await createBookingRequest(clientKey, {
        serviceId,
        locationId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        customerName: name,
        customerPhone: phone || undefined,
        customerEmail: email || undefined,
      });
      setDone(true);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <StoreLayout title="Бронирование">
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 max-w-md">
          <div className="text-emerald-700 font-semibold mb-2">Заявка отправлена</div>
          <p className="text-sm text-stone-600">Мы получили вашу заявку на запись — она появилась в панели и ожидает подтверждения.</p>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout title="Запись на услугу">
      <div className="rounded-2xl border border-amber-200 bg-white shadow-lumiva p-5 max-w-md">
        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 mb-3 text-sm">{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Услуга</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm">
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMinutes} мин · {s.price} {s.currency}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Филиал</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Дата и время</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
            />
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="mt-4 w-full rounded-full bg-amber-500 text-white font-medium py-2.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {submitting ? "Отправляем…" : "Записаться"}
        </button>
      </div>
    </StoreLayout>
  );
};

export default BookingRequestPage;
