import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { Button } from './Button';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  /** Optional Lottie source (require('...json')) — replaces the icon bubble when provided. */
  lottieSource?: any;
}

export const EmptyState: React.FC<Props> = ({ icon, title, subtitle, ctaLabel, onCta, lottieSource }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {lottieSource ? (
        <LottieView source={lottieSource} autoPlay loop style={styles.lottie} />
      ) : (
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceVariant }]}>
          <Ionicons name={icon} size={28} color={colors.textTertiary} />
        </View>
      )}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      {ctaLabel && onCta ? <Button label={ctaLabel} variant="accent" size="sm" onPress={onCta} style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: 32, gap: 4 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  lottie: { width: 120, height: 120, marginBottom: 4 },
  title: { fontSize: 15, fontFamily: fonts.semibold, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
