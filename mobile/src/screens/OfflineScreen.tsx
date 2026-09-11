import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, fonts, radius, spacing } from '../theme/ThemeContext';
import { AuraBackground, GlassCard } from '../components/glass';

interface Props {
  onRetry: () => void;
}

export const OfflineScreen: React.FC<Props> = ({ onRetry }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <GlassCard variant="g" style={styles.card}>
        <Text style={styles.icon}>📡</Text>
        <Text style={[styles.title, { color: colors.text }]}>Нет подключения</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Проверьте сеть и попробуйте снова</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.ink }]} onPress={onRetry}>
          <Text style={[styles.buttonText, { color: colors.onInk }]}>Повторить</Text>
        </TouchableOpacity>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    padding: spacing.xxl,
    borderRadius: radius.xxxl,
    alignItems: 'center',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    minWidth: 260,
    borderWidth: 1,
  },
  icon: { fontSize: 42, marginBottom: spacing.sm },
  title: { fontSize: 17, fontFamily: fonts.semibold },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 4 },
  button: { marginTop: spacing.lg, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.xxl },
  buttonText: { fontFamily: fonts.semibold },
});
