import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { signup } from '../../api/auth';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { AuthField } from './AuthField';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Button, showToast } from '../../components/ui';

const KEY_RE = /^[a-z0-9-]{3,64}$/;

function slugify(v: string): string {
  return v.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export const SignupScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [companyName, setCompanyName] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const onCompanyName = (v: string) => {
    setCompanyName(v);
    if (!keyEdited) setClientKey(slugify(v));
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (companyName.trim().length < 2) e.companyName = 'Укажите название компании';
    if (!KEY_RE.test(clientKey)) e.clientKey = '3-64 символа: латиница, цифры, дефис';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Введите корректный e-mail';
    if (password.length < 8) e.password = 'Не короче 8 символов';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await signup({ companyName: companyName.trim(), clientKey, email: email.trim(), password });
      navigation.navigate('SignupVerify', { clientKey: res.clientKey, email: res.email });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Не удалось создать компанию';
      showToast(Array.isArray(msg) ? msg.join(', ') : String(msg), { variant: 'error' });
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
      <Text style={[styles.title, { color: colors.text }]}>Новая компания</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>14 дней Enterprise бесплатно, без карты</Text>

      <View style={styles.content}>
        <GlassCard variant="g" contentStyle={styles.card}>
          <AuthField label="Название компании" required error={errors.companyName} value={companyName} onChangeText={onCompanyName} placeholder="ООО Ромашка" />
          <AuthField
            label="Клиентский ключ" required error={errors.clientKey} value={clientKey}
            onChangeText={(v) => { setKeyEdited(true); setClientKey(slugify(v)); }}
            placeholder="romashka" autoCapitalize="none" mono
            help={errors.clientKey ? undefined : 'Так вы будете входить в пространство — сохраните его'}
          />
          <AuthField label="Рабочий e-mail" required error={errors.email} value={email} onChangeText={setEmail} placeholder="you@company.com" autoCapitalize="none" keyboardType="email-address" />
          <AuthField label="Пароль" required error={errors.password} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry help={errors.password ? undefined : 'Не короче 8 символов'} />
          <Button label={busy ? 'Создаём…' : 'Создать компанию'} variant="accent" fullWidth loading={busy} onPress={submit} style={{ marginTop: spacing.xs }} />
        </GlassCard>
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
});
