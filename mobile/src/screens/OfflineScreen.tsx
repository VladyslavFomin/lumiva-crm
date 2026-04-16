import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  onRetry: () => void;
}

export const OfflineScreen: React.FC<Props> = ({ onRetry }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Text style={styles.icon}>📡</Text>
        <Text style={[styles.title, { color: colors.text }]}>Нет подключения</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Проверьте сеть и попробуйте снова</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={onRetry}>
          <Text style={styles.buttonText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    minWidth: 260,
    borderWidth: 1,
  },
  icon: { fontSize: 42, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 4 },
  button: { marginTop: 16, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
