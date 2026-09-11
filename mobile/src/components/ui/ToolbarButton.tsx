import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, radius, spacing } from '../../theme/ThemeContext';

interface Props {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  badge?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Compact toolbar button — mirrors the web app's `.lv-tb-btn` used above Leads/Projects/Sales lists. */
export const ToolbarButton: React.FC<Props> = ({ label, icon, active, badge, onPress, style }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: active ? colors.ink : colors.card,
          borderColor: active ? colors.ink : colors.line2,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? colors.onInk : colors.fg2} />}
      {label && (
        <Text style={[styles.label, { color: active ? colors.onInk : colors.fg2 }]} numberOfLines={1}>
          {label}
        </Text>
      )}
      {!!badge && (
        <View style={[styles.badge, { backgroundColor: active ? colors.onInk : colors.ink }]}>
          <Text style={[styles.badgeTxt, { color: active ? colors.ink : colors.onInk, fontFamily: fonts.monoSemibold }]}>
            {badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  label: { fontSize: 12.5, fontFamily: fonts.medium },
  badge: { minWidth: 16, height: 16, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeTxt: { fontSize: 9.5 },
});
