import React, { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { createReservation } from "../../../api/storeHotels";
import { getApiErrorMessage } from "../../../api/publicClient";

const HotelBookingPage: React.FC = () => {
  const { clientKey = "" } = useParams<{ clientKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hotelId = searchParams.get("hotelId") || "";
  const roomTypeId = searchParams.get("roomTypeId") || "";
  const occupancyTypeId = searchParams.get("occupancyTypeId") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const pax = Number(searchParams.get("pax") || "1");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Укажите имя и email гостя");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const reservation = await createReservation(clientKey, {
        hotelId,
        roomTypeId,
        occupancyTypeId,
        checkIn,
        checkOut,
        guestName: name,
        guestEmail: email,
        guestPhone: phone || undefined,
        pax,
        notes: notes || undefined,
      });
      navigate(`/store/${clientKey}/hotels/pay/${reservation.id}?bookingCode=${reservation.bookingCode}&total=${reservation.total}&currency=${reservation.currency}&email=${encodeURIComponent(email)}`);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StoreLayout title="Данные гостя">
      <div className="text-sm text-stone-500 mb-4">
        {checkIn} → {checkOut} · {pax} гостей
      </div>
      <div className="rounded-2xl border border-amber-200 bg-white shadow-lumiva p-5 max-w-md">
        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 mb-3 text-sm">{error}</div>}
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя гостя" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Пожелания (необязательно)"
            rows={3}
            className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="mt-4 w-full rounded-full bg-amber-500 text-white font-medium py-2.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {submitting ? "Бронируем…" : "Продолжить к оплате"}
        </button>
      </div>
    </StoreLayout>
  );
};

export default HotelBookingPage;
