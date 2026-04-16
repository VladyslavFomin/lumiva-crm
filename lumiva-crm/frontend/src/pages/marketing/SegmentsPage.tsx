// src/pages/marketing/SegmentsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  createSegment,
  fetchSegments,
  fetchAdsTrafficPresets,
  runSegment,
  type AdsTrafficPresetRow,
  type MarketingSegment,
  type LeadSegmentFilters,
} from '../../api/marketing';
import { getLocale } from '../../i18n/utils';

const ACCENT = '#222222';
const borderSubtle = `${ACCENT}18`;

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400';

export const SegmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [adsPresets, setAdsPresets] = useState<AdsTrafficPresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPresetKeys, setSelectedPresetKeys] = useState<Set<string>>(new Set());

  const [statuses, setStatuses] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [country, setCountry] = useState('');
  const [manager, setManager] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const [runningId, setRunningId] = useState<string | null>(null);

  const presetByKey = useMemo(() => {
    const m = new Map<string, AdsTrafficPresetRow>();
    adsPresets.forEach((p) => m.set(p.key, p));
    return m;
  }, [adsPresets]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadingPresets(true);
    setError(null);
    setPresetError(null);
    try {
      const [segList, presets] = await Promise.all([
        fetchSegments(),
        fetchAdsTrafficPresets().catch((e: any) => {
          console.error(e);
          setPresetError(e?.message || t('crm.marketingSegments.errors.loadPresets'));
          return [] as AdsTrafficPresetRow[];
        }),
      ]);
      setSegments(segList);
      setAdsPresets(presets);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.marketingSegments.errors.load'));
    } finally {
      setLoading(false);
      setLoadingPresets(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const toggleStatus = (code: string) => {
    setStatuses((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  };

  const togglePreset = (key: string) => {
    setSelectedPresetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const trafficPresets = Array.from(selectedPresetKeys)
      .map((k) => presetByKey.get(k))
      .filter(Boolean)
      .map((p) => ({
        dataSource: p!.dataSource as 'google_ads' | 'meta_ads',
        source: p!.source,
        medium: p!.medium,
        campaign: p!.campaign,
      }));

    const filters: LeadSegmentFilters = {};
    if (statuses.length) filters.statuses = statuses;
    if (source.trim()) filters.sources = [source.trim()];
    if (country.trim()) filters.countries = [country.trim()];
    if (manager.trim()) filters.managers = [manager.trim()];
    if (createdFrom) filters.createdFrom = createdFrom;
    if (createdTo) filters.createdTo = createdTo;
    if (trafficPresets.length) filters.trafficPresets = trafficPresets;

    const hasLegacy =
      (filters.statuses && filters.statuses.length > 0) ||
      Boolean(filters.sources?.[0]) ||
      Boolean(filters.countries?.[0]) ||
      Boolean(filters.managers?.[0]) ||
      Boolean(filters.createdFrom) ||
      Boolean(filters.createdTo);

    if (!trafficPresets.length && !hasLegacy) {
      setError(t('crm.marketingSegments.errors.needFilters'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const seg = await createSegment({
        entityType: 'lead',
        name: name.trim(),
        description: description.trim() || undefined,
        filters,
      });
      setSegments((prev) => [seg, ...prev]);
      setName('');
      setDescription('');
      setSelectedPresetKeys(new Set());
      setStatuses([]);
      setSource('');
      setCountry('');
      setManager('');
      setCreatedFrom('');
      setCreatedTo('');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.marketingSegments.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleRunSegment = async (id: string) => {
    setRunningId(id);
    try {
      await runSegment(id);
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 pb-8 md:space-y-6">
        <section
          className="rounded-2xl border bg-white px-5 py-5 shadow-sm md:px-7 md:py-6"
          style={{ borderColor: borderSubtle }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                {t('crm.marketingSegments.kicker')}
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-neutral-900 md:text-xl">
                {t('crm.marketingSegments.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-neutral-600">
                {t('crm.marketingSegments.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] text-neutral-700 transition hover:border-neutral-300 disabled:opacity-50"
            >
              {t('crm.marketingSegments.actions.refresh')}
            </button>
          </div>
        </section>

        {error && <div className="text-[11px] text-rose-600">{error}</div>}

        <section
          className="rounded-2xl border bg-white px-4 py-4 text-xs shadow-sm md:px-5 md:py-5"
          style={{ borderColor: borderSubtle }}
        >
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                {t('crm.marketingSegments.adsBlock.title')}
              </h2>
              <p className="mt-1 text-[11px] text-neutral-600">
                {t('crm.marketingSegments.adsBlock.subtitle')}
              </p>
              {presetError && (
                <p className="mt-2 text-[11px] text-rose-600">{presetError}</p>
              )}
              {loadingPresets && (
                <p className="mt-2 text-[11px] text-neutral-500">
                  {t('crm.marketingSegments.adsBlock.loading')}
                </p>
              )}
              {!loadingPresets && !adsPresets.length && !presetError && (
                <div
                  className="mt-3 rounded-xl border border-dashed px-3 py-3 text-[11px] text-neutral-600"
                  style={{ borderColor: borderSubtle }}
                >
                  <p>{t('crm.marketingSegments.adsBlock.empty')}</p>
                  <Link
                    to="/integrations-hub?tab=marketing"
                    className="mt-2 inline-block font-medium text-neutral-900 underline underline-offset-2"
                  >
                    {t('crm.marketingSegments.adsBlock.openIntegrations')}
                  </Link>
                </div>
              )}
              {!loadingPresets && adsPresets.length > 0 && (
                <ul className="mt-3 max-h-[min(360px,50vh)] space-y-2 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50/50 p-2">
                  {adsPresets.map((p) => {
                    const checked = selectedPresetKeys.has(p.key);
                    return (
                      <li key={p.key}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition hover:bg-white hover:shadow-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                            checked={checked}
                            onChange={() => togglePreset(p.key)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-neutral-900">{p.label}</span>
                            <span className="mt-0.5 block text-[10px] text-neutral-500">
                              {t('crm.marketingSegments.adsBlock.rowMeta', {
                                clicks: p.totalClicks.toLocaleString(locale),
                                imps: p.totalImpressions.toLocaleString(locale),
                                date: p.lastDate || '—',
                              })}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-600">
                  {t('crm.marketingSegments.form.name')}
                </label>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('crm.marketingSegments.form.namePlaceholder')}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-600">
                  {t('crm.marketingSegments.form.description')}
                </label>
                <input
                  className={inputClass}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('crm.marketingSegments.form.descriptionPlaceholder')}
                />
              </div>
            </div>

            <details className="group rounded-xl border border-neutral-100 bg-neutral-50/40 px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-medium text-neutral-800">
                {t('crm.marketingSegments.advanced.title')}
              </summary>
              <div className="mt-3 space-y-4 border-t border-neutral-100 pt-3">
                <div>
                  <div className="mb-2 text-[11px] text-neutral-600">
                    {t('crm.marketingSegments.form.statuses')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['new', t('crm.marketingSegments.statuses.new')],
                        ['in_progress', t('crm.marketingSegments.statuses.in_progress')],
                        ['waiting', t('crm.marketingSegments.statuses.waiting')],
                        ['won', t('crm.marketingSegments.statuses.won')],
                        ['lost', t('crm.marketingSegments.statuses.lost')],
                      ] as [string, string][]
                    ).map(([code, label]) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleStatus(code)}
                        className={
                          'rounded-full border px-3 py-1.5 text-[11px] transition ' +
                          (statuses.includes(code)
                            ? 'font-medium text-white shadow-sm'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
                        }
                        style={
                          statuses.includes(code)
                            ? { backgroundColor: ACCENT, borderColor: ACCENT }
                            : undefined
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-neutral-600">
                      {t('crm.marketingSegments.form.source')}
                    </label>
                    <input
                      className={inputClass}
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder={t('crm.marketingSegments.form.sourcePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-neutral-600">
                      {t('crm.marketingSegments.form.country')}
                    </label>
                    <input
                      className={inputClass}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder={t('crm.marketingSegments.form.countryPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-neutral-600">
                      {t('crm.marketingSegments.form.manager')}
                    </label>
                    <input
                      className={inputClass}
                      value={manager}
                      onChange={(e) => setManager(e.target.value)}
                      placeholder={t('crm.marketingSegments.form.managerPlaceholder')}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-neutral-600">
                      {t('crm.marketingSegments.form.createdFrom')}
                    </label>
                    <input
                      type="date"
                      className={inputClass}
                      value={createdFrom}
                      onChange={(e) => setCreatedFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-neutral-600">
                      {t('crm.marketingSegments.form.createdTo')}
                    </label>
                    <input
                      type="date"
                      className={inputClass}
                      value={createdTo}
                      onChange={(e) => setCreatedTo(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500">{t('crm.marketingSegments.advanced.hint')}</p>
              </div>
            </details>

            <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-neutral-500">{t('crm.marketingSegments.form.helper')}</p>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="rounded-xl px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {saving ? t('crm.marketingSegments.actions.creating') : t('crm.marketingSegments.actions.create')}
              </button>
            </div>
          </form>
        </section>

        <section
          className="rounded-2xl border bg-white px-4 py-4 text-xs shadow-sm md:px-5 md:py-5"
          style={{ borderColor: borderSubtle }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                {t('crm.marketingSegments.list.title')}
              </h2>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {t('crm.marketingSegments.list.subtitle')}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-neutral-500">
              {t('crm.marketingSegments.list.total', { count: segments.length })}
            </span>
          </div>

          {loading && (
            <div className="text-[11px] text-neutral-500">{t('crm.marketingSegments.loading')}</div>
          )}

          {!loading && segments.length === 0 && (
            <div className="text-[11px] text-neutral-500">{t('crm.marketingSegments.list.empty')}</div>
          )}

          {!loading && segments.length > 0 && (
            <div className="space-y-2">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-neutral-900">{seg.name}</div>
                    {seg.description && (
                      <div className="truncate text-[11px] text-neutral-500">{seg.description}</div>
                    )}
                    {seg.trafficPresets && seg.trafficPresets.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {seg.trafficPresets.map((tp, i) => (
                          <span
                            key={`${tp.dataSource}-${tp.campaign}-${i}`}
                            className="inline-block max-w-full truncate rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] text-neutral-700"
                          >
                            {tp.dataSource === 'google_ads' ? 'Google' : 'Meta'} · {tp.campaign}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-neutral-500">
                      {t('crm.marketingSegments.list.meta', {
                        entity: seg.entityType,
                        date: new Date(seg.createdAt).toLocaleDateString(locale),
                      })}
                      {seg.lastRunAt
                        ? ` · ${t('crm.marketingSegments.list.lastRun', {
                            count: seg.lastMatchedCount,
                          })}`
                        : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRunSegment(seg.id)}
                      disabled={runningId === seg.id}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
                    >
                      {runningId === seg.id
                        ? t('crm.marketingSegments.actions.running')
                        : t('crm.marketingSegments.actions.run')}
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
