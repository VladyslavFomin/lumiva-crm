import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { GlassCard } from '../glass';

export interface StatGrid2Item {
  label: string;
  value: string;
}

/** RN port of `.mg-grid2` — 2-column grid of small glass stat tiles (kicker + big mono value). */
export const StatGrid2: React.FC<{ items: StatGrid2Item[] }> = ({ items }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((it) => (
        <GlassCard key={it.label} variant="g2" style={styles.cell} contentStyle={styles.cellContent}>
          <Text style={[styles.kicker, { color: colors.textTertiary }]} numberOfLines={1}>{it.label.toUpperCase()}</Text>
          <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>{it.value}</Text>
        </GlassCard>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  cell: { flexBasis: '47%', flexGrow: 1, borderRadius: 18 },
  cellContent: { paddingHorizontal: 14, paddingVertical: 13 },
  kicker: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.6 },
  value: { fontSize: 20, fontFamily: fonts.semibold, marginTop: 3, letterSpacing: -0.3 },
});
