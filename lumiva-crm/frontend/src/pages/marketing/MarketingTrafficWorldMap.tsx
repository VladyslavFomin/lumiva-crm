import React, { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import {
  ISO2_TO_WORLD_ATLAS_NAME,
  type CountryTrafficAgg,
} from './marketingTrafficCountryInference';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function lerpRgb(t: number, from: [number, number, number], to: [number, number, number]): string {
  const a = from.map((c, i) => Math.round(c + (to[i] - c) * t)) as [number, number, number];
  return `rgb(${a[0]},${a[1]},${a[2]})`;
}

function fillForValue(v: number | undefined, max: number): string {
  if (v == null || v <= 0 || max <= 0) return '#f1f5f9';
  const t = Math.min(1, v / max);
  return lerpRgb(t, [255, 250, 235], [194, 65, 12]);
}

export type MarketingTrafficWorldMapProps = {
  byCountry: Map<string, CountryTrafficAgg>;
  formatNumber: (n: number) => string;
  t: TFunction;
  /** Переопределить заголовок (например, для данных GA4 из БД). */
  mapTitle?: string;
  mapHint?: string;
  emptyMessage?: string;
  loading?: boolean;
};

export const MarketingTrafficWorldMap: React.FC<MarketingTrafficWorldMapProps> = ({
  byCountry,
  formatNumber,
  t,
  mapTitle: mapTitleProp,
  mapHint: mapHintProp,
  emptyMessage: emptyMessageProp,
  loading,
}) => {
  const { i18n } = useTranslation();
  const [hover, setHover] = useState<{
    displayName: string;
    sessions: number;
    impressions: number;
    clicks: number;
  } | null>(null);

  const enRegionNames = useMemo(() => new Intl.DisplayNames(['en'], { type: 'region' }), []);
  const uiRegionLocale = useMemo(() => {
    const l = (i18n.language || 'ru').split('-')[0].toLowerCase();
    if (l === 'ru' || l === 'en' || l === 'tr') return l;
    return 'en';
  }, [i18n.language]);
  const uiRegionNames = useMemo(
    () => new Intl.DisplayNames([uiRegionLocale], { type: 'region' }),
    [uiRegionLocale],
  );

  const { valueByAtlasName, atlasToIso, maxSessions, totalMappedSessions } = useMemo(() => {
    const valueByAtlasName = new Map<
      string,
      { sessions: number; impressions: number; clicks: number }
    >();
    const atlasToIso = new Map<string, string>();
    let maxSessions = 0;
    let totalMappedSessions = 0;
    for (const [iso2, agg] of byCountry) {
      let atlas = ISO2_TO_WORLD_ATLAS_NAME[iso2];
      if (!atlas) {
        try {
          atlas = enRegionNames.of(iso2) ?? '';
        } catch {
          atlas = '';
        }
      }
      if (!atlas) continue;
      const cur = valueByAtlasName.get(atlas) ?? { sessions: 0, impressions: 0, clicks: 0 };
      cur.sessions += agg.sessions;
      cur.impressions += agg.impressions;
      cur.clicks += agg.clicks;
      valueByAtlasName.set(atlas, cur);
      atlasToIso.set(atlas, iso2);
      totalMappedSessions += agg.sessions;
      if (cur.sessions > maxSessions) maxSessions = cur.sessions;
    }
    return { valueByAtlasName, atlasToIso, maxSessions, totalMappedSessions };
  }, [byCountry, enRegionNames]);

  const title =
    mapTitleProp ??
    t('crm.marketingChannelAnalytics.mapTitle', {
      defaultValue: 'География (оценка по названиям кампаний)',
    });
  const hint =
    mapHintProp ??
    t('crm.marketingChannelAnalytics.mapHint', {
      defaultValue:
        'Покраска по сессиям. Страна угадывается по ключевым словам в названии кампании (например «Almanya», «Polonya»). Без совпадения данные не попадают на карту.',
    });
  const metricSessions = t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' });
  const metricImpr = t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' });
  const metricClicks = t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' });
  const emptyMap =
    emptyMessageProp ??
    t('crm.marketingChannelAnalytics.mapEmpty', {
      defaultValue: 'Нет строк, привязанных к стране по названию кампании.',
    });
  const loadingLabel = t('crm.marketingChannelAnalytics.geoLoading', {
    defaultValue: 'Загрузка геоданных…',
  });

  return (
    <div className={`rounded-2xl border border-[#222222]/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] overflow-hidden`}>
      <div className="px-4 pt-3 pb-1 border-b border-[#222222]/08">
        <div className="text-[11px] font-semibold text-[#222222]/75">{title}</div>
        <p className="text-[10px] text-[#222222]/50 leading-snug mt-1">{hint}</p>
      </div>

      <div className="relative px-2 pb-3 pt-2">
        {loading ? (
          <div className="text-[12px] text-[#222222]/45 py-16 text-center">{loadingLabel}</div>
        ) : totalMappedSessions === 0 ? (
          <div className="text-[12px] text-[#222222]/45 py-16 text-center">{emptyMap}</div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ scale: 118, center: [15, 52] }}
                width={980}
                height={420}
                className="w-full max-w-full [&_svg]:block [&_svg]:max-h-[min(48vh,520px)]"
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const name = (geo.properties as { name?: string }).name;
                      const pack = name ? valueByAtlasName.get(name) : undefined;
                      const sessions = pack?.sessions ?? 0;
                      const impressions = pack?.impressions ?? 0;
                      const clicks = pack?.clicks ?? 0;
                      const fill = fillForValue(sessions > 0 ? sessions : undefined, maxSessions);
                      const isoFromAtlas =
                        (name ? atlasToIso.get(name) : undefined) ??
                        Object.entries(ISO2_TO_WORLD_ATLAS_NAME).find(([, n]) => n === name)?.[0] ??
                        null;
                      const displayName =
                        isoFromAtlas && /^[A-Z]{2}$/.test(isoFromAtlas)
                          ? uiRegionNames.of(isoFromAtlas) || name || '—'
                          : name || '—';

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onMouseEnter={() => {
                            if (sessions <= 0 && impressions <= 0 && clicks <= 0) {
                              setHover({
                                displayName,
                                sessions: 0,
                                impressions: 0,
                                clicks: 0,
                              });
                              return;
                            }
                            setHover({ displayName, sessions, impressions, clicks });
                          }}
                          onMouseLeave={() => setHover(null)}
                          style={{
                            default: {
                              fill,
                              stroke: '#cbd5e1',
                              strokeWidth: 0.35,
                              outline: 'none',
                            },
                            hover: {
                              fill: sessions > 0 ? '#fdba74' : '#e2e8f0',
                              stroke: '#64748b',
                              strokeWidth: 0.55,
                              outline: 'none',
                            },
                            pressed: { outline: 'none' },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>
            </div>

            {hover && (
              <div
                className="pointer-events-none absolute left-4 top-14 z-10 rounded-xl border border-[#222222]/12 bg-white/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur-sm max-w-[min(280px,90%)]"
                role="status"
              >
                <div className="font-semibold text-[#111827]">{hover.displayName}</div>
                <div className="mt-1 space-y-0.5 text-[#475569] tabular-nums">
                  {hover.sessions <= 0 && hover.impressions <= 0 && hover.clicks <= 0 ? (
                    <div className="text-[#94a3b8]">
                      {t('crm.marketingChannelAnalytics.mapNoCountryData', {
                        defaultValue: 'Нет данных по этой стране в текущей выборке.',
                      })}
                    </div>
                  ) : (
                    <>
                      <div>
                        {metricSessions}:{' '}
                        <span className="font-medium text-[#111827]">{formatNumber(hover.sessions)}</span>
                      </div>
                      {hover.clicks > 0 && (
                        <div>
                          {metricClicks}:{' '}
                          <span className="font-medium text-[#111827]">{formatNumber(hover.clicks)}</span>
                        </div>
                      )}
                      <div>
                        {metricImpr}:{' '}
                        <span className="font-medium text-[#111827]">{formatNumber(hover.impressions)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-end justify-between gap-3 px-2">
              <div className="min-w-[200px] flex-1">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-[#222222]/40 mb-1">
                  {t('crm.marketingChannelAnalytics.mapScale', { defaultValue: 'Сессии (интенсивность)' })}
                </div>
                <div
                  className="h-2.5 rounded-full border border-[#222222]/10"
                  style={{
                    background: 'linear-gradient(90deg, rgb(255,250,235) 0%, rgb(194,65,12) 100%)',
                  }}
                />
                <div className="flex justify-between text-[9px] text-[#222222]/45 tabular-nums mt-0.5">
                  <span>0</span>
                  <span>{formatNumber(maxSessions)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
