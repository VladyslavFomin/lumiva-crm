import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import {
  MAP_HEIGHT,
  MAP_SCALE,
  MAP_WIDTH,
  REGION_VIEWS,
  atlasInfo,
  countryView,
  isoInScope,
  loadWorldTopology,
  resolveCountryIso,
  type MapRegionScope,
  type MapScope,
} from './geoCountries';

type Row = { label: string; value: number };

export type GeoPoint = { lat: number; lon: number; name: string; countryCode: string | null };
export type Geocoder = (
  queries: string[],
  country?: string,
) => Promise<{ results: Record<string, GeoPoint | null>; pending: string[] }>;

/** «Стамбул» → точка: запрашиваем пачкой, дожимаем pending (бэкенд геокодит ≤12 новых за вызов). */
function useGeocodedLabels(labels: string[], country: string | undefined, geocode: Geocoder | undefined, enabled: boolean) {
  const [points, setPoints] = useState<Record<string, GeoPoint | null>>({});
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const key = `${country || ''}|${labels.join('\u0001')}`;
  const geocodeRef = useRef(geocode);
  geocodeRef.current = geocode;
  const hasGeocoder = Boolean(geocode);
  useEffect(() => {
    const geocode = geocodeRef.current;
    if (!enabled || !geocode || !labels.length) {
      setPoints({});
      setPending(0);
      return;
    }
    let alive = true;
    setFailed(false);
    (async () => {
      let todo = labels;
      for (let round = 0; round < 25 && todo.length && alive; round += 1) {
        try {
          const res = await geocode(todo, country);
          if (!alive) return;
          setPoints((prev) => ({ ...prev, ...res.results }));
          setPending(res.pending.length);
          todo = res.pending;
        } catch {
          if (alive) setFailed(true);
          return;
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, hasGeocoder]);
  return { points, pending, failed };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function mix(from: [number, number, number], to: [number, number, number], t: number) {
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const EMPTY_FILL = '#eef0f3';
const OUT_OF_SCOPE_FILL = '#f6f7f9';
const LOW: [number, number, number] = [226, 232, 240];

/** Блок «Карта»: закраска стран по значению, наведение — подсказка, клик — закреплённая карточка. */
export const AnalyticsGeoMap: React.FC<{
  rows: Row[];
  scope: MapScope;
  height: number;
  color: string;
  valueLabel: string;
  formatValue: (n: number) => string;
  /** 'countries' — закраска стран; 'points' — города/адреса точками (нужен geocode). */
  mode?: 'countries' | 'points';
  geocode?: Geocoder;
}> = ({ rows, scope, height, color, valueLabel, formatValue, mode = 'countries', geocode }) => {
  const pointsMode = mode === 'points';
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [topology, setTopology] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [hover, setHover] = useState<{ iso: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadWorldTopology()
      .then((topo) => alive && setTopology(topo))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const regionNames = useMemo(() => {
    const lang = (i18n.language || 'ru').split('-')[0];
    try {
      return new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    }
  }, [i18n.language]);
  const countryName = (iso: string) => {
    try {
      return regionNames.of(iso) || iso;
    } catch {
      return iso;
    }
  };

  const scopeCountry = scope.startsWith('country:') ? scope.slice(8) : undefined;
  const pointLabels = useMemo(
    () => (pointsMode ? Array.from(new Set(rows.filter((r) => r.value).map((r) => String(r.label).trim()).filter(Boolean))) : []),
    [rows, pointsMode],
  );
  const geo = useGeocodedLabels(pointLabels, scopeCountry, geocode, pointsMode);
  const pointData = useMemo(() => {
    if (!pointsMode) return { points: [] as Array<{ key: string; label: string; value: number; lat: number; lon: number }>, total: 0, max: 0, missing: [] as string[] };
    const agg = new Map<string, { key: string; label: string; value: number; lat: number; lon: number }>();
    const missing: string[] = [];
    rows.forEach((row) => {
      const label = String(row.label).trim();
      if (!label || !row.value) return;
      const p = geo.points[label];
      if (p === null) {
        missing.push(label);
        return;
      }
      if (!p) return;
      const k = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
      const cur = agg.get(k) ?? { key: `pt:${k}`, label, value: 0, lat: p.lat, lon: p.lon };
      cur.value += Number(row.value) || 0;
      agg.set(k, cur);
    });
    const points = [...agg.values()].sort((a, b) => b.value - a.value);
    return {
      points,
      total: points.reduce((sum, p) => sum + p.value, 0),
      max: points.reduce((m, p) => Math.max(m, p.value), 0),
      missing,
    };
  }, [pointsMode, rows, geo.points]);

  const { byIso, unmatched } = useMemo(() => {
    const map = new Map<string, number>();
    const miss: string[] = [];
    rows.forEach((row) => {
      const iso = resolveCountryIso(row.label);
      if (!iso) {
        if (row.value) miss.push(row.label);
        return;
      }
      map.set(iso, (map.get(iso) ?? 0) + (Number(row.value) || 0));
    });
    return { byIso: map, unmatched: miss };
  }, [rows]);

  // Итог и шкала — только по странам, попадающим в выбранную область.
  const { scopeTotal, scopeMax, ranking } = useMemo(() => {
    const continentsOf = new Map<string, string[]>();
    topology?.objects?.countries?.geometries?.forEach((g: any) => {
      const info = atlasInfo(g);
      if (info) continentsOf.set(info.iso, info.continents);
    });
    const entries = [...byIso.entries()].filter(([iso]) =>
      isoInScope(iso, (continentsOf.get(iso) ?? []) as any, scope),
    );
    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const max = entries.reduce((m, [, v]) => Math.max(m, v), 0);
    const ranked = entries.sort((a, b) => b[1] - a[1]).map(([iso]) => iso);
    return { scopeTotal: total, scopeMax: max, ranking: ranked };
  }, [byIso, scope, topology]);

  const baseView = useMemo(() => {
    if (scope.startsWith('country:')) {
      const view = topology ? countryView(topology, scope.slice(8)) : null;
      return view ?? REGION_VIEWS.world;
    }
    return REGION_VIEWS[scope as MapRegionScope] ?? REGION_VIEWS.world;
  }, [scope, topology]);
  const [view, setView] = useState(baseView);
  useEffect(() => {
    setView(baseView);
    setSelected(null);
  }, [baseView]);

  const rgb = useMemo(() => hexToRgb(color || '#222222'), [color]);
  const fillFor = (value: number | undefined) => {
    if (!value || value <= 0 || scopeMax <= 0) return EMPTY_FILL;
    const ratio = Math.sqrt(value / scopeMax); // корень — чтобы мелкие страны не сливались с фоном
    return mix(LOW, rgb, 0.15 + 0.85 * ratio);
  };

  const card = (iso: string) => {
    if (iso.startsWith('pt:')) {
      const idx = pointData.points.findIndex((p) => p.key === iso);
      const p = pointData.points[idx];
      const value = p?.value ?? 0;
      return {
        name: p?.label ?? '',
        value,
        rank: idx,
        share: pointData.total > 0 ? Math.round((value / pointData.total) * 1000) / 10 : 0,
      };
    }
    const value = byIso.get(iso) ?? 0;
    const rank = ranking.indexOf(iso);
    const share = scopeTotal > 0 ? Math.round((value / scopeTotal) * 1000) / 10 : 0;
    return { name: countryName(iso), value, rank, share };
  };

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        {t('crm.projects.analytics.map.loadError')}
      </div>
    );
  }

  const hovered = hover ? card(hover.iso) : null;
  const pinned = selected ? card(selected) : null;
  const zoomBy = (factor: number) =>
    setView((prev) => ({ ...prev, zoom: Math.max(1, Math.min(40, prev.zoom * factor)) }));

  return (
    <div className="flex h-full flex-col" style={{ minHeight: Math.max(height, 200) }}>
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-[#fbfbfc]">
        {!topology ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            {t('crm.projects.analytics.map.loading')}
          </div>
        ) : (
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: MAP_SCALE, center: [0, 0] }}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup
              center={view.center}
              zoom={view.zoom}
              minZoom={1}
              maxZoom={40}
              onMoveEnd={({ coordinates, zoom }) => setView({ center: coordinates, zoom })}
            >
              <Geographies geography={topology}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const info = atlasInfo(geo as any);
                    if (!info || info.iso === 'AQ' || info.iso === 'TF') return null;
                    const inScope = isoInScope(info.iso, info.continents, scope);
                    const value = byIso.get(info.iso);
                    const isSelected = selected === info.iso;
                    const fill = pointsMode ? (inScope ? EMPTY_FILL : OUT_OF_SCOPE_FILL) : inScope ? fillFor(value) : OUT_OF_SCOPE_FILL;
                    const stroke = isSelected ? '#111' : '#ffffff';
                    const strokeWidth = (isSelected ? 1.6 : 0.6) / view.zoom;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseMove={(event: React.MouseEvent) => {
                          if (!inScope || pointsMode) return;
                          const rect = containerRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          setHover({ iso: info.iso, x: event.clientX - rect.left, y: event.clientY - rect.top });
                        }}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => {
                          if (!inScope || pointsMode) return;
                          setSelected((prev) => (prev === info.iso ? null : info.iso));
                        }}
                        style={{
                          default: { fill, stroke, strokeWidth, outline: 'none', transition: 'fill 150ms' },
                          hover: pointsMode ? { fill, stroke, strokeWidth, outline: 'none' } : {
                            fill: inScope ? (value ? mix(rgb, [0, 0, 0], 0.15) : '#dfe3e8') : OUT_OF_SCOPE_FILL,
                            stroke: inScope ? '#111' : stroke,
                            strokeWidth: (inScope ? 1.2 : 0.6) / view.zoom,
                            outline: 'none',
                            cursor: inScope ? 'pointer' : 'default',
                          },
                          pressed: { fill, stroke: '#111', strokeWidth: 1.6 / view.zoom, outline: 'none' },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
              {pointsMode &&
                pointData.points.map((p, index) => {
                  const r = (5 + 17 * Math.sqrt(pointData.max > 0 ? p.value / pointData.max : 0)) / view.zoom;
                  const isSelected = selected === p.key;
                  return (
                    <Marker key={p.key} coordinates={[p.lon, p.lat]}>
                      <circle
                        r={r}
                        fill={mix(LOW, rgb, 0.55 + 0.45 * Math.sqrt(pointData.max > 0 ? p.value / pointData.max : 0))}
                        fillOpacity={0.85}
                        stroke={isSelected ? '#111' : '#fff'}
                        strokeWidth={(isSelected ? 2 : 1.2) / view.zoom}
                        style={{ cursor: 'pointer' }}
                        onMouseMove={(event) => {
                          const rect = containerRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          setHover({ iso: p.key, x: event.clientX - rect.left, y: event.clientY - rect.top });
                        }}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => setSelected((prev) => (prev === p.key ? null : p.key))}
                      />
                      {index < 12 && (
                        <text
                          y={-r - 3 / view.zoom}
                          textAnchor="middle"
                          style={{ fontSize: 10 / view.zoom, fill: '#374151', fontWeight: 600, pointerEvents: 'none' }}
                        >
                          {p.label}
                        </text>
                      )}
                    </Marker>
                  );
                })}
            </ZoomableGroup>
          </ComposableMap>
        )}

        {hovered && hover && (
          <div
            className="pointer-events-none absolute z-10 min-w-[140px] rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={{
              left: Math.min(hover.x + 14, (containerRef.current?.clientWidth ?? 400) - 170),
              top: Math.max(8, hover.y - 64),
            }}
          >
            <div className="font-semibold text-[#222]">{hovered.name}</div>
            <div className="mt-0.5 text-neutral-500">
              {valueLabel}: <span className="font-medium text-[#222]">{formatValue(hovered.value)}</span>
            </div>
            {hovered.value > 0 && (
              <div className="text-neutral-400">
                {hovered.share}% · #{hovered.rank + 1}
              </div>
            )}
          </div>
        )}

        {pinned && selected && (
          <div className="absolute bottom-2 left-2 z-10 w-[220px] rounded-xl border border-neutral-200 bg-white p-3 text-xs shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-[#222]">{pinned.name}</div>
              <button
                type="button"
                className="text-neutral-400 hover:text-[#222]"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#222]">{formatValue(pinned.value)}</div>
            <div className="text-neutral-500">{valueLabel}</div>
            {pinned.value > 0 ? (
              <div className="mt-2 flex items-center justify-between text-neutral-500">
                <span>{t('crm.projects.analytics.map.share', { share: pinned.share })}</span>
                <span>
                  {t('crm.projects.analytics.map.rank', {
                    rank: pinned.rank + 1,
                    total: pointsMode ? pointData.points.length : ranking.length,
                  })}
                </span>
              </div>
            ) : (
              <div className="mt-2 text-neutral-400">{t('crm.projects.analytics.map.noData')}</div>
            )}
          </div>
        )}

        {topology && (
          <div data-export-ignore className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm shadow-sm">
            <button type="button" className="h-7 w-7 hover:bg-neutral-50" onClick={() => zoomBy(1.6)} aria-label="Zoom in">
              +
            </button>
            <button
              type="button"
              className="h-7 w-7 border-t border-neutral-200 hover:bg-neutral-50"
              onClick={() => zoomBy(1 / 1.6)}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="h-7 w-7 border-t border-neutral-200 text-[11px] hover:bg-neutral-50"
              onClick={() => setView(baseView)}
              title={t('crm.projects.analytics.map.reset')}
              aria-label={t('crm.projects.analytics.map.reset')}
            >
              ⟲
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
        <div className="flex items-center gap-2">
          <span>{formatValue(0)}</span>
          <span
            className="h-2 w-28 rounded-full"
            style={{ background: `linear-gradient(90deg, ${mix(LOW, rgb, 0.15)}, ${mix(LOW, rgb, 1)})` }}
          />
          <span>{formatValue(pointsMode ? pointData.max : scopeMax)}</span>
        </div>
        {pointsMode && !geocode && <span>{t('crm.projects.analytics.map.pointsUnavailable')}</span>}
        {pointsMode && geo.failed && <span>{t('crm.projects.analytics.map.geocodeFailed')}</span>}
        {pointsMode && geo.pending > 0 && (
          <span>{t('crm.projects.analytics.map.geocoding', { count: geo.pending })}</span>
        )}
        {(pointsMode ? pointData.missing : unmatched).length > 0 && (
          <span title={(pointsMode ? pointData.missing : unmatched).join(', ')}>
            {t('crm.projects.analytics.map.unmatched', { count: (pointsMode ? pointData.missing : unmatched).length })}
          </span>
        )}
      </div>
    </div>
  );
};
