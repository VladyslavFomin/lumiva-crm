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

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // настоящая оплата: страница оплаты брони в CRM → платёжная система отеля
      const r = await payReservation(clientKey, reservationId);
      window.location.href = r.url;
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
        <p className="text-xs text-stone-500 mb-4">Оплата картой на странице платёжной системы отеля. Без подключённой платёжной системы оплатить нельзя.</p>
        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 mb-3 text-sm">{error}</div>}
        <button
          type="button"
          onClick={() => navigate(`/store/${clientKey}/hotels/confirmation/${bookingCode}?email=${encodeURIComponent(email)}`)}
          className="mb-3 text-xs text-stone-500 underline"
        >
          Оплачу позже
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="mt-4 w-full rounded-full bg-amber-500 text-white font-medium py-2.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {submitting ? "Переходим к оплате…" : `Перейти к оплате ${total} ${currency}`}
        </button>
      </div>
    </StoreLayout>
  );
};

export default HotelPaymentPage;
