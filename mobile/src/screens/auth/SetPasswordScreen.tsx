import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { setPassword as setPasswordApi } from '../../api/auth';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { AuthField } from './AuthField';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Button, showToast } from '../../components/ui';

function extractToken(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/[?&]token=([^&\s]+)/);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

export const SetPasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [tokenInput, setTokenInput] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email: string | undefined = route.params?.email;
  const lenOk = p1.length >= 8;
  const matchOk = p1.length > 0 && p1 === p2;
  const ok = lenOk && matchOk && !!tokenInput.trim();

  const submit = async () => {
    if (!ok) {
      setError(!tokenInput.trim() ? 'Вставьте код или ссылку из письма' : !lenOk ? 'Пароль должен быть не короче 8 символов' : 'Пароли не совпадают');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setPasswordApi(extractToken(tokenInput), p1);
      showToast('Пароль обновлён — войдите с новым паролем', { variant: 'success' });
      navigation.navigate('Login');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Ссылка недействительна или устарела';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text }]}>Вход</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Новый пароль</Text>
      {email && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{email}</Text>}

      <View style={styles.content}>
        <GlassCard variant="g" contentStyle={styles.card}>
          <AuthField
            label="Код или ссылка из письма" required value={tokenInput}
            onChangeText={(v) => { setTokenInput(v); setError(null); }}
            placeholder="вставьте ссылку целиком или сам код" autoCapitalize="none"
            help="Пришло на почту вместе с приглашением или запросом восстановления"
          />
          <AuthField label="Новый пароль" required value={p1} onChangeText={setP1} placeholder="••••••••••" secureTextEntry />
          <AuthField label="Повторите пароль" required error={p2 && p1 !== p2 ? 'Пароли не совпадают' : undefined} value={p2} onChangeText={setP2} placeholder="••••••••••" secureTextEntry />
          <View style={styles.ruleRow}>
            <Ionicons name={lenOk ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={lenOk ? colors.success : colors.textTertiary} />
            <Text style={[styles.ruleTxt, { color: lenOk ? colors.success : colors.textSecondary }]}>Не короче 8 символов</Text>
          </View>
          {error && <Text style={[styles.errorTxt, { color: colors.error }]}>{error}</Text>}
          <Button label={busy ? 'Сохраняем…' : 'Сохранить пароль'} variant="accent" fullWidth loading={busy} disabled={!ok} onPress={submit} style={{ marginTop: spacing.xs }} />
        </GlassCard>
        <Text style={[styles.note, { color: colors.textTertiary }]}>После смены пароля активные сессии на других устройствах завершатся.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15, fontFamily: fonts.regular },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: 16 },
  subtitle: { fontSize: 12.5, paddingHorizontal: 16, marginTop: 2, marginBottom: spacing.sm },
  content: { paddingHorizontal: 16, gap: spacing.sm, marginTop: spacing.sm },
  card: { padding: spacing.lg, gap: spacing.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ruleTxt: { fontSize: 12 },
  errorTxt: { fontSize: 12 },
  note: { fontSize: 11.5, textAlign: 'center', lineHeight: 16, paddingHorizontal: spacing.md },
});
