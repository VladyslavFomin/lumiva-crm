import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewProps, TextProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export const Card: React.FC<{ children: React.ReactNode; large?: boolean; style?: any }> = ({ children, large, style }) => {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: large ? colors.surfaceVariant : colors.card,
        borderColor: large ? colors.borderLight : colors.border,
        shadowColor: colors.shadow,
      },
      style
    ]}>
      {children}
    </View>
  );
};

export const Section: React.FC<{ title: string; right?: string; actionLabel?: string; onAction?: () => void; children: React.ReactNode }> = ({
  title,
  right,
  actionLabel,
  onAction,
  children,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {right ? <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>{right}</Text> : null}
          {actionLabel && onAction ? (
            <TouchableOpacity onPress={onAction}>
              <Text style={[styles.sectionAction, { color: colors.primary }]}>{actionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
};

export const KPI: React.FC<{ label: string; value: string | number; accent?: boolean }> = ({ label, value, accent }) => {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: accent ? colors.primary : colors.card,
        borderColor: accent ? colors.primary : colors.border,
        shadowColor: colors.shadow,
      }
    ]}>
      <Text style={[styles.label, { color: accent ? '#fff' : colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color: accent ? '#fff' : colors.text }]}>{value}</Text>
    </View>
  );
};

export const Pill: React.FC<{ text: string; color?: string; textColor?: string }> = ({ text, color, textColor }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: color || colors.surfaceVariant }]}>
      <Text style={[styles.pillText, { color: textColor || colors.primary }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  section: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionAction: { fontSize: 13, fontWeight: '600' },
  sectionSub: { fontSize: 12 },
  label: { fontSize: 12, marginBottom: 4, textTransform: 'uppercase' },
  kpiValue: { fontSize: 22, fontWeight: '700' },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '700' },
});
