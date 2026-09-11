import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { useCurrencyMode } from '../../context/CurrencyModeContext';

/** RN port of `CurrencyChip` — tap cycles the tenant's display currency (native vs converted mode). */
export const CurrencyChip: React.FC = () => {
  const { colors } = useTheme();
  const { cur, mode, symbol, cycleCurrency } = useCurrencyMode();
  return (
    <TouchableOpacity style={[styles.ib, { backgroundColor: colors.surfaceVariant }]} onPress={cycleCurrency} hitSlop={6}>
      <Text style={[styles.txt, { color: colors.text, opacity: mode === 'native' ? 0.55 : 1 }]}>{symbol(cur)}</Text>
    </TouchableOpacity>
  );
};

/** RN port of `ThemeChip` — tap toggles light/dark. */
export const ThemeChip: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  return (
    <TouchableOpacity style={[styles.ib, { backgroundColor: colors.surfaceVariant }]} onPress={toggleTheme} hitSlop={6}>
      <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={17} color={colors.text} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  ib: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txt: { fontSize: 15, fontFamily: fonts.semibold },
});
