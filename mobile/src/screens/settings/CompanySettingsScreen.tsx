import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchTenantSettings, updateTenantSettings } from '../../api/tenant';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { Button, FormField, SkeletonList, showToast } from '../../components/ui';
import { AuraBackground } from '../../components/glass';

export const CompanySettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [uiLanguage, setUiLanguage] = useState('');
  const [primaryCurrency, setPrimaryCurrency] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTenantSettings()
      .then((t) => {
        setName(t.name || '');
        setOwnerName(t.ownerName || '');
        setOwnerEmail(t.ownerEmail || '');
        setUiLanguage(t.uiLanguage || '');
        setPrimaryCurrency(t.primaryCurrency || '');
      })
      .catch(() => showToast('Не удалось загрузить настройки', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Введите название компании');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateTenantSettings({ name: name.trim(), ownerName: ownerName || undefined, ownerEmail: ownerEmail || undefined, uiLanguage: uiLanguage || undefined, primaryCurrency: primaryCurrency || undefined });
      showToast('Настройки сохранены', { variant: 'success' });
    } catch (e: any) {
      setError(e?.response?.status === 403 ? 'Изменять настройки может только владелец компании' : 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
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
      <Text style={[styles.title, { color: colors.text }]}>Компания</Text>

      {loading ? (
        <View style={{ padding: spacing.lg }}><SkeletonList count={3} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <FormField label="Название компании" value={name} onChangeText={setName} placeholder="Название компании" />
          <FormField label="Имя владельца" value={ownerName} onChangeText={setOwnerName} placeholder="Имя" />
          <FormField label="Email владельца" value={ownerEmail} onChangeText={setOwnerEmail} placeholder="owner@example.com" keyboardType="email-address" />
          <FormField label="Язык интерфейса" value={uiLanguage} onChangeText={setUiLanguage} placeholder="ru, en, tr…" />
          <FormField label="Валюта" value={primaryCurrency} onChangeText={setPrimaryCurrency} placeholder="EUR, USD, TRY…" />

          {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

          <Button label="Сохранить" variant="primary" fullWidth loading={saving} onPress={handleSave} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg },
  error: { fontSize: 12, fontFamily: fonts.medium, marginBottom: spacing.sm, marginTop: spacing.sm },
});
