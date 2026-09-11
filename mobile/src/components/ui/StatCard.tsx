import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, radius, spacing } from '../../theme/ThemeContext';

interface Props {
  label: string;
  value: string;
  sublabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}

/** KPI tile for dashboards/analytics grids. `accent` fills it with the ink color for the "hero" stat. */
export const StatCard: React.FC<Props> = ({ label, value, sublabel, icon, accent }) => {
  const { colors } = useTheme();
  const fg = accent ? colors.onInk : colors.text;
  const fgMuted = accent ? colors.onInk : colors.textSecondary;

  return (
    <View style={[styles.card, { backgroundColor: accent ? colors.ink : colors.card, borderColor: accent ? colors.ink : colors.line3 }]}>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: accent ? 'rgba(255,255,255,0.14)' : colors.surfaceVariant }]}>
          <Ionicons name={icon} size={14} color={fgMuted} style={{ opacity: accent ? 1 : 0.7 }} />
        </View>
      )}
      <Text style={[styles.label, { color: fgMuted, opacity: accent ? 0.7 : 1 }]}>{label}</Text>
      <Text style={[styles.value, { color: fg }]}>{value}</Text>
      {sublabel && <Text style={[styles.sublabel, { color: fgMuted, opacity: accent ? 0.7 : 1 }]}>{sublabel}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: '45%', borderRadius: radius.xxl, borderWidth: 1, padding: 14, gap: 4 },
  iconWrap: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  label: { fontSize: 10, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  sublabel: { fontSize: 11, fontFamily: fonts.medium },
});
