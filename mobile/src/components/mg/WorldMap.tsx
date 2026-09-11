import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions, Pressable } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/** ISO2 -> world-atlas@2 `properties.name` — same static mapping used by the web CRM's map. */
const ISO2_TO_ATLAS_NAME: Record<string, string> = {
  TR: 'Turkey', GB: 'United Kingdom', DE: 'Germany', PL: 'Poland', FR: 'France', ES: 'Spain', IT: 'Italy',
  US: 'United States of America', NL: 'Netherlands', BE: 'Belgium', AT: 'Austria', CH: 'Switzerland',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', GR: 'Greece', PT: 'Portugal', CZ: 'Czechia',
  HU: 'Hungary', RO: 'Romania', BG: 'Bulgaria', UA: 'Ukraine', RU: 'Russia', AE: 'United Arab Emirates',
  SA: 'Saudi Arabia', EG: 'Egypt', IL: 'Israel', JP: 'Japan', CN: 'China', IN: 'India', AU: 'Australia',
  CA: 'Canada', BR: 'Brazil', MX: 'Mexico',
};
const ATLAS_NAME_TO_ISO2: Record<string, string> = Object.fromEntries(Object.entries(ISO2_TO_ATLAS_NAME).map(([k, v]) => [v, k]));

export interface CountryAgg { sessions: number; clicks: number; impressions: number }

function lerp(t: number, from: [number, number, number], to: [number, number, number]) {
  return `rgb(${from.map((c, i) => Math.round(c + (to[i] - c) * t)).join(',')})`;
}
function fillFor(v: number, max: number, emptyColor: string) {
  if (v <= 0 || max <= 0) return emptyColor;
  return lerp(Math.min(1, v / max), [255, 250, 235], [194, 65, 12]);
}

let cachedFeatures: any[] | null = null;

export const WorldMap: React.FC<{ byCountry: Map<string, CountryAgg>; loading?: boolean }> = ({ byCountry, loading }) => {
  const { colors } = useTheme();
  const { width: winWidth } = useWindowDimensions();
  const [features, setFeatures] = useState<any[] | null>(cachedFeatures);
  const [geoLoading, setGeoLoading] = useState(!cachedFeatures);
  const [geoFailed, setGeoFailed] = useState(false);
  const [selected, setSelected] = useState<{ name: string; agg: CountryAgg } | null>(null);

  useEffect(() => {
    if (cachedFeatures) return;
    let alive = true;
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (!alive) return;
        const fc: any = feature(topo, topo.objects.countries as any);
        cachedFeatures = fc.features;
        setFeatures(fc.features);
      })
      .catch(() => { if (alive) setGeoFailed(true); })
      .finally(() => { if (alive) setGeoLoading(false); });
    return () => { alive = false; };
  }, []);

  const width = Math.min(winWidth - spacing.lg * 2 - spacing.lg * 2, 600);
  const height = Math.round(width * 0.43);

  const { paths, hitBoxes, maxSessions, totalSessions } = useMemo(() => {
    if (!features) return { paths: [] as { d: string; iso: string | null; name: string }[], hitBoxes: [] as { iso: string | null; name: string; x: number; y: number; w: number; h: number }[], maxSessions: 0, totalSessions: 0 };
    const projection = geoMercator().scale(width * 0.12).center([15, 52]).translate([width / 2, height / 2]);
    const path = geoPath(projection as any);
    let max = 0;
    let total = 0;
    for (const agg of byCountry.values()) {
      if (agg.sessions > max) max = agg.sessions;
      total += agg.sessions;
    }
    const out = features.map((f: any) => {
      const name: string = f.properties?.name || '';
      const iso = ATLAS_NAME_TO_ISO2[name] || null;
      return { d: path(f) || '', iso, name };
    });
    // Plain RN Pressable overlays instead of SVG Path onPress — reliable tap hit-testing that
    // doesn't depend on react-native-svg's own (inconsistent on Android) touch handling.
    const boxes = features
      .map((f: any) => {
        const b = path.bounds(f);
        const name: string = f.properties?.name || '';
        return { iso: ATLAS_NAME_TO_ISO2[name] || null, name, x: b[0][0], y: b[0][1], w: b[1][0] - b[0][0], h: b[1][1] - b[0][1] };
      })
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.y) && b.w > 0 && b.h > 0)
      .sort((a, b) => b.w * b.h - a.w * a.h); // largest first → rendered first → smaller countries stack on top for taps
    return { paths: out, hitBoxes: boxes, maxSessions: max, totalSessions: total };
  }, [features, byCountry, width, height]);

  if (geoLoading || loading) {
    return (
      <View style={[styles.wrap, { height: height + 24, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.textTertiary} />
      </View>
    );
  }
  if (geoFailed) {
    return (
      <View style={[styles.wrap, { height: 80, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Не удалось загрузить карту мира</Text>
      </View>
    );
  }
  if (totalSessions === 0) {
    return (
      <View style={[styles.wrap, { height: 80, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', paddingHorizontal: spacing.lg }}>Нет строк с гео за выбранный период</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={{ width, height }}>
        <Svg width={width} height={height}>
          {paths.map((p, i) => {
            const agg = p.iso ? byCountry.get(p.iso) : undefined;
            const isSel = selected != null && p.iso != null && ATLAS_NAME_TO_ISO2[selected.name] === p.iso;
            return (
              <Path
                key={i}
                d={p.d}
                fill={fillFor(agg?.sessions || 0, maxSessions, colors.surfaceVariant)}
                stroke={isSel ? colors.text : colors.borderLight}
                strokeWidth={isSel ? 1.2 : 0.4}
              />
            );
          })}
        </Svg>
        {hitBoxes.map((b, i) => (
          <Pressable
            key={i}
            onPress={() => setSelected({ name: b.name, agg: (b.iso ? byCountry.get(b.iso) : undefined) || { sessions: 0, clicks: 0, impressions: 0 } })}
            style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h }}
          />
        ))}
      </View>

      {selected ? (
        <View style={[styles.tooltip, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <Text style={[styles.tooltipTitle, { color: colors.text }]}>{selected.name}</Text>
          <Text style={[styles.tooltipRow, { color: colors.textSecondary }]}>Сессии: <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{selected.agg.sessions.toLocaleString('ru-RU')}</Text></Text>
          <Text style={[styles.tooltipRow, { color: colors.textSecondary }]}>Клики: <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{selected.agg.clicks.toLocaleString('ru-RU')}</Text></Text>
          <Text style={[styles.tooltipRow, { color: colors.textSecondary }]}>Показы: <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{selected.agg.impressions.toLocaleString('ru-RU')}</Text></Text>
        </View>
      ) : (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>Нажмите на страну, чтобы увидеть цифры</Text>
      )}

      <View style={styles.legendRow}>
        <Text style={[styles.legendLabel, { color: colors.textTertiary }]}>Сессии (интенсивность)</Text>
        <Svg width={width} height={8}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgb(255,250,235)" />
              <Stop offset="1" stopColor="rgb(194,65,12)" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={8} rx={4} fill="url(#grad)" />
        </Svg>
        <View style={styles.legendEnds}>
          <Text style={[styles.legendEndTxt, { color: colors.textTertiary }]}>0</Text>
          <Text style={[styles.legendEndTxt, { color: colors.textTertiary }]}>{maxSessions.toLocaleString('ru-RU')}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  tooltip: { marginTop: spacing.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.sm, alignSelf: 'stretch' },
  tooltipTitle: { fontSize: 13, fontFamily: fonts.semibold, marginBottom: 3 },
  tooltipRow: { fontSize: 12, marginTop: 1 },
  hint: { fontSize: 11, marginTop: spacing.sm, fontStyle: 'italic' },
  legendRow: { marginTop: spacing.md, alignSelf: 'stretch' },
  legendLabel: { fontSize: 10, fontFamily: fonts.mono, letterSpacing: 0.5, marginBottom: 4 },
  legendEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  legendEndTxt: { fontSize: 9.5, fontFamily: fonts.mono },
});
