import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';

interface Props {
  title: string;
  kicker?: string;
  sub?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

/** RN port of `Head` (mglass-core.jsx) — kicker/title/sub row + right-side icon buttons, with an optional slot below for segmented tabs/search/chips. */
export const MgHeader: React.FC<Props> = ({ title, kicker, sub, back, onBack, right, children }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {back && (
          <TouchableOpacity style={[styles.ib, { backgroundColor: colors.surfaceVariant }]} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ minWidth: 0, flex: 1 }}>
          {kicker && <Text style={[styles.kicker, { color: colors.textTertiary }]} numberOfLines={1}>{kicker.toUpperCase()}</Text>}
          <Text style={[back ? styles.h2 : styles.h1, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          {sub && <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>{sub}</Text>}
        </View>
        {right && <View style={styles.right}>{right}</View>}
      </View>
      {children}
    </View>
  );
};

export const HeaderIconButton: React.FC<{ icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; solid?: boolean; badge?: boolean }> = ({ icon, onPress, solid, badge }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.ib, { backgroundColor: solid ? colors.ink : colors.surfaceVariant, position: 'relative' }]}
      onPress={onPress}
      hitSlop={6}
    >
      <Ionicons name={icon} size={18} color={solid ? colors.onInk : colors.text} />
      {badge && <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.background }]} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  ib: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kicker: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 1.2, marginBottom: 2 },
  h1: { fontSize: 26, fontFamily: fonts.bold, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontFamily: fonts.semibold, letterSpacing: -0.3 },
  sub: { fontSize: 12.5, marginTop: 3 },
  dot: { position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
});
