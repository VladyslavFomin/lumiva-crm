import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import StoreLayout from "../StoreLayout";
import { fetchHotel } from "../../../api/storeHotels";
import type { StoreHotelDetail } from "../../../api/storeHotels";
import { getApiErrorMessage } from "../../../api/publicClient";
import { resolveMediaUrl } from "../../../api/mediaUrl";

const HotelDetailPage: React.FC = () => {
  const { clientKey = "", hotelId = "" } = useParams<{ clientKey: string; hotelId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const pax = searchParams.get("pax") || "1";

  const [hotel, setHotel] = useState<StoreHotelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [occupancyByRoom, setOccupancyByRoom] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchHotel(clientKey, hotelId)
      .then((h) => {
        setHotel(h);
        const initial: Record<string, string> = {};
        h.roomTypes.forEach((rt) => {
          if (rt.occupancyTypes[0]) initial[rt.id] = rt.occupancyTypes[0].id;
        });
        setOccupancyByRoom(initial);
      })
      .catch((e) => setError(getApiErrorMessage(e)));
  }, [clientKey, hotelId]);

  const selectRoom = (roomTypeId: string) => {
    const occupancyTypeId = occupancyByRoom[roomTypeId];
    const params = new URLSearchParams({ hotelId, roomTypeId, occupancyTypeId, checkIn, checkOut, pax });
    navigate(`/store/${clientKey}/hotels/book?${params.toString()}`);
  };

  if (error) {
    return (
      <StoreLayout title="Отель">
        <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-4 py-3 text-sm">{error}</div>
      </StoreLayout>
    );
  }
  if (!hotel) {
    return (
      <StoreLayout title="Отель">
        <div className="text-stone-500 text-sm">Загрузка…</div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="h-48 rounded-2xl bg-amber-100 mb-4 flex items-center justify-center overflow-hidden">
        {hotel.coverPhotoUrl ? <img src={resolveMediaUrl(hotel.coverPhotoUrl)} alt={hotel.name} className="h-full w-full object-cover" /> : <span className="text-5xl">🏨</span>}
      </div>
      <h1 className="text-xl font-semibold mb-1">{hotel.name}</h1>
      <div className="text-sm text-stone-500 mb-1">
        {hotel.city}, {hotel.country} · {"★".repeat(hotel.stars)}
      </div>
      <div className="text-xs text-stone-500 mb-4">
        Заезд {checkIn} с {hotel.checkInTime} · Выезд {checkOut} до {hotel.checkOutTime}
      </div>
      {hotel.description && <p className="text-sm text-stone-600 mb-6 whitespace-pre-line">{hotel.description}</p>}

      <h2 className="font-semibold mb-3">Номера</h2>
      <div className="grid gap-4">
        {hotel.roomTypes.map((rt) => (
          <div key={rt.id} className="rounded-2xl border border-amber-200 bg-white shadow-lumiva p-4 flex flex-col sm:flex-row gap-4">
            <div className="h-28 w-full sm:w-40 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center overflow-hidden">
              {rt.coverPhotoUrl ? <img src={resolveMediaUrl(rt.coverPhotoUrl)} alt={rt.name} className="h-full w-full object-cover" /> : <span className="text-2xl">🛏️</span>}
            </div>
            <div className="flex-1">
              <div className="font-medium">{rt.name}</div>
              <div className="text-xs text-stone-500 mb-2">
                {rt.capacityLabel} {rt.sizeM2 ? `· ${rt.sizeM2} м²` : ""}
              </div>
              {rt.amenities.length > 0 && <div className="text-xs text-stone-500 mb-3">{rt.amenities.join(" · ")}</div>}
              <div className="flex items-center gap-2">
                <select
                  value={occupancyByRoom[rt.id] || ""}
                  onChange={(e) => setOccupancyByRoom((prev) => ({ ...prev, [rt.id]: e.target.value }))}
                  className="rounded-xl border border-amber-300 px-3 py-1.5 text-sm"
                >
                  {rt.occupancyTypes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => selectRoom(rt.id)}
                  disabled={!occupancyByRoom[rt.id]}
                  className="rounded-full bg-amber-500 text-white text-sm font-medium px-4 py-1.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  Выбрать
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </StoreLayout>
  );
};

export default HotelDetailPage;
