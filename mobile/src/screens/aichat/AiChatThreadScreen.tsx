import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AiChatStackParamList } from './AiChatStack';
import { fetchAiSessionMessages, sendAiChatMessage, AiChatMessage } from '../../api/aiChat';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<AiChatStackParamList, 'AiChatThread'>;

function fmtTime(d: string) { return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }

export const AiChatThreadScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [sessionId, setSessionId] = useState<string | null>(route.params?.sessionId || null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(!!sessionId);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    fetchAiSessionMessages(sessionId)
      .then((r) => setMessages(r.messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)))
      .catch(() => showToast('Не удалось загрузить переписку', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const optimistic: AiChatMessage = { id: `local-${Date.now()}`, sessionId: sessionId || '', role: 'user', content: trimmed, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setSending(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await sendAiChatMessage(sessionId, trimmed);
      if (!sessionId) setSessionId(res.sessionId);
      setMessages((prev) => [...prev, { id: `reply-${Date.now()}`, sessionId: res.sessionId, role: 'assistant', content: res.reply, createdAt: new Date().toISOString() }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      showToast('Не удалось отправить сообщение', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.line3 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>ИИ-ассистент</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                <View style={[styles.emptyIco, { backgroundColor: colors.ink }]}>
                  <Ionicons name="sparkles" size={22} color={colors.onInk} />
                </View>
                <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13 }}>Спросите что-нибудь о лидах, проектах или продажах</Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.role === 'user';
              return (
                <View style={[styles.msgWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                  <GlassCard variant="flat" style={[styles.bubble, mine && { backgroundColor: colors.ink, borderColor: colors.ink }]} contentStyle={styles.bubbleContent}>
                    <Text style={{ color: mine ? colors.onInk : colors.text, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
                  </GlassCard>
                  <Text style={[styles.msgTime, { color: colors.textTertiary }]}>{fmtTime(item.createdAt)}</Text>
                </View>
              );
            }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <GlassCard variant="g" style={styles.inputRow} contentStyle={[styles.inputRowContent, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Спросите ИИ-ассистента…"
            placeholderTextColor={colors.textTertiary}
            value={text}
            onChangeText={setText}
            multiline
            editable={!sending}
          />
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.ink, opacity: text.trim() && !sending ? 1 : 0.4 }]} onPress={handleSend} disabled={!text.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color={colors.onInk} /> : <Ionicons name="arrow-up" size={18} color={colors.onInk} />}
          </TouchableOpacity>
        </GlassCard>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  emptyIco: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  msgWrap: { gap: 3 },
  bubble: { maxWidth: '82%', borderRadius: radius.xl },
  bubbleContent: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  msgTime: { fontSize: 10 },
  inputRow: { borderRadius: 0 },
  inputRowContent: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  input: { flex: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, maxHeight: 120, minHeight: 40 },
  sendBtn: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
});
