import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
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
 * surface used for every card/sheet/chip in the new design. No native blur (see the comment
 * inside the component for why) — the "glass" read comes from the gradient sheen + border
 * highlight + shadow instead.
 * - `g`  — stronger gradient + shadow + top highlight (headers, sheets, hero cards).
 * - `g2` — lighter gradient, no shadow/highlight (nested/secondary surfaces).
 * - `flat` — opaque tint, no gradient (list rows inside an already-"glassed" container).
 */
export const GlassCard: React.FC<Props> = ({ variant = 'g', style, contentStyle, children }) => {
  const { colors } = useTheme();

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
          // Android's `elevation` always draws a flat, unthemeable dark ring, no matter how low
          // the value — on a translucent glass surface that reads as an unwanted dark outline
          // instead of the design's soft `0 10px 30px rgba(16,24,40,.10)` lift. iOS gets the real
          // shadow via shadow* above; Android gets none rather than a compromise that still shows.
          : null),
        { borderColor: colors.glassBorder, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
        style,
      ]}
    >
      {/* No BlurView here — expo-blur's Android implementation (`dimezisBlurView`) blurs
          whichever `react-native-screens` "Screen" ancestor it finds, or falls back to the app's
          root content view; on a real device this produced a uniform pale haze across every
          screen (cards, the always-mounted tab bar, even the unrelated auth stack) instead of a
          crisp frosted-card look — almost certainly a blur-root/snapshot-timing issue specific to
          this layout that isn't practical to debug without on-device native logs. The gradient +
          border + shadow below reproduce the "glass sheen" reliably without depending on a native
          blur implementation whose behavior we can't fully control or verify here. */}
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
