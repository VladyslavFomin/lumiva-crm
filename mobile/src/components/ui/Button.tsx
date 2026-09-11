import React from 'react';
import { Text, StyleSheet, ViewStyle, StyleProp, ActivityIndicator, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, radius, spacing } from '../../theme/ThemeContext';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type ButtonSize = 'md' | 'sm';

interface Props {
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  style,
  fullWidth,
}) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 90 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };
  const handlePress = () => {
    if (variant === 'primary' || variant === 'accent' || variant === 'danger') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.ink, fg: colors.onInk, border: colors.ink },
    accent: { bg: colors.accent, fg: colors.accentFg, border: colors.accent },
    secondary: { bg: colors.card, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' },
    danger: { bg: colors.card, fg: colors.error, border: colors.error },
    icon: { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' },
  };
  const p = palette[variant];
  const isIconOnly = variant === 'icon' || (!label && !!icon);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      hitSlop={8}
      style={[
        animStyle,
        styles.base,
        (variant === 'primary' || variant === 'accent') && styles.shadowPrimary,
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: variant === 'ghost' || variant === 'icon' ? 0 : 1,
          paddingVertical: isIconOnly ? spacing.sm : size === 'sm' ? spacing.xs + 2 : spacing.sm + 2,
          paddingHorizontal: isIconOnly ? spacing.sm : size === 'sm' ? spacing.md : spacing.lg,
          borderRadius: radius.full,
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 15 : 17} color={p.fg} />}
          {label && (
            <Text
              style={[
                styles.label,
                {
                  color: p.fg,
                  fontSize: size === 'sm' ? 12.5 : 13.5,
                },
              ]}
            >
              {label}
            </Text>
          )}
        </>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shadowPrimary: {
    shadowColor: '#222222',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    fontFamily: fonts.medium,
  },
});
