import React, { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { payReservation } from "../../../api/storeHotels";
import { getApiErrorMessage } from "../../../api/publicClient";

const HotelPaymentPage: React.FC = () => {
  const { clientKey = "", reservationId = "" } = useParams<{ clientKey: string; reservationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingCode = searchParams.get("bookingCode") || "";
  const total = searchParams.get("total") || "";
  const currency = searchParams.get("currency") || "";
  const email = searchParams.get("email") || "";

  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/29");
  const [cvc, setCvc] = useState("123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await payReservation(clientKey, reservationId);
      navigate(`/store/${clientKey}/hotels/confirmation/${bookingCode}?email=${encodeURIComponent(email)}`);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StoreLayout title="Оплата">
      <div className="rounded-2xl border border-amber-200 bg-white shadow-lumiva p-5 max-w-md">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm">
          Бронь <span className="font-medium">{bookingCode}</span> · К оплате{" "}
          <span className="font-semibold">
            {total} {currency}
          </span>
        </div>
        <p className="text-xs text-stone-500 mb-4">Тестовая оплата — данные карты нигде не сохраняются и не проверяются.</p>
        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 mb-3 text-sm">{error}</div>}
        <div className="space-y-3">
          <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="Номер карты" className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm font-mono" />
          <div className="flex gap-3">
            <input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="ММ/ГГ" className="w-1/2 rounded-xl border border-amber-300 px-3 py-2 text-sm font-mono" />
            <input value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="CVC" className="w-1/2 rounded-xl border border-amber-300 px-3 py-2 text-sm font-mono" />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="mt-4 w-full rounded-full bg-amber-500 text-white font-medium py-2.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {submitting ? "Оплачиваем…" : `Оплатить ${total} ${currency}`}
        </button>
      </div>
    </StoreLayout>
  );
};

export default HotelPaymentPage;
