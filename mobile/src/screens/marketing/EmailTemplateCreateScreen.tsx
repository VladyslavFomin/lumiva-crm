import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { createEmailTemplate } from '../../api/email';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { Button, FormField, showToast } from '../../components/ui';
import { AuraBackground } from '../../components/glass';

export const EmailTemplateCreateScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Укажите название шаблона');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createEmailTemplate({ name: name.trim(), subject: subject || undefined, category: category || undefined, htmlBody: htmlBody || undefined });
      showToast('Шаблон создан', { variant: 'success' });
      navigation.goBack();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Не удалось создать шаблон');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.text }]}>Новый шаблон</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <FormField label="Название" value={name} onChangeText={setName} placeholder="Приветственное письмо" />
          <FormField label="Тема письма" value={subject} onChangeText={setSubject} placeholder="Добро пожаловать, {{lead.name}}!" />
          <FormField label="Категория" value={category} onChangeText={setCategory} placeholder="marketing, transactional…" />
          <FormField label="HTML-содержимое" value={htmlBody} onChangeText={setHtmlBody} placeholder="<p>Текст письма…</p>" multiline />

          {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

          <Button label="Создать шаблон" variant="primary" fullWidth loading={loading} onPress={submit} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { padding: 2 },
  navTitle: { fontSize: 16, fontFamily: fonts.semibold },
  error: { fontSize: 12, fontFamily: fonts.medium, marginBottom: spacing.sm },
});
