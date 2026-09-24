import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line as SvgLine } from 'react-native-svg';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { appLocale } from '../../i18n/format';

export interface TapChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface Props {
  dates: string[];
  series: TapChartSeries[];
  height?: number;
  formatValue?: (v: number, seriesKey: string) => string;
  formatDate?: (d: string) => string;
}

/** Multi-line chart with per-point tap targets — tap any point to see its date + values (no hover on touch devices). */
export const TapChart: React.FC<Props> = ({ dates, series, height = 160, formatValue, formatDate }) => {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const w = 320;
  const n = dates.length;

  const { paths, points, max } = useMemo(() => {
    const allValues = series.flatMap((s) => s.values);
    const max = Math.max(1, ...allValues);
    const x = (i: number) => (n > 1 ? (i / (n - 1)) * w : w / 2);
    const y = (v: number) => height - (v / max) * (height - 10) - 4;
    const paths = series.map((s) => ({
      key: s.key,
      color: s.color,
      d: s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' '),
    }));
    const points = dates.map((_, i) => x(i));
    return { paths, points, max };
  }, [series, dates, n, height, w]);

  const idx = selected ?? n - 1;
  const fmtV = formatValue || ((v: number) => v.toLocaleString(appLocale()));
  const fmtD = formatDate || ((d: string) => d);

  if (n < 2) {
    return <View style={{ height }} />;
  }

  return (
    <View>
      <View style={styles.tooltipRow}>
        <Text style={[styles.tooltipDate, { color: colors.text }]}>{fmtD(dates[idx])}</Text>
        {selected == null && <Text style={[styles.tooltipHint, { color: colors.textTertiary }]}>· нажмите на график</Text>}
      </View>
      <View style={styles.legendRow}>
        {series.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{s.label}: </Text>
            <Text style={[styles.legendValue, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmtV(s.values[idx], s.key)}</Text>
          </View>
        ))}
      </View>

      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        {selected != null && (
          <SvgLine x1={points[selected]} y1={0} x2={points[selected]} y2={height} stroke={colors.borderLight} strokeWidth={1} strokeDasharray="3,3" />
        )}
        {paths.map((p) => (
          <Path key={p.key} d={p.d} stroke={p.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map((s) =>
          s.values.map((v, i) => (
            <Circle
              key={`${s.key}-${i}`}
              cx={points[i]}
              cy={height - (v / max) * (height - 10) - 4}
              r={i === idx ? 3.5 : 2}
              fill={s.color}
              opacity={i === idx ? 1 : 0.55}
            />
          )),
        )}
        {points.map((px, i) => (
          <Circle key={`hit-${i}`} cx={px} cy={height / 2} r={height / 2} fill="transparent" onPress={() => setSelected(i)} />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  tooltipRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 },
  tooltipDate: { fontSize: 13, fontFamily: fonts.semibold },
  tooltipHint: { fontSize: 11 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendLabel: { fontSize: 11.5 },
  legendValue: { fontSize: 11.5 },
});
