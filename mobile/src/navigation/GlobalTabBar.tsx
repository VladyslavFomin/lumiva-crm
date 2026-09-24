import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme/ThemeContext';
import { GlassCard } from '../components/glass';

export interface GlobalTabItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

interface Props {
  items: GlobalTabItem[];
  activeKey: string;
  onPress: (key: string) => void;
}

/**
 * Persistent app-shell tab bar, rendered once at the root navigator (not per-tab) so it stays
 * visible on every module screen (Sales, Products, Bookings, Marketing, …) — those are pushed as
 * sibling root-stack screens outside the old `Tab.Navigator`, which meant its `GlassTabBar` (an
 * internal tabBar prop) only ever showed on the 5 literal Tab.Screen routes. Visual twin of the
 * old `GlassTabBar`, but driven by `activeKey`/`onPress` instead of `BottomTabBarProps`.
 */
export const GlobalTabBar: React.FC<Props> = ({ items, activeKey, onPress }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {/* `<nav className="mg-tabs g">` in the design — the tab bar IS a `.g` glass surface, same
          gradient/border/highlight as any card, not a hand-tuned one-off. */}
      <GlassCard variant="g" style={styles.pill} contentStyle={styles.row}>
        {items.map((item) => {
          const isFocused = item.key === activeKey;
          const color = isFocused ? colors.text : colors.textTertiary;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => onPress(item.key)}
              style={[styles.item, isFocused && { backgroundColor: colors.surfaceVariant }]}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={isFocused ? item.iconFocused : item.icon} size={22} color={color} />
                {!!item.badge && (
                  <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.badgeTxt, { color: colors.accentFg }]} numberOfLines={1}>{item.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { color, fontFamily: isFocused ? fonts.semibold : fonts.medium }]} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 12, paddingTop: 8 },
  pill: { borderRadius: 26 },
  row: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 3, borderRadius: 18 },
  iconWrap: { position: 'relative' },
  badge: { position: 'absolute', top: -5, right: -11, minWidth: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeTxt: { fontSize: 9, fontFamily: fonts.semibold },
  label: { fontSize: 9.5, letterSpacing: 0 },
});
