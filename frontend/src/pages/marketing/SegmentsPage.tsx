// src/pages/marketing/SegmentsPage.tsx
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  createSegment,
  fetchSegments,
  runSegment,
  type MarketingSegment,
  type LeadSegmentFilters,
} from '../../api/marketing';

export const SegmentsPage: React.FC = () => {
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // поля формы
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [country, setCountry] = useState('');
  const [manager, setManager] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResultCount, setRunResultCount] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchSegments()
      .then(setSegments)
      .catch((e: any) => {
        console.error(e);
        setError(e.message || 'Не удалось загрузить сегменты');
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleStatus = (code: string) => {
    setStatuses((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const filters: LeadSegmentFilters = {};
    if (statuses.length) filters.statuses = statuses;
    if (source.trim()) filters.sources = [source.trim()];
    if (country.trim()) filters.countries = [country.trim()];
    if (manager.trim()) filters.managers = [manager.trim()];
    if (createdFrom) filters.createdFrom = createdFrom;
    if (createdTo) filters.createdTo = createdTo;

    try {
      const seg = await createSegment({
        entityType: 'lead',
        name: name.trim(),
        description: description.trim() || undefined,
        filters,
      });
      setSegments((prev) => [seg, ...prev]);

      // reset
      setName('');
      setDescription('');
      setStatuses([]);
      setSource('');
      setCountry('');
      setManager('');
      setCreatedFrom('');
      setCreatedTo('');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Не удалось сохранить сегмент');
    } finally {
      setSaving(false);
    }
  };

  const handleRunSegment = async (id: string) => {
    setRunningId(id);
    setRunResultCount(null);
    try {
      const res = (await runSegment(id)) as any[];
      setRunResultCount(res.length);
    } catch (e) {
      console.error(e);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
            Маркетинг · Сегменты
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-slate-50">
            Сегменты лидов
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Сохраняйте часто используемые выборки по лидам: по статусам, каналам,
            странам и менеджерам. В дальнейшем можно будет привязать сегменты к
            рассылкам и задачам в n8n.
          </p>
        </section>

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {/* форма создания */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Название сегмента
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Лиды из Google Ads RU за последние 30 дней"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Описание (опционально)
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Для рассылки по лидам из брендового трафика"
                />
              </div>
            </div>

            {/* статусы */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1">
                Статусы лидов
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: 'new', label: 'Новый' },
                  { code: 'in_progress', label: 'В работе' },
                  { code: 'waiting', label: 'Ожидает' },
                  { code: 'won', label: 'Успех' },
                  { code: 'lost', label: 'Проигран' },
                ].map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => toggleStatus(s.code)}
                    className={
                      'px-3 py-1.5 rounded-xl text-[11px] border transition ' +
                      (statuses.includes(s.code)
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500')
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* остальные фильтры */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Источник (source)
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="google / facebook / crm…"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Страна
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="TR / RU / PL / DE…"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Менеджер (assignedTo)
                </label>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  placeholder="Имя менеджера"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Создан с
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Создан по
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Сегменты сейчас работают только по лидам. В будущем сюда можно
                привязать рассылки, экспорт, webhooks в n8n.
              </div>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className={
                  'px-4 py-1.5 rounded-xl text-[11px] border transition ' +
                  (saving || !name.trim()
                    ? 'border-slate-700 text-slate-500 cursor-not-allowed'
                    : 'border-emerald-500 text-emerald-200 hover:bg-emerald-500/10')
                }
              >
                {saving ? 'Сохраняем…' : 'Создать сегмент'}
              </button>
            </div>
          </form>
        </section>

        {/* список сегментов */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                Сохранённые сегменты
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Нажмите «Запустить», чтобы посмотреть, сколько лидов попадает в
                сегмент.
              </p>
            </div>
            <span className="text-[11px] text-slate-500">
              Всего: {segments.length}
            </span>
          </div>

          {loading && (
            <div className="text-[11px] text-slate-500">
              Загружаем сегменты…
            </div>
          )}

          {!loading && segments.length === 0 && (
            <div className="text-[11px] text-slate-500">
              Сегментов пока нет. Создайте первый выше.
            </div>
          )}

          {segments.length > 0 && (
            <div className="space-y-2">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-slate-100 truncate">
                      {seg.name}
                    </div>
                    {seg.description && (
                      <div className="text-[11px] text-slate-500 truncate">
                        {seg.description}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      entity: {seg.entityType} · создан:{' '}
                      {new Date(seg.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {runResultCount !== null && runningId === null && (
                      <span className="text-[11px] text-slate-400">
                        Найдено: {runResultCount}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRunSegment(seg.id)}
                      disabled={runningId === seg.id}
                      className="px-3 py-1.5 rounded-xl text-[11px] border border-sky-500 text-sky-300 hover:bg-sky-500/10 disabled:opacity-60"
                    >
                      {runningId === seg.id ? 'Запуск…' : 'Запустить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};