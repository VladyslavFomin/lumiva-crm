import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, fonts, radius } from '../../theme/ThemeContext';

export type PillTone = 'default' | 'pos' | 'neg' | 'warn' | 'acc';

interface Props {
  label: string;
  tone?: PillTone;
  dot?: boolean;
  dotColor?: string;
}

/** RN port of `.mg-pill` — small status/count badge used everywhere (statuses, ROAS, ROI, counts). */
export const Pill: React.FC<Props> = ({ label, tone = 'default', dot, dotColor }) => {
  const { colors } = useTheme();
  const toneColor: Record<PillTone, string> = {
    default: colors.textSecondary,
    pos: colors.success,
    neg: colors.error,
    warn: colors.warning,
    acc: colors.accent,
  };
  const toneBg: Record<PillTone, string> = {
    default: colors.surfaceVariant,
    pos: colors.successBg,
    neg: colors.errorBg,
    warn: colors.warningBg,
    acc: colors.accentSoft,
  };
  const fg = toneColor[tone];
  return (
    <View style={[styles.wrap, { backgroundColor: toneBg[tone] }]}>
      {dot && <View style={[styles.dot, { backgroundColor: dotColor || fg }]} />}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontFamily: fonts.medium },
});
