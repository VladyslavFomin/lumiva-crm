import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { verifyTwoFactor } from '../../api/auth';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AuthShell } from './AuthShell';
import { AuthField } from './AuthField';
import { GlassCard } from '../../components/glass';
import { Button, showToast } from '../../components/ui';
import { saveLastIdentity, pushRecentWorkspace } from '../../auth/deviceAuthStore';

interface Props {
  onSuccess: () => void;
}

export const OtpScreen: React.FC<Props> = ({ onSuccess }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { challengeToken, email } = route.params || {};
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(30);

  useEffect(() => {
    const t = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 30)), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    if (code.length < 6) {
      setError('Введите код из аутентификатора или резервный код');
      return;
    }
    setBusy(true);
    try {
      const result = await verifyTwoFactor(challengeToken, code.trim());
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

  return (
    <AuthShell foot="Код меняется каждые 30 секунд в приложении-аутентификаторе.">
      <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant }]}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.text} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[styles.title, { color: colors.text }]}>Подтверждение входа</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Код из аутентификатора для {email}</Text>
      </View>

      <GlassCard variant="g" contentStyle={styles.card}>
        <AuthField
          label="Код из шести цифр" required error={error}
          aside={<Text style={[styles.timer, { color: left <= 5 ? colors.error : colors.textSecondary }]}>{left} с</Text>}
          value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
          placeholder="000000" keyboardType="number-pad" mono textAlign="center" fontSize={22} maxLength={6}
        />
        <View style={styles.dotsRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < code.length ? colors.accent : colors.surfaceVariant }]} />
          ))}
        </View>
        <Button label={busy ? 'Проверяем…' : 'Подтвердить'} variant="accent" fullWidth loading={busy} disabled={code.length !== 6} onPress={submit} style={{ marginTop: spacing.sm }} />
        <Button label="Назад" variant="secondary" fullWidth onPress={() => navigation.goBack()} style={{ marginTop: spacing.xs }} />
      </GlassCard>
      <Text style={[styles.backupNote, { color: colors.textTertiary }]}>Нет доступа к аутентификатору — в это же поле можно ввести один из резервных кодов.</Text>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  avatar: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, textAlign: 'center' },
  card: { padding: spacing.lg, gap: spacing.sm },
  timer: { fontSize: 11.5, fontFamily: fonts.mono },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { flex: 1, height: 4, borderRadius: radius.full },
  backupNote: { fontSize: 11.5, textAlign: 'center', lineHeight: 16, paddingHorizontal: spacing.sm },
});
