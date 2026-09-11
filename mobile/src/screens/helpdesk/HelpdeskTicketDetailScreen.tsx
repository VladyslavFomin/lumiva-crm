import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchHelpdeskTicket, replyToHelpdeskTicket, updateHelpdeskTicket, HelpdeskTicketDetail, HelpdeskMessage, HelpdeskTicketStatus } from '../../api/helpdesk';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, Button, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const STATUS_LABEL: Record<HelpdeskTicketStatus, string> = { open: 'Открыт', pending: 'Ожидает', resolved: 'Решён', closed: 'Закрыт' };
const STATUS_TONE: Record<HelpdeskTicketStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  open: 'acc', pending: 'warn', resolved: 'pos', closed: 'default',
};

function fmtTime(d: string) { return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }

export const HelpdeskTicketDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const listRef = useRef<FlatList>(null);

  const [ticket, setTicket] = useState<HelpdeskTicketDetail | null>(null);
  const [messages, setMessages] = useState<HelpdeskMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const { ticket: t, messages: m } = await fetchHelpdeskTicket(id);
      setTicket(t);
      setMessages(m);
    } catch {
      showToast('Не удалось загрузить тикет', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !ticket) return;
    setSending(true);
    try {
      const msg = await replyToHelpdeskTicket(ticket.id, trimmed);
      setMessages((prev) => [...prev, msg]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      showToast('Не удалось отправить ответ', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: HelpdeskTicketStatus) => {
    if (!ticket) return;
    try {
      const updated = await updateHelpdeskTicket(ticket.id, { status });
      setTicket(updated);
      showToast(`Тикет: ${STATUS_LABEL[status]}`, { variant: 'success' });
    } catch {
      showToast('Не удалось изменить статус', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Тикет не найден</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.line3 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.subject, { color: colors.text }]} numberOfLines={1}>{ticket.subject}</Text>
            <Text style={[styles.contact, { color: colors.textSecondary }]} numberOfLines={1}>{ticket.contactName || ticket.requesterName || 'Без имени'}</Text>
          </View>
          <Pill label={STATUS_LABEL[ticket.status]} tone={STATUS_TONE[ticket.status]} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mine = item.direction === 'outgoing';
            return (
              <View style={[styles.msgWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                <GlassCard variant="flat" style={[styles.bubble, mine && { backgroundColor: colors.ink, borderColor: colors.ink }]} contentStyle={styles.bubbleContent}>
                  {!mine && item.authorName && <Text style={[styles.authorName, { color: colors.textTertiary }]}>{item.authorName}</Text>}
                  <Text style={{ color: mine ? colors.onInk : colors.text, fontFamily: fonts.regular, fontSize: 14 }}>{item.text}</Text>
                </GlassCard>
                <Text style={[styles.msgTime, { color: colors.textTertiary }]}>{fmtTime(item.createdAt)}</Text>
              </View>
            );
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {ticket.status !== 'closed' && (
          <View style={styles.statusRow}>
            {ticket.status !== 'resolved' && <Button label="Решён" variant="secondary" size="sm" onPress={() => handleStatusChange('resolved')} />}
            <Button label="Закрыть" variant="ghost" size="sm" onPress={() => handleStatusChange('closed')} />
          </View>
        )}

        <GlassCard variant="g" style={styles.inputRow} contentStyle={[styles.inputRowContent, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Ответить клиенту…"
            placeholderTextColor={colors.textTertiary}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.ink, opacity: text.trim() ? 1 : 0.4 }]} onPress={handleSend} disabled={!text.trim() || sending}>
            <Ionicons name="arrow-up" size={18} color={colors.onInk} />
          </TouchableOpacity>
        </GlassCard>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 2 },
  subject: { fontSize: 15, fontFamily: fonts.semibold },
  contact: { fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  msgWrap: { gap: 3 },
  bubble: { maxWidth: '82%', borderRadius: radius.xl },
  bubbleContent: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  authorName: { fontSize: 10, fontFamily: fonts.semibold, marginBottom: 2, textTransform: 'uppercase' },
  msgTime: { fontSize: 10 },
  statusRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  inputRow: { borderRadius: 0 },
  inputRowContent: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  input: { flex: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, maxHeight: 120, minHeight: 40 },
  sendBtn: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
});
