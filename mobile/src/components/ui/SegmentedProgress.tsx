import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, fonts } from '../../theme/ThemeContext';

interface Props {
  stages: string[];
  activeIndex: number;
  activeColor?: string;
}

/** Horizontal stage/funnel progress — used for a deal's pipeline stage instead of a desktop stage table. */
export const SegmentedProgress: React.FC<Props> = ({ stages, activeIndex, activeColor }) => {
  const { colors } = useTheme();
  const accent = activeColor ?? colors.info;

  return (
    <View>
      <View style={styles.bar}>
        {stages.map((_, i) => (
          <React.Fragment key={i}>
            <View style={[styles.segment, { backgroundColor: i <= activeIndex ? accent : colors.line2 }]} />
            {i < stages.length - 1 && <View style={[styles.dot, { backgroundColor: colors.line2 }]} />}
          </React.Fragment>
        ))}
      </View>
      <View style={styles.labels}>
        {stages.map((s, i) => (
          <Text
            key={i}
            style={[
              styles.label,
              { color: i === activeIndex ? accent : colors.textTertiary, fontFamily: i === activeIndex ? fonts.monoSemibold : fonts.mono },
            ]}
          >
            {s.toUpperCase()}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 9, letterSpacing: 0.4 },
});
