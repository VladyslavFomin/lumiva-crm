import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme, radius } from '../../theme/ThemeContext';

interface BlockProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: any;
}

/** Shimmering placeholder block — used instead of a bare spinner on every loading state. */
export const Skeleton: React.FC<BlockProps> = ({ width = '100%', height = 14, radius: r = 6, style }) => {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(1, { duration: 650 }), withTiming(0.5, { duration: 650 })), -1, true);
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.surfaceVariant }, animStyle, style]} />;
};

/** Skeleton matching one lead/deal/contact row: avatar circle + two text lines. */
export const SkeletonRow: React.FC = () => (
  <View style={styles.row}>
    <Skeleton width={36} height={36} radius={18} />
    <View style={{ flex: 1, gap: 6 }}>
      <Skeleton width="55%" height={13} />
      <Skeleton width="35%" height={10} />
    </View>
  </View>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <View>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonRow key={i} />
    ))}
  </View>
);

/** Skeleton matching a KPI/stat card in dashboards. */
export const SkeletonCard: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Skeleton width="40%" height={10} />
      <Skeleton width="60%" height={20} style={{ marginTop: 8 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  card: { flex: 1, borderRadius: radius.xxl, borderWidth: 1, padding: 14 },
});
