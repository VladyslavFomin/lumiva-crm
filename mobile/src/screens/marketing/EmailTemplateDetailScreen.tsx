import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchEmailTemplate, updateEmailTemplate, deleteEmailTemplate, fetchEmailAccounts, sendTemplateEmail, EmailTemplate, EmailAccount } from '../../api/email';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { Button, FormField, SkeletonList, AppBottomSheet, AppBottomSheetRef, showToast } from '../../components/ui';
import { AuraBackground } from '../../components/glass';

export const EmailTemplateDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [sendTo, setSendTo] = useState('');
  const [sendAccountId, setSendAccountId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendSheetRef = useRef<AppBottomSheetRef>(null);

  useEffect(() => {
    fetchEmailAccounts().then((list) => {
      setAccounts(list);
      const active = list.find((a) => a.status === 'active') || list[0];
      if (active) setSendAccountId(active.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchEmailTemplate(id)
      .then((t) => {
        setTemplate(t);
        setName(t.name);
        setSubject(t.subject);
        setCategory(t.category);
        setHtmlBody(t.htmlBody);
      })
      .catch(() => showToast('Не удалось загрузить шаблон', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await updateEmailTemplate({ id: template.id, name, subject, category, htmlBody });
      showToast('Шаблон сохранён', { variant: 'success' });
      navigation.goBack();
    } catch {
      showToast('Не удалось сохранить шаблон', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!template || !sendAccountId) return;
    const to = sendTo.trim();
    if (!to) {
      showToast('Укажите email получателя', { variant: 'error' });
      return;
    }
    setSending(true);
    try {
      await sendTemplateEmail({ accountId: sendAccountId, to: [to], templateId: template.id });
      showToast('Письмо отправлено', { variant: 'success' });
      sendSheetRef.current?.close();
      setSendTo('');
    } catch {
      showToast('Не удалось отправить письмо', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = () => {
    if (!template) return;
    navigation.goBack();
    deleteEmailTemplate(template.id).then(() => showToast('Шаблон удалён', { variant: 'success' })).catch(() => showToast('Не удалось удалить шаблон', { variant: 'error' }));
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <AuraBackground />
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!template) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <AuraBackground />
        <Text style={{ color: colors.text }}>Шаблон не найден</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Шаблоны</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {accounts.length > 0 && (
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => sendSheetRef.current?.snapToIndex(0)}>
                <Ionicons name="send-outline" size={16} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={17} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <FormField label="Название" value={name} onChangeText={setName} placeholder="Название шаблона" />
          <FormField label="Тема письма" value={subject} onChangeText={setSubject} placeholder="Тема письма" />
          <FormField label="Категория" value={category} onChangeText={setCategory} placeholder="marketing, transactional…" />
          <FormField label="HTML-содержимое" value={htmlBody} onChangeText={setHtmlBody} placeholder="<p>Текст письма…</p>" multiline />

          <Button label="Сохранить" variant="primary" fullWidth loading={saving} onPress={handleSave} style={{ marginTop: spacing.sm }} />
        </ScrollView>

        <AppBottomSheet ref={sendSheetRef} snapPoints={['45%']}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Отправить по шаблону</Text>
          <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
            {accounts.length > 1 ? `С аккаунта: ${accounts.find((a) => a.id === sendAccountId)?.email || '—'}` : accounts[0]?.email}
          </Text>
          <FormField label="Получатель" value={sendTo} onChangeText={setSendTo} placeholder="client@example.com" keyboardType="email-address" />
          <Button label="Отправить" variant="primary" fullWidth loading={sending} onPress={handleSend} style={{ marginTop: spacing.md }} />
        </AppBottomSheet>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 16, fontFamily: fonts.semibold },
  sheetSub: { fontSize: 12, fontFamily: fonts.regular, marginTop: 4, marginBottom: spacing.md },
});
