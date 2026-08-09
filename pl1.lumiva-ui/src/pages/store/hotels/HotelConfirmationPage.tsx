import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { lookupReservation } from "../../../api/storeHotels";
import { getApiErrorMessage } from "../../../api/publicClient";

const HotelConfirmationPage: React.FC = () => {
  const { clientKey = "", bookingCode = "" } = useParams<{ clientKey: string; bookingCode: string }>();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [reservation, setReservation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    lookupReservation(clientKey, bookingCode, email)
      .then(setReservation)
      .catch((e) => setError(getApiErrorMessage(e)));
  }, [clientKey, bookingCode, email]);

  return (
    <StoreLayout title="Бронь подтверждена">
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 max-w-md">
        <div className="text-emerald-700 font-semibold mb-2 text-lg">Код брони: {bookingCode}</div>
        {error && <div className="text-rose-600 text-sm">{error}</div>}
        {reservation && (
          <div className="text-sm text-stone-700 space-y-1">
            <div>{reservation.hotelName}</div>
            <div>{reservation.roomTypeName}</div>
            <div>
              {reservation.checkIn} → {reservation.checkOut}
            </div>
            <div>Гость: {reservation.guestName}</div>
            <div className="font-semibold pt-2">
              Оплачено: {reservation.total} {reservation.currency} · {reservation.paidStatus}
            </div>
          </div>
        )}
        <p className="text-xs text-stone-500 mt-4">Сохраните код брони и email — по ним можно посмотреть заявку в любой момент.</p>
      </div>
    </StoreLayout>
  );
};

export default HotelConfirmationPage;
