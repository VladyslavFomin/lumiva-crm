import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';

export interface FunnelRow {
  label: string;
  value: number;
  displayValue: string;
  color?: string;
}

/** RN port of `.mg-funnel-step`/`.mg-funnel-track` — labeled horizontal bar rows (Analytics/Home funnels). */
export const FunnelBars: React.FC<{ rows: FunnelRow[]; max?: number }> = ({ rows, max }) => {
  const { colors } = useTheme();
  const m = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <View style={{ gap: spacing.xs }}>
      {rows.map((r, i) => (
        <View key={r.label} style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>{r.label}</Text>
          <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
            <View style={[styles.fill, { width: `${Math.max(2, (r.value / m) * 100)}%`, backgroundColor: r.color || colors.accent, opacity: 0.92 - i * 0.08 }]} />
          </View>
          <Text style={[styles.value, { color: colors.text, fontFamily: fonts.mono }]} numberOfLines={1}>{r.displayValue}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  label: { fontSize: 12.5, width: 88, fontFamily: fonts.regular },
  track: { flex: 1, height: 26, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 },
  value: { fontSize: 12.5, width: 56, textAlign: 'right' },
});
