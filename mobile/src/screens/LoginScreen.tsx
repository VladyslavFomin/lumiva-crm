import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { login } from '../api/auth';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  onSuccess: () => void;
}

export const LoginScreen: React.FC<Props> = ({ onSuccess }) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const toMessage = (err: any) => {
    const msg = err?.response?.data?.message ?? err?.message;
    if (Array.isArray(msg)) return msg.join('\n');
    if (typeof msg === 'object') {
      // Обработка объекта с ошибками валидации
      if (msg.email) return `Email: ${Array.isArray(msg.email) ? msg.email.join(', ') : msg.email}`;
      if (msg.password) return `Пароль: ${Array.isArray(msg.password) ? msg.password.join(', ') : msg.password}`;
      if (msg.tenantId) return `Tenant ID: ${Array.isArray(msg.tenantId) ? msg.tenantId.join(', ') : msg.tenantId}`;
      return JSON.stringify(msg);
    }
    return msg || 'Не удалось войти';
  };

  const handleLogin = async () => {
    // Валидация полей
    if (!email || !password || !tenantId) {
      Alert.alert('Ошибка', 'Заполните все поля: email, пароль и tenantId');
      return;
    }

    // Валидация формата email
    if (!validateEmail(email)) {
      Alert.alert('Ошибка', 'Введите корректный email адрес\nНапример: user@example.com');
      return;
    }

    // Валидация минимальной длины пароля
    if (password.length < 3) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 3 символа');
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), password, tenantId: tenantId.trim() });
      onSuccess();
    } catch (e: any) {
      console.error('Login error:', e);
      const errorMessage = toMessage(e);
      Alert.alert('Ошибка входа', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Text style={[styles.title, { color: colors.text }]}>Вход в Lumiva CRM</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Email (например example@site.com)"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Tenant ID (например web-key)"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          value={tenantId}
          onChangeText={setTenantId}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Пароль (например password)"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Входим…' : 'Войти'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
