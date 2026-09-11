import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';

export type GlassVariant = 'g' | 'g2' | 'flat';

interface Props {
  variant?: GlassVariant;
  style?: StyleProp<ViewStyle>;
  /** Style for the inner content wrapper — pass `{ flex: 1 }` when a scrollable child (e.g. FlatList) needs a bounded height. */
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * RN port of `.g`/`.g2`/`.g-flat` from styles/mobile-glass.css — the core "liquid glass"
 * surface used for every card/sheet/chip in the new design.
 * - `g`  — strong blur + shadow + border highlight (headers, sheets, hero cards).
 * - `g2` — lighter blur, no shadow (nested/secondary surfaces).
 * - `flat` — no blur, translucent tint only (list rows inside an already-blurred container —
 *   blurring every row in a scrolling list is expensive and janky on RN, the design itself
 *   only blurs the outer list container, see mglass-kit.jsx `Skel`/`Empty`/`Failed`).
 */
export const GlassCard: React.FC<Props> = ({ variant = 'g', style, contentStyle, children }) => {
  const { colors, isDark } = useTheme();

  const cornerRadius = variant === 'g' ? 22 : variant === 'g2' ? 18 : 14;

  if (variant === 'flat') {
    // `.g-flat{background:var(--chip);border:1px solid var(--line)}` — a flat opaque chip, not a
    // blurred surface (`colors.surface` is the exact RN port of `--chip`; the border is `--line`,
    // NOT `--glass-b`/glassBorder — that near-white border is only for the blurred `.g`/`.g2`).
    return (
      <View style={[styles.base, { borderRadius: cornerRadius, backgroundColor: colors.surface, borderColor: colors.glassLine, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }, style]}>
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.base,
        { borderRadius: cornerRadius },
        variant === 'g' && (Platform.OS === 'ios'
          ? { shadowColor: colors.shadow, shadowOpacity: 1, shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, elevation: 6 }
          // Android's `elevation` always draws a flat, unthemeable dark ring — on a translucent
          // glass surface that reads as a harsh black outline instead of the design's soft
          // `0 10px 30px rgba(16,24,40,.10)` lift, so keep only a faint hint of depth there.
          : { elevation: 2 }),
        { borderColor: colors.glassBorder, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
        style,
      ]}
    >
      <BlurView
        intensity={variant === 'g' ? (isDark ? 40 : 60) : isDark ? 24 : 36}
        tint={isDark ? 'dark' : 'light'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFillObject}
      />
      {/* `.g`/`.g2` are `background:var(--glass|--glass-2)` — a top-to-bottom gradient (the glass
          "sheen"), not a flat tint. A single solid overlay flattens that signature look away. */}
      <LinearGradient
        colors={variant === 'g' ? colors.glassGradient : colors.glass2Gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* `.g`'s `box-shadow` also carries `inset 0 1px 0 var(--glass-hl)` — a hairline top
          highlight where the glass "catches the light". RN has no inset shadow, so approximate
          it with a 1px tinted line; `.g2` has no such inset highlight in the CSS, so skip it. */}
      {variant === 'g' && <View pointerEvents="none" style={[styles.topHighlight, { backgroundColor: colors.glassHighlight }]} />}
      <View style={contentStyle}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {},
  topHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
