import React, { useState } from "react";
import { useParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { lookupReservation } from "../../../api/storeHotels";
import { getApiErrorMessage } from "../../../api/publicClient";

const HotelLookupPage: React.FC = () => {
  const { clientKey = "" } = useParams<{ clientKey: string }>();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [reservation, setReservation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!code.trim() || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await lookupReservation(clientKey, code.trim(), email.trim());
      setReservation(result);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setReservation(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <StoreLayout title="Моя бронь">
      <div className="rounded-2xl border border-amber-200 bg-white shadow-lumiva p-5 max-w-md mb-6">
        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 mb-3 text-sm">{error}</div>}
        <div className="space-y-3">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код брони (RES-XXXXXXXX)" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email гостя" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
        </div>
        <button
          onClick={search}
          disabled={loading}
          className="mt-4 w-full rounded-full bg-amber-500 text-white font-medium py-2.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {loading ? "Ищем…" : "Найти бронь"}
        </button>
      </div>

      {reservation && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 max-w-md text-sm text-stone-700 space-y-1">
          <div className="font-semibold text-emerald-700 mb-1">{reservation.bookingCode}</div>
          <div>{reservation.hotelName}</div>
          <div>{reservation.roomTypeName}</div>
          <div>
            {reservation.checkIn} → {reservation.checkOut}
          </div>
          <div>Гость: {reservation.guestName}</div>
          <div>Статус: {reservation.status}</div>
          <div className="font-semibold pt-2">
            {reservation.total} {reservation.currency} · {reservation.paidStatus}
          </div>
        </div>
      )}
    </StoreLayout>
  );
};

export default HotelLookupPage;
