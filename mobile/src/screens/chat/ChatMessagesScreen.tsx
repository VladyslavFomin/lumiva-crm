import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from './ChatStack';
import { fetchChatMessages, sendChatMessage, ChatMessage } from '../../api/chat';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatMessages'>;

function fmtTime(d: string) { return new Date(d).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }); }

export const ChatMessagesScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchChatMessages(id).then(setMessages).catch(() => showToast('Не удалось загрузить сообщения', { variant: 'error' }));
  }, [id]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const msg = await sendChatMessage(id, trimmed);
      setMessages((prev) => [...prev, msg]);
      setText('');
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
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Чаты</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mine = item.sender === 'staff';
            const isAssistant = item.sender === 'assistant';
            return (
              <View style={[styles.msgWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                <GlassCard variant="flat" style={[styles.bubble, mine && { backgroundColor: colors.ink, borderColor: colors.ink }]} contentStyle={styles.bubbleContent}>
                  {isAssistant && <Text style={[styles.aiTag, { color: colors.textTertiary }]}>AI-АССИСТЕНТ</Text>}
                  <Text style={{ color: mine ? colors.onInk : colors.text, fontFamily: fonts.regular, fontSize: 14 }}>{item.text}</Text>
                </GlassCard>
                <Text style={[styles.msgTime, { color: colors.textTertiary }]}>{fmtTime(item.createdAt)}</Text>
              </View>
            );
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <GlassCard variant="g" style={styles.inputRow} contentStyle={[styles.inputRowContent, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Напишите сообщение…"
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
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  msgWrap: { gap: 3 },
  bubble: { maxWidth: '82%', borderRadius: radius.xl },
  bubbleContent: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  aiTag: { fontSize: 9, fontFamily: fonts.semibold, marginBottom: 2, letterSpacing: 0.4 },
  msgTime: { fontSize: 10 },
  inputRow: { borderRadius: 0 },
  inputRowContent: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  input: { flex: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, maxHeight: 120, minHeight: 40 },
  sendBtn: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
});
