import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { DateRangePicker, GuestStepper } from "./SearchControls";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const HotelSearchPage: React.FC = () => {
  const { clientKey = "" } = useParams<{ clientKey: string }>();
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState(todayPlus(7));
  const [checkOut, setCheckOut] = useState(todayPlus(10));
  const [pax, setPax] = useState(2);

  const search = () => {
    if (!checkIn || !checkOut) return;
    const params = new URLSearchParams({ checkIn, checkOut, pax: String(pax) });
    navigate(`/store/${clientKey}/hotels/results?${params.toString()}`);
  };

  return (
    <StoreLayout>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 px-6 py-14 md:px-12 md:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_15%,white,transparent_45%)]" />
        <div className="relative">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-300/80 mb-3">
            Система резервации
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight max-w-lg">
            Забронируйте проживание
          </h1>
        </div>
      </div>

      <div className="-mt-9 md:-mt-10 relative z-10 rounded-2xl border border-amber-200 bg-white shadow-lumiva p-3 md:p-4 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center divide-y sm:divide-y-0 sm:divide-x divide-amber-100">
          <div className="flex-1 px-3 py-2">
            <DateRangePicker
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(a, b) => {
                setCheckIn(a);
                setCheckOut(b);
              }}
            />
          </div>
          <div className="px-3 py-2">
            <GuestStepper value={pax} onChange={setPax} />
          </div>
          <div className="px-1 py-2 sm:pl-3">
            <button
              onClick={search}
              disabled={!checkIn || !checkOut}
              className="w-full sm:w-auto rounded-full bg-amber-500 text-white font-medium px-6 py-2.5 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Найти отель
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link to={`/store/${clientKey}/hotels/lookup`} className="text-sm text-amber-700 hover:underline">
          Уже есть бронь? Посмотреть по коду →
        </Link>
      </div>
    </StoreLayout>
  );
};

export default HotelSearchPage;
