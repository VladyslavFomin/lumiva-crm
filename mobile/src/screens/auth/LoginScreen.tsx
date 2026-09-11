import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { login } from '../../api/auth';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AuthShell, Mark } from './AuthShell';
import { AuthField } from './AuthField';
import { GlassCard } from '../../components/glass';
import { Button, showToast } from '../../components/ui';
import { getLastIdentity, getRecentWorkspaces, pushRecentWorkspace, saveLastIdentity, LastIdentity, RecentWorkspace } from '../../auth/deviceAuthStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_VERSION = Constants.expoConfig?.version || '—';

interface Props {
  onSuccess: () => void;
}

export const LoginScreen: React.FC<Props> = ({ onSuccess }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [errors, setErrors] = useState<{ password?: string; clientKey?: string }>({});
  const [busy, setBusy] = useState(false);
  const [faceIdBusy, setFaceIdBusy] = useState(false);
  const [identity, setIdentity] = useState<LastIdentity | null>(null);
  const [faceIdAvailable, setFaceIdAvailable] = useState(false);
  const [recents, setRecents] = useState<RecentWorkspace[]>([]);

  useEffect(() => {
    (async () => {
      const [savedIdentity, savedRecents, token] = await Promise.all([
        getLastIdentity(),
        getRecentWorkspaces(),
        AsyncStorage.getItem('auth_token'),
      ]);
      setIdentity(savedIdentity);
      setRecents(savedRecents);
      try {
        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        setFaceIdAvailable(!!token && hasHardware && isEnrolled);
      } catch {
        setFaceIdAvailable(false);
      }
      if (savedIdentity) {
        setEmail(savedIdentity.email);
        setClientKey(savedIdentity.clientKey);
      } else if (savedRecents[0]) {
        setClientKey(savedRecents[0].clientKey);
      }
    })();
  }, []);

  const handleFaceId = async () => {
    setFaceIdBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Войти в Lumiva', cancelLabel: 'Отмена' });
      if (result.success) {
        onSuccess();
      }
    } catch {
      showToast('Не удалось распознать Face ID — войдите вручную', { variant: 'error' });
    } finally {
      setFaceIdBusy(false);
    }
  };

  const submit = async () => {
    const e: typeof errors = {};
    if (!password) e.password = 'Введите пароль';
    if (!clientKey.trim()) e.clientKey = 'Ключ выдаёт администратор пространства';
    setErrors(e);
    if (Object.keys(e).length) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showToast('Введите корректный рабочий e-mail', { variant: 'error' });
      return;
    }
    setBusy(true);
    try {
      const result = await login({ email: email.trim(), password, tenantId: clientKey.trim(), clientKey: clientKey.trim() });
      if ('twoFactorRequired' in result) {
        navigation.navigate('Otp', { challengeToken: result.challengeToken, email: email.trim(), clientKey: clientKey.trim() });
        return;
      }
      await Promise.all([
        saveLastIdentity({ name: result.user.name || result.user.email, email: result.user.email, clientKey: result.clientKey }),
        pushRecentWorkspace({ clientKey: result.clientKey, email: result.user.email }),
      ]);
      onSuccess();
    } catch (err: any) {
      const data = err?.response?.data;
      const code = data?.code || data?.message?.code;
      if (code === 'TENANT_INACTIVE') {
        const reason = data?.reason || data?.message?.reason;
        const activeUntil = data?.activeUntil || data?.message?.activeUntil;
        navigation.navigate('TenantSuspended', { reason, activeUntil, clientKey: clientKey.trim() });
        return;
      }
      const msg = data?.message ?? err?.message ?? 'Не удалось войти';
      showToast(Array.isArray(msg) ? msg.join(', ') : String(msg), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell foot={<>Продолжая, вы принимаете условия обслуживания Lumiva.{'\n'}Версия {APP_VERSION}</>}>
      <Mark />
      <View style={{ gap: 4 }}>
        <Text style={[styles.title, { color: colors.text }]}>Вход в Lumiva</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Почта, пароль и клиентский ключ пространства</Text>
      </View>

      {faceIdAvailable && identity && (
        <>
          <TouchableOpacity onPress={handleFaceId} disabled={faceIdBusy} activeOpacity={0.85}>
            <GlassCard variant="g" contentStyle={styles.faceRow}>
              <View style={[styles.faceIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.faceTitle, { color: colors.text }]}>{faceIdBusy ? 'Распознаём лицо…' : 'Войти по Face ID'}</Text>
                <Text style={[styles.faceSub, { color: colors.textTertiary }]} numberOfLines={1}>{identity.name} · {identity.clientKey} · ключ сохранён</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
            </GlassCard>
          </TouchableOpacity>
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
            <Text style={[styles.dividerTxt, { color: colors.textTertiary }]}>или вручную</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
          </View>
        </>
      )}

      <GlassCard variant="g" contentStyle={styles.formCard}>
        <AuthField label="Рабочий e-mail" required value={email} onChangeText={setEmail} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" />
        <AuthField
          label="Пароль" required value={password} error={errors.password}
          onChangeText={(v) => { setPassword(v); setErrors((x) => ({ ...x, password: undefined })); }}
          placeholder="••••••••" secureTextEntry
          aside={<TouchableOpacity onPress={() => navigation.navigate('Forgot')}><Text style={[styles.linkChip, { color: colors.textSecondary, backgroundColor: colors.surfaceVariant }]}>Забыли?</Text></TouchableOpacity>}
        />
        <AuthField
          label="Клиентский ключ" required value={clientKey} error={errors.clientKey}
          onChangeText={(v) => { setClientKey(v); setErrors((x) => ({ ...x, clientKey: undefined })); }}
          placeholder="company-slug" autoCapitalize="none" mono
          help={errors.clientKey ? undefined : 'clientKey — выдаётся вместе с приглашением'}
        />

        {recents.length > 0 && (
          <View>
            <Text style={[styles.recentsLabel, { color: colors.textSecondary }]}>Рабочее пространство</Text>
            <View style={styles.chipsRow}>
              {recents.map((r) => (
                <TouchableOpacity key={r.clientKey} onPress={() => { setClientKey(r.clientKey); setEmail(r.email); }} style={[styles.chip, { backgroundColor: clientKey === r.clientKey ? colors.ink : colors.surfaceVariant }]}>
                  <Text style={[styles.chipTxt, { color: clientKey === r.clientKey ? colors.onInk : colors.text }]}>{r.clientKey}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Button label={busy ? 'Проверяем…' : 'Войти'} variant="accent" fullWidth loading={busy} onPress={submit} style={{ marginTop: spacing.xs }} />
        <View style={styles.hintRow}>
          <Ionicons name="shield-outline" size={13} color={colors.textTertiary} />
          <Text style={[styles.hintTxt, { color: colors.textTertiary }]}>При необходимости — код из аутентификатора</Text>
        </View>
      </GlassCard>

      <View style={styles.footRow}>
        <Button label="Новая компания" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => navigation.navigate('Signup')} />
        <Button label="Вход по приглашению" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => navigation.navigate('SetPassword', {})} />
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 27, fontFamily: fonts.bold, letterSpacing: -0.6, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 18 },

  faceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  faceIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  faceTitle: { fontSize: 14.5, fontFamily: fonts.semibold },
  faceSub: { fontSize: 11.5, marginTop: 2 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerTxt: { fontSize: 11.5 },

  formCard: { padding: spacing.lg, gap: spacing.md },
  linkChip: { fontSize: 11, fontFamily: fonts.medium, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full, overflow: 'hidden' },
  recentsLabel: { fontSize: 11.5, fontFamily: fonts.regular, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  chipTxt: { fontSize: 12.5, fontFamily: fonts.medium },

  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  hintTxt: { fontSize: 11.5 },

  footRow: { flexDirection: 'row', gap: spacing.sm },
});
