import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, fonts, radius } from '../../theme/ThemeContext';

export interface SegmentOption {
  key: string;
  label: string;
}

interface Props {
  options: SegmentOption[];
  activeKey: string;
  onChange: (key: string) => void;
  scroll?: boolean;
  /** Tight inline variant (design's `.mg-seg` used inside a settings row, e.g. the theme toggle) — auto-width buttons instead of equal-flex tabs, smaller padding/text. */
  compact?: boolean;
}

/** Pill segmented control — RN port of `.mg-seg` (Трафик/Кампании tabs, Лиды Канбан/Список, etc).
 * `.mg-seg button.on{background:var(--glass);...}` — the active pill is the same gradient sheen
 * as any `.g` glass surface, so it gets the gradient + inset top highlight here too. It skips the
 * CSS's `backdrop-filter:blur(10px)` (nothing interesting to blur behind a flat `--fill` track)
 * and its `box-shadow`/elevation — Android's `elevation` renders as a hard dark halo around the
 * pill that reads as an unwanted black outline rather than the design's soft flat highlight. */
export const Segmented: React.FC<Props> = ({ options, activeKey, onChange, scroll, compact }) => {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.wrap, compact && styles.wrapCompact, { backgroundColor: colors.surfaceVariant, borderColor: colors.glassLine }]}>
      {options.map((o) => {
        const active = o.key === activeKey;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.btn, scroll && styles.btnScroll, compact && styles.btnCompact]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
          >
            {active && (
              <>
                <LinearGradient colors={colors.glassGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFillObject, styles.btnBg]} />
                <View pointerEvents="none" style={[styles.btnHighlight, { backgroundColor: colors.glassHighlight }]} />
              </>
            )}
            <Text style={[styles.label, compact && styles.labelCompact, { color: active ? colors.text : colors.textSecondary, fontFamily: active ? fonts.medium : fonts.regular }]} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  if (!scroll) return content;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {content}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth },
  wrapCompact: { padding: 2, alignSelf: 'flex-start' },
  btn: { flex: 1, paddingVertical: 7, paddingHorizontal: 10, borderRadius: radius.full, alignItems: 'center', overflow: 'hidden' },
  btnBg: { borderRadius: radius.full },
  btnHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  btnScroll: { flex: 0, minWidth: 72 },
  btnCompact: { flex: 0, paddingVertical: 5, paddingHorizontal: 10 },
  label: { fontSize: 12.5 },
  labelCompact: { fontSize: 11.5 },
});
