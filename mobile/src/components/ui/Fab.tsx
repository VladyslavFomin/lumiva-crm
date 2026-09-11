import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, radius } from '../../theme/ThemeContext';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  bottomOffset?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Dark square-ish FAB matching the web app's "+ Добавить" primary action, not an iOS circle. */
export const Fab: React.FC<Props> = ({ icon = 'add', onPress, bottomOffset = 24 }) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPressIn={() => (scale.value = withTiming(0.94, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 120 }))}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      style={[styles.base, style, { backgroundColor: colors.ink, bottom: bottomOffset }]}
    >
      <Ionicons name={icon} size={26} color={colors.onInk} />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
});
