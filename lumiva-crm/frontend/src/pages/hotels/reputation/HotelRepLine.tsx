import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRepHotelsSummary, type RepHotelsSummary } from '../../../api/hotelReputation';
import { scoreClass, useRepT } from './ReputationShared';
import './reputation.css';

/** Сводка репутации по всем отелям (один запрос на страницу). */
export function useRepHotelsSummary() {
  const [data, setData] = useState<RepHotelsSummary | null>(null);
  useEffect(() => {
    fetchRepHotelsSummary().then(setData).catch(() => setData(null));
  }, []);
  return data;
}

/** Строка репутации на карточке отеля: средняя за 90 дней, число отзывов, негатив без ответа. */
export const HotelRepLine: React.FC<{ summary: RepHotelsSummary | null; hotelId: string }> = ({ summary, hotelId }) => {
  const { r } = useRepT();
  const navigate = useNavigate();
  const h = summary?.hotels.find((x) => x.hotelId === hotelId);
  if (!h || !h.n90) return null;
  return (
    <div
      className="px-scope rp-hotel-line"
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/hotels/reviews?hotelId=${hotelId}`);
      }}
      title={r('hotelTab.lineHint')}
    >
      <span className="rp-score"><b className={scoreClass(h.avg90, summary!.negBelow)}>{h.avg90 ?? '—'}</b></span>
      <span>{r('hotelTab.lineReviews', { n: h.n90 })}</span>
      {h.unansweredNegative ? <span className="rp-pill noreply">{r('hotelTab.lineOpen', { n: h.unansweredNegative })}</span> : null}
    </div>
  );
};
