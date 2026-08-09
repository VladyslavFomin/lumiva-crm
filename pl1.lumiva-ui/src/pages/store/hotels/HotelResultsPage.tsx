import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { searchHotels } from "../../../api/storeHotels";
import type { StoreSearchResult } from "../../../api/storeHotels";
import { getApiErrorMessage } from "../../../api/publicClient";
import { resolveMediaUrl } from "../../../api/mediaUrl";

const HotelResultsPage: React.FC = () => {
  const { clientKey = "" } = useParams<{ clientKey: string }>();
  const [searchParams] = useSearchParams();
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const pax = searchParams.get("pax") || "";

  const [results, setResults] = useState<StoreSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    searchHotels(clientKey, checkIn, checkOut, pax ? Number(pax) : undefined)
      .then(setResults)
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [clientKey, checkIn, checkOut, pax]);

  return (
    <StoreLayout title="Результаты поиска">
      <div className="text-sm text-stone-500 mb-4">
        {checkIn} → {checkOut} · {pax} гостей
      </div>
      {error && <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-4 py-3 mb-4 text-sm">{error}</div>}
      {loading && <div className="text-stone-500 text-sm">Ищем варианты…</div>}
      {!loading && results.length === 0 && !error && (
        <div className="text-stone-500 text-sm">Свободных номеров на эти даты не найдено. Попробуйте другие даты.</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {results.map((r) => (
          <Link
            key={`${r.hotelId}-${r.roomTypeId}`}
            to={`/store/${clientKey}/hotels/${r.hotelId}?checkIn=${checkIn}&checkOut=${checkOut}&pax=${pax}`}
            className="rounded-2xl border border-amber-200 bg-white p-4 shadow-lumiva hover:border-amber-400 transition-colors"
          >
            <div className="h-32 rounded-xl bg-amber-100 mb-3 flex items-center justify-center overflow-hidden">
              {r.coverPhotoUrl ? <img src={resolveMediaUrl(r.coverPhotoUrl)} alt={r.hotelName} className="h-full w-full object-cover" /> : <span className="text-3xl">🏨</span>}
            </div>
            <div className="font-medium">{r.hotelName}</div>
            <div className="text-xs text-stone-500 mb-2">
              {r.city} · {"★".repeat(r.stars)}
            </div>
            <div className="text-sm text-stone-600 mb-2">{r.roomTypeName}</div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-stone-500">от {r.pricePerNight} {r.currency}/ночь</span>
              <span className="font-semibold">
                {r.total} {r.currency}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </StoreLayout>
  );
};

export default HotelResultsPage;
