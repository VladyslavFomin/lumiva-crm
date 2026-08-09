import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";

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
    const params = new URLSearchParams({ checkIn, checkOut, pax: String(pax) });
    navigate(`/store/${clientKey}/hotels/results?${params.toString()}`);
  };

  return (
    <StoreLayout title="Система резервации">
      <div className="rounded-2xl border border-amber-200 bg-white shadow-lumiva p-5 max-w-2xl">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Заезд</label>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Выезд</label>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Гостей</label>
            <input
              type="number"
              min={1}
              value={pax}
              onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button onClick={search} className="mt-4 w-full sm:w-auto rounded-full bg-amber-500 text-white font-medium px-6 py-2.5 hover:bg-amber-600 transition-colors">
          Найти отель
        </button>
      </div>

      <div className="mt-6">
        <Link to={`/store/${clientKey}/hotels/lookup`} className="text-sm text-amber-700 hover:underline">
          Уже есть бронь? Посмотреть по коду →
        </Link>
      </div>
    </StoreLayout>
  );
};

export default HotelSearchPage;
