import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { requestPasswordReset } from '../../api/auth';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { AuthField } from './AuthField';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Button, EmptyState } from '../../components/ui';

export const ForgotPasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [clientKey, setClientKey] = useState<string>(route.params?.clientKey || '');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!email.includes('@') || !clientKey.trim()) {
      setError('Укажите клиентский ключ и рабочий e-mail');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(clientKey.trim(), email.trim());
      setSent(true);
    } catch {
      setError('Не удалось отправить письмо. Попробуйте позже.');
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
      <Text style={[styles.title, { color: colors.text }]}>Восстановление</Text>

      <View style={styles.content}>
        {sent ? (
          <>
            <EmptyState
              icon="mail-outline"
              title="Письмо отправлено"
              subtitle={`Ссылка на смену пароля ушла на ${email || 'указанный адрес'}. Действует 30 минут.`}
              ctaLabel="Ввести новый пароль"
              onCta={() => navigation.navigate('SetPassword', { clientKey: clientKey.trim(), email: email.trim() })}
            />
            <Button label="Отправить ещё раз" variant="secondary" fullWidth onPress={() => setSent(false)} />
            <Text style={[styles.note, { color: colors.textTertiary }]}>Если письма нет, проверьте спам или обратитесь к администратору пространства.</Text>
          </>
        ) : (
          <GlassCard variant="g" contentStyle={styles.card}>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>Укажите рабочий e-mail — пришлём ссылку для смены пароля.</Text>
            {!route.params?.clientKey && (
              <AuthField label="Клиентский ключ" required value={clientKey} onChangeText={setClientKey} placeholder="company-slug" autoCapitalize="none" mono />
            )}
            <AuthField label="Рабочий e-mail" required error={error} value={email} onChangeText={(v) => { setEmail(v); setError(null); }} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" />
            <Button label={busy ? 'Отправляем…' : 'Отправить ссылку'} variant="accent" fullWidth loading={busy} onPress={send} style={{ marginTop: spacing.xs }} />
            <Button label="Назад к входу" variant="secondary" fullWidth onPress={() => navigation.goBack()} />
          </GlassCard>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15, fontFamily: fonts.regular },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: 16, marginBottom: spacing.lg },
  content: { paddingHorizontal: 16, gap: spacing.sm },
  card: { padding: spacing.lg, gap: spacing.md },
  sub: { fontSize: 13, lineHeight: 18 },
  note: { fontSize: 11.5, textAlign: 'center', lineHeight: 16, paddingHorizontal: spacing.md },
});
