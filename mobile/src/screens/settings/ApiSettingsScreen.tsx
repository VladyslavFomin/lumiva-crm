import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchMarketingApiToken, revealMarketingApiToken, regenerateMarketingApiToken } from '../../api/settings';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { Button, FormField, AppBottomSheet, AppBottomSheetRef, SkeletonList, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

export const ApiSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const sheetRef = useRef<AppBottomSheetRef>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [suffix, setSuffix] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'reveal' | 'regenerate' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarketingApiToken()
      .then((t) => { setPreview(t.preview); setSuffix(t.suffix); })
      .catch(() => showToast('Не удалось загрузить токен', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const openPrompt = (action: 'reveal' | 'regenerate') => {
    setPendingAction(action);
    setPassword('');
    setError(null);
    sheetRef.current?.snapToIndex(0);
  };

  const submitPassword = async () => {
    if (!password) {
      setError('Введите пароль');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = pendingAction === 'reveal' ? await revealMarketingApiToken(password) : await regenerateMarketingApiToken(password);
      setRevealedToken(token);
      sheetRef.current?.close();
      if (pendingAction === 'regenerate') showToast('Токен пересоздан', { variant: 'success' });
    } catch (e: any) {
      setError(e?.response?.status === 403 ? 'Неверный пароль' : 'Не удалось выполнить действие');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Настройки</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>API-токен</Text>

      {loading ? (
        <View style={{ padding: spacing.lg }}><SkeletonList count={2} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Используется для интеграций (например, публичный каталог товаров). Полный токен виден только после подтверждения паролем.
          </Text>

          <GlassCard variant="g" style={styles.card} contentStyle={styles.cardRow}>
            <View style={[styles.icon, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="key-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text selectable style={[styles.tokenValue, { color: colors.text, fontFamily: fonts.mono }]}>
                {revealedToken || `${preview}••••••••${suffix}`}
              </Text>
            </View>
          </GlassCard>

          <View style={styles.actions}>
            <Button label="Показать" variant="secondary" onPress={() => openPrompt('reveal')} style={{ flex: 1 }} />
            <Button label="Пересоздать" variant="danger" onPress={() => openPrompt('regenerate')} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      )}

      <AppBottomSheet ref={sheetRef} snapPoints={['40%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>
          {pendingAction === 'regenerate' ? 'Пересоздать токен' : 'Показать токен'}
        </Text>
        <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>
          {pendingAction === 'regenerate' ? 'Старый токен перестанет работать. Подтвердите пароль.' : 'Подтвердите пароль, чтобы увидеть полный токен.'}
        </Text>
        <FormField label="Пароль" value={password} onChangeText={setPassword} placeholder="Ваш пароль" secureTextEntry />
        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
        <Button label="Подтвердить" variant="primary" fullWidth loading={submitting} onPress={submitPassword} style={{ marginTop: spacing.sm }} />
      </AppBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg },
  hint: { fontSize: 13, fontFamily: fonts.regular, lineHeight: 18, marginBottom: spacing.lg },
  card: { borderRadius: radius.xxl },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tokenValue: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  sheetTitle: { fontSize: 16, fontFamily: fonts.semibold },
  sheetHint: { fontSize: 12, fontFamily: fonts.regular, marginTop: 4, marginBottom: spacing.md },
  error: { fontSize: 12, fontFamily: fonts.medium, marginBottom: spacing.sm },
});
