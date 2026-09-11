import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme, fonts, radius } from '../../theme/ThemeContext';

export interface ChipOption {
  key: string;
  label: string;
  count?: number;
  dotColor?: string;
}

interface Props {
  options: ChipOption[];
  activeKey: string;
  onChange: (key: string) => void;
}

/** RN port of `.mg-chips`/`.mg-chip` — horizontal scroll filter row with per-option counts (entity pickers, status filters). */
export const Chips: React.FC<Props> = ({ options, activeKey, onChange }) => {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const active = o.key === activeKey;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, { backgroundColor: active ? colors.ink : colors.surfaceVariant }]}
            onPress={() => onChange(o.key)}
          >
            {o.dotColor && <View style={[styles.dot, { backgroundColor: active ? colors.onInk : o.dotColor }]} />}
            <Text style={[styles.label, { color: active ? colors.onInk : colors.text }]} numberOfLines={1}>{o.label}</Text>
            {o.count !== undefined && (
              <Text style={[styles.count, { color: active ? colors.onInk : colors.textTertiary }]}>{o.count}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 12.5, fontFamily: fonts.medium, flexShrink: 1 },
  count: { fontSize: 10.5, fontFamily: fonts.mono },
});
