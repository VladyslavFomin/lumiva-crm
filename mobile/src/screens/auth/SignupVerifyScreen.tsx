import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { verifySignupCode, resendSignupCode } from '../../api/auth';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { AuthShell } from './AuthShell';
import { AuthField } from './AuthField';
import { GlassCard } from '../../components/glass';
import { Button, showToast } from '../../components/ui';
import { saveLastIdentity, pushRecentWorkspace } from '../../auth/deviceAuthStore';

interface Props {
  onSuccess: () => void;
}

export const SignupVerifyScreen: React.FC<Props> = ({ onSuccess }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { clientKey, email } = route.params || {};
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async () => {
    if (code.length !== 6) {
      setError('Код состоит из 6 цифр');
      return;
    }
    setBusy(true);
    try {
      const result = await verifySignupCode(clientKey, email, code);
      await Promise.all([
        saveLastIdentity({ name: result.user.name || result.user.email, email: result.user.email, clientKey: result.clientKey }),
        pushRecentWorkspace({ clientKey: result.clientKey, email: result.user.email }),
      ]);
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Неверный код';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendSignupCode(clientKey, email);
      showToast('Новый код отправлен на почту', { variant: 'success' });
    } catch {
      showToast('Не удалось отправить код повторно', { variant: 'error' });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant }]}>
        <Ionicons name="mail-open-outline" size={22} color={colors.text} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[styles.title, { color: colors.text }]}>Подтвердите почту</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Код отправлен на {email} · пространство «{clientKey}»</Text>
      </View>
      <GlassCard variant="g" contentStyle={styles.card}>
        <AuthField
          label="Код из письма" required error={error}
          value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
          placeholder="000000" keyboardType="number-pad" mono textAlign="center" fontSize={22} maxLength={6}
        />
        <Button label={busy ? 'Проверяем…' : 'Подтвердить'} variant="accent" fullWidth loading={busy} disabled={code.length !== 6} onPress={submit} style={{ marginTop: spacing.xs }} />
        <Button label={resending ? 'Отправляем…' : 'Отправить код ещё раз'} variant="secondary" fullWidth loading={resending} onPress={resend} />
      </GlassCard>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  avatar: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 18 },
  card: { padding: spacing.lg, gap: spacing.md },
});
