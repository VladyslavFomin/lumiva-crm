import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EmailInboxStackParamList } from './EmailInboxStack';
import { fetchEmailMessage, patchEmailMessage, htmlToPlainText, EmailMessage } from '../../api/emailInbox';
import { fetchLead } from '../../api/leads';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { Button, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

type Props = NativeStackScreenProps<EmailInboxStackParamList, 'EmailMessageDetail'>;

function fmtDate(d: string) {
  return new Date(d).toLocaleString(appLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const EmailMessageDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bodyWidth = width - spacing.lg * 2 - spacing.lg * 2;
  const [message, setMessage] = useState<EmailMessage | null>(null);
  const [leadName, setLeadName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmailMessage(id)
      .then((m) => {
        setMessage(m);
        if (m.leadId) fetchLead(m.leadId).then((l) => setLeadName(l.name || null)).catch(() => {});
      })
      .catch(() => showToast('Не удалось загрузить письмо', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReply = () => {
    if (!message) return;
    navigation.navigate('EmailCompose', {
      accountId: message.accountId,
      contactId: message.contactId || undefined,
      leadId: message.leadId || undefined,
      companyId: message.companyId || undefined,
      initialTo: message.from,
      initialSubject: message.subject?.toLowerCase().startsWith('re:') ? message.subject : `Re: ${message.subject || ''}`,
    });
  };

  const handleForward = () => {
    if (!message) return;
    const original = message.textBody?.trim() || (message.htmlBody ? htmlToPlainText(message.htmlBody) : '');
    const quoted = `\n\n---------- Пересланное сообщение ----------\nОт: ${message.fromName ? `${message.fromName} <${message.from}>` : message.from}\nДата: ${fmtDate(message.date)}\nТема: ${message.subject || '(без темы)'}\n\n${original}`;
    navigation.navigate('EmailCompose', {
      accountId: message.accountId,
      initialSubject: message.subject?.toLowerCase().startsWith('fwd:') ? message.subject : `Fwd: ${message.subject || ''}`,
      initialBody: quoted,
    });
  };

  const toggleStar = async () => {
    if (!message) return;
    const next = !message.isStarred;
    setMessage({ ...message, isStarred: next });
    try {
      await patchEmailMessage(message.id, { isStarred: next });
    } catch {
      setMessage((prev) => (prev ? { ...prev, isStarred: !next } : prev));
      showToast('Не удалось изменить статус', { variant: 'error' });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.line3 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.semibold }]}>Письмо</Text>
        </TouchableOpacity>
        {message && (
          <TouchableOpacity onPress={toggleStar} hitSlop={8}>
            <Ionicons name={message.isStarred ? 'star' : 'star-outline'} size={20} color={message.isStarred ? colors.warning : colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {loading || !message ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 90 }}>
          <Text style={[styles.subject, { color: colors.text }]}>{message.subject || '(без темы)'}</Text>

          <GlassCard variant="flat" style={styles.metaCard} contentStyle={styles.metaCardContent}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>От</Text>
              <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>{message.fromName ? `${message.fromName} <${message.from}>` : message.from}</Text>
            </View>
            {message.to.length > 0 && (
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>Кому</Text>
                <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={2}>{message.to.join(', ')}</Text>
              </View>
            )}
            {message.cc.length > 0 && (
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>Копия</Text>
                <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={2}>{message.cc.join(', ')}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>Дата</Text>
              <Text style={[styles.metaValue, { color: colors.text, fontFamily: fonts.mono }]}>{fmtDate(message.date)}</Text>
            </View>
          </GlassCard>

          <GlassCard variant="g" style={styles.bodyCard} contentStyle={styles.bodyCardContent}>
            {message.htmlBody ? (
              <RenderHtml
                contentWidth={bodyWidth}
                source={{ html: message.htmlBody }}
                baseStyle={{ color: colors.text, fontSize: 14.5, lineHeight: 22 }}
                tagsStyles={{
                  a: { color: colors.accent },
                  img: { borderRadius: radius.sm },
                }}
                enableExperimentalMarginCollapsing
                renderersProps={{ a: { onPress: (_, href) => Linking.openURL(href).catch(() => {}) } }}
              />
            ) : (
              <Text style={[styles.bodyTxt, { color: colors.text }]}>
                {message.textBody?.trim() || 'Текст письма отсутствует'}
              </Text>
            )}
          </GlassCard>

          {message.leadId && (
            <TouchableOpacity
              style={styles.leadLink}
              activeOpacity={0.7}
              onPress={() => (navigation as any).navigate('App', { screen: 'Leads', params: { screen: 'LeadDetail', params: { id: message.leadId } } })}
            >
              <GlassCard variant="flat" style={styles.leadLinkCard} contentStyle={styles.leadLinkContent}>
                <Ionicons name="flash-outline" size={16} color={colors.accent} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.leadLinkLabel, { color: colors.textTertiary }]}>Связанный лид</Text>
                  <Text style={[styles.leadLinkName, { color: colors.text }]} numberOfLines={1}>{leadName || 'Открыть'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </GlassCard>
            </TouchableOpacity>
          )}

          {!!message.attachments?.length && (
            <View style={styles.attachSection}>
              <Text style={[styles.attachTitle, { color: colors.textSecondary }]}>Вложения ({message.attachments.length})</Text>
              {message.attachments.map((a, i) => (
                <GlassCard key={i} variant="flat" style={styles.attachRow} contentStyle={styles.attachRowContent}>
                  <Ionicons name="document-attach-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.attachName, { color: colors.text }]} numberOfLines={1}>{a.filename}</Text>
                  <Text style={[styles.attachSize, { color: colors.textTertiary }]}>{Math.round(a.size / 1024)} КБ</Text>
                </GlassCard>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {!loading && message && (
        <View style={[styles.actionsBar, { bottom: insets.bottom + 12, backgroundColor: colors.cardElevated, borderColor: colors.line3 }]}>
          <Button label="Ответить" variant="accent" size="sm" style={{ flex: 1 }} onPress={handleReply} />
          <Button label="Переслать" variant="secondary" size="sm" style={{ flex: 1 }} onPress={handleForward} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backTxt: { fontSize: 16 },
  subject: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3, marginBottom: spacing.md },
  metaCard: { borderRadius: radius.lg, marginBottom: spacing.md },
  metaCardContent: { padding: spacing.md, gap: 6 },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  metaLabel: { fontSize: 11, fontFamily: fonts.medium, width: 52 },
  metaValue: { fontSize: 13, fontFamily: fonts.regular, flex: 1 },
  bodyCard: { borderRadius: radius.lg },
  bodyCardContent: { padding: spacing.lg },
  bodyTxt: { fontSize: 14.5, fontFamily: fonts.regular, lineHeight: 22 },
  attachSection: { marginTop: spacing.lg, gap: spacing.sm },
  attachTitle: { fontSize: 12, fontFamily: fonts.medium, marginBottom: 2 },
  attachRow: { borderRadius: radius.md },
  attachRowContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  attachName: { flex: 1, fontSize: 13 },
  attachSize: { fontSize: 11 },
  leadLink: { marginBottom: spacing.md },
  leadLinkCard: { borderRadius: radius.lg },
  leadLinkContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  leadLinkLabel: { fontSize: 10.5, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.4 },
  leadLinkName: { fontSize: 14, fontFamily: fonts.semibold, marginTop: 1 },
  actionsBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
});
