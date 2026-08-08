// src/pages/calendar/TeamCalendarPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { fetchCalendarEvents, type CalendarEventDto, type CalendarEventType } from '../../api/calendar';
import { toLocalDateKey } from '../../utils/calendarLocalDates';

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const TYPE_META: Record<CalendarEventType, { label: string; color: string; dot: string }> = {
  lead_meeting: { label: 'Встречи (лиды)', color: '#3b6cb6', dot: 'bg-[#3b6cb6]' },
  project_task: { label: 'Задачи проектов', color: '#a06b1a', dot: 'bg-[#a06b1a]' },
  booking: { label: 'Бронирования', color: '#1f8a5e', dot: 'bg-[#1f8a5e]' },
  hotel_reservation: { label: 'Заезды в отели', color: '#7a4fc9', dot: 'bg-[#7a4fc9]' },
};

export const TeamCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => monthStart(new Date()));
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<CalendarEventType>>(new Set());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    // Pad a week on either side so the grid's leading/trailing days from adjacent months
    // still show their events.
    const from = addDays(monthStart(cursor), -7);
    const to = addDays(monthEnd(cursor), 7);
    fetchCalendarEvents(from, to)
      .then((data) => {
        if (alive) setEvents(data);
      })
      .catch((e: any) => {
        if (alive) setError(e?.message || 'Не удалось загрузить календарь');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const visibleEvents = useMemo(
    () => events.filter((e) => !hiddenTypes.has(e.type)),
    [events, hiddenTypes],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEventDto[]>();
    for (const e of visibleEvents) {
      const key = toLocalDateKey(e.date);
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [visibleEvents]);

  const gridDays = useMemo(() => {
    const start = monthStart(cursor);
    const end = monthEnd(cursor);
    const firstWeekday = (start.getDay() + 6) % 7;
    const daysInMonth = end.getDate();
    const cells: Array<{ key: string; date: Date | null }> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push({ key: `empty-start-${i}`, date: null });
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      cells.push({ key: toLocalDateKey(date), date });
    }
    while (cells.length % 7 !== 0) cells.push({ key: `empty-end-${cells.length}`, date: null });
    return cells;
  }, [cursor]);

  const todayKey = toLocalDateKey(new Date());

  const upcoming = useMemo(
    () =>
      [...visibleEvents]
        .filter((e) => toLocalDateKey(e.date) >= todayKey)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 12),
    [visibleEvents, todayKey],
  );

  const toggleType = (type: CalendarEventType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <MainLayout>
      <div className="w-full pb-8 min-w-0 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Календарь команды</h1>
          <div className="text-xs text-slate-500 mt-1">
            Встречи по лидам, дедлайны задач проектов, бронирования и заезды в отели — в одном месте.
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_META) as CalendarEventType[]).map((type) => {
              const meta = TYPE_META[type];
              const active = !hiddenTypes.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-xl border transition-colors ${
                    active ? 'border-slate-300 text-slate-700 bg-white' : 'border-slate-200 text-slate-400 bg-slate-50'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${active ? meta.dot : 'bg-slate-300'}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              ←
            </button>
            <div className="text-sm font-semibold text-slate-900 capitalize">{monthLabel}</div>
            <button
              type="button"
              onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              →
            </button>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500">Загрузка…</div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 text-[11px] text-slate-500 mb-2">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                  <div key={d} className="px-2 py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {gridDays.map((cell) => {
                  if (!cell.date) {
                    return <div key={cell.key} className="min-h-[110px] rounded-2xl bg-slate-50" />;
                  }
                  const dayEvents = byDay.get(cell.key) || [];
                  const isToday = cell.key === todayKey;
                  return (
                    <div
                      key={cell.key}
                      className={`min-h-[110px] rounded-2xl border p-2 ${
                        isToday ? 'border-[#222222] bg-slate-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-slate-700 mb-1">{cell.date.getDate()}</div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => navigate(e.link)}
                            className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 hover:bg-slate-100"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${TYPE_META[e.type].dot}`} />
                              <span className="text-[10px] font-semibold text-slate-800 truncate">{e.title}</span>
                            </div>
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-slate-500">ещё {dayEvents.length - 3}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Ближайшие события</h2>
          <div className="overflow-x-auto">
            <table className="min-w-[600px] w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1">Дата</th>
                  <th className="text-left px-2 py-1">Тип</th>
                  <th className="text-left px-2 py-1">Событие</th>
                  <th className="text-left px-2 py-1">Детали</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((e) => (
                  <tr key={e.id} className="border-t border-slate-200">
                    <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                      {new Date(e.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <span className={`h-1.5 w-1.5 rounded-full ${TYPE_META[e.type].dot}`} />
                        {TYPE_META[e.type].label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(e.link)}
                        className="text-sky-600 hover:text-sky-700 hover:underline"
                      >
                        {e.title}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{e.subtitle || '—'}</td>
                  </tr>
                ))}
                {!upcoming.length && !loading && (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-center text-slate-500">
                      Ничего не запланировано
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TeamCalendarPage;
