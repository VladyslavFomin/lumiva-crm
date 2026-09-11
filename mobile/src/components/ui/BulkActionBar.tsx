import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, radius, spacing } from '../../theme/ThemeContext';

export interface BulkAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}

interface Props {
  count: number;
  actions: BulkAction[];
  onClose: () => void;
  bottomOffset?: number;
}

/** Floating bulk-action bar for the multi-select mode — mirrors the web app's `.lv-bulk-bar`. */
export const BulkActionBar: React.FC<Props> = ({ count, actions, onClose, bottomOffset = 24 }) => {
  const { colors } = useTheme();
  if (count === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(150)}
      style={[styles.bar, { backgroundColor: colors.ink, bottom: bottomOffset }]}
    >
      <Text style={[styles.count, { color: colors.onInk, fontFamily: fonts.monoSemibold }]}>{count}</Text>
      {actions.map((a, i) => (
        <TouchableOpacity
          key={i}
          onPress={a.onPress}
          style={[styles.btn, a.danger && { backgroundColor: 'rgba(255,255,255,0.06)' }]}
          activeOpacity={0.7}
        >
          <Ionicons name={a.icon} size={15} color={a.danger ? '#ff6b81' : colors.onInk} />
          <Text style={[styles.btnLabel, { color: a.danger ? '#ff6b81' : colors.onInk }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={onClose} style={styles.close} hitSlop={8}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: radius.xl,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
  },
  count: { fontSize: 13, marginRight: 2 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.06)' },
  btnLabel: { fontSize: 12, fontFamily: fonts.medium },
  close: { padding: 4, marginLeft: 'auto' },
});
