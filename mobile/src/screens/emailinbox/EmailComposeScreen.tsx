import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EmailInboxStackParamList } from './EmailInboxStack';
import { sendNewEmail } from '../../api/emailInbox';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { EntityField, FieldCard } from '../../components/mg';
import { AuraBackground } from '../../components/glass';

type Props = NativeStackScreenProps<EmailInboxStackParamList, 'EmailCompose'>;

function parseEmails(raw: string): string[] {
  return raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

export const EmailComposeScreen: React.FC<Props> = ({ route, navigation }) => {
  const { accountId, contactId, leadId, companyId, initialTo, initialSubject, initialBody } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [to, setTo] = useState(initialTo || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(initialSubject || '');
  const [body, setBody] = useState(initialBody || '');
  const [sending, setSending] = useState(false);

  const canSend = parseEmails(to).length > 0 && !sending;

  const handleSend = async () => {
    const toList = parseEmails(to);
    if (toList.length === 0) {
      showToast('Укажите получателя', { variant: 'error' });
      return;
    }
    setSending(true);
    try {
      await sendNewEmail({
        accountId,
        to: toList,
        cc: cc.trim() ? parseEmails(cc) : undefined,
        subject: subject.trim() || undefined,
        textBody: body.trim() || undefined,
        contactId, leadId, companyId,
      } as any);
      showToast('Письмо отправлено', { variant: 'success' });
      navigation.goBack();
    } catch {
      showToast('Не удалось отправить письмо', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.line3 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semibold }]}>Новое письмо</Text>
        <TouchableOpacity onPress={handleSend} disabled={!canSend} hitSlop={8}>
          {sending ? <ActivityIndicator size="small" color={colors.ink} /> : (
            <Text style={[styles.sendTxt, { color: canSend ? colors.ink : colors.textTertiary, fontFamily: fonts.semibold }]}>Отправить</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <FieldCard>
          <EntityField label="Кому" value={to} onChangeText={setTo} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
          <EntityField label="Копия" value={cc} onChangeText={setCc} placeholder="необязательно" keyboardType="email-address" autoCapitalize="none" />
          <EntityField label="Тема" value={subject} onChangeText={setSubject} placeholder="Тема письма" />
          <EntityField label="Сообщение" value={body} onChangeText={setBody} placeholder="Текст письма…" multiline />
        </FieldCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 2 },
  title: { fontSize: 16 },
  sendTxt: { fontSize: 14 },
});
