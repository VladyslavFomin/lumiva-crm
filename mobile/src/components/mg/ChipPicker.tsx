import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, fonts, radius } from '../../theme/ThemeContext';

export interface ChipPickerOption {
  key: string;
  label: string;
}

interface Props {
  options: ChipPickerOption[];
  value: string | string[];
  onChange: (value: any) => void;
  multi?: boolean;
}

/** RN port of `Pick` (mglass-kit.jsx) — a wrapping row of selectable chips for form fields (status, category, tags, team). Unlike `Chips`, this wraps to multiple lines instead of scrolling, and supports multi-select. */
export const ChipPicker: React.FC<Props> = ({ options, value, onChange, multi }) => {
  const { colors } = useTheme();
  const arr = multi ? (Array.isArray(value) ? value : []) : [value as string];
  const has = (k: string) => arr.includes(k);

  const toggle = (k: string) => {
    if (!multi) {
      onChange(k);
      return;
    }
    onChange(has(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  };

  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = has(o.key);
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, { backgroundColor: active ? colors.ink : colors.surfaceVariant }]}
            onPress={() => toggle(o.key)}
          >
            <Text style={[styles.label, { color: active ? colors.onInk : colors.text }]} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  label: { fontSize: 12.5, fontFamily: fonts.medium },
});
