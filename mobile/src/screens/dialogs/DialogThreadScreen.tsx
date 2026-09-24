import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
// expo-file-system v19 (SDK 54) replaced downloadAsync()/cacheDirectory with a new File/Directory
// API — the legacy import keeps the old imperative API, the better fit for "download to a temp
// file, then hand it to the OS share sheet" (see CallDetailScreen for the original use of this).
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { DialogsStackParamList } from './DialogsStack';
import { fetchChatMessages, sendChatMessage, ChatMessage } from '../../api/chat';
import { fetchTelegramMessages, sendTelegramMessage, markTelegramContactRead, getTelegramAttachmentDownloadInfo, TelegramMessage, TelegramAttachment } from '../../api/telegramCrm';
import { fetchWhatsappMessages, sendWhatsappMessage, markWhatsappContactRead, WhatsappMessage } from '../../api/whatsappCrm';
import { fetchEmailMessages, sendNewEmail, patchEmailMessage, htmlToPlainText, EmailMessage } from '../../api/emailInbox';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

type Props = NativeStackScreenProps<DialogsStackParamList, 'DialogThread'>;

interface NormalizedMessage {
  id: string;
  mine: boolean;
  text: string;
  createdAt: string;
  /** Only populated for Telegram today — WhatsApp/chat attachments need the same kind of
   * authenticated-proxy endpoint on their own backends, which doesn't exist yet (see
   * `fetchAttachmentFile` on the Telegram side for the pattern to copy). */
  attachments?: TelegramAttachment[];
}

function fmtTime(d: string) { return new Date(d).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }); }

const ATTACHMENT_LABEL: Record<string, string> = { document: 'Файл', voice: 'Голосовое сообщение', video: 'Видео' };
const ATTACHMENT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { document: 'document-outline', voice: 'mic-outline', video: 'videocam-outline' };

/** Inline photo bubble — resolves the authenticated proxy URL once, then renders it as a normal
 * `<Image>` with the bearer/tenant headers RN's Image supports on its `source`. */
const AttachmentPhoto: React.FC<{ messageId: string; index: number }> = ({ messageId, index }) => {
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    getTelegramAttachmentDownloadInfo(messageId, index)
      .then((info) => { if (alive) setSrc({ uri: info.url, headers: info.headers }); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [messageId, index]);
  const { colors } = useTheme();
  if (failed) {
    return (
      <View style={[styles.photoFallback, { backgroundColor: colors.surfaceVariant }]}>
        <Ionicons name="image-outline" size={22} color={colors.textTertiary} />
      </View>
    );
  }
  if (!src) return <View style={[styles.photo, { backgroundColor: colors.surfaceVariant }]} />;
  return <Image source={src} style={styles.photo} resizeMode="cover" onError={() => setFailed(true)} />;
};

/** Non-image attachment (document/voice/video): downloads through the same proxy on tap, then
 * hands it to the OS share sheet — same download-then-share flow as the Telephony recording
 * screen, since Telegram's file bytes need the bot token attached server-side either way. */
const AttachmentFile: React.FC<{ messageId: string; index: number; attachment: TelegramAttachment; mine: boolean }> = ({ messageId, index, attachment, mine }) => {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const { url, headers } = await getTelegramAttachmentDownloadInfo(messageId, index);
      const ext = attachment.fileName?.split('.').pop() || (attachment.type === 'voice' ? 'ogg' : attachment.type === 'video' ? 'mp4' : 'bin');
      const dest = `${FileSystem.cacheDirectory}tg-${messageId}-${index}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(url, dest, { headers });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else showToast('Нет доступного приложения для этого файла', { variant: 'error' });
    } catch {
      showToast('Не удалось загрузить файл', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <TouchableOpacity style={styles.fileRow} onPress={open} disabled={busy} activeOpacity={0.7}>
      {busy ? <ActivityIndicator size="small" color={mine ? colors.onInk : colors.text} /> : <Ionicons name={ATTACHMENT_ICON[attachment.type] || 'document-outline'} size={18} color={mine ? colors.onInk : colors.text} />}
      <Text style={{ color: mine ? colors.onInk : colors.text, fontFamily: fonts.medium, fontSize: 13 }} numberOfLines={1}>
        {attachment.fileName || ATTACHMENT_LABEL[attachment.type] || 'Вложение'}
      </Text>
    </TouchableOpacity>
  );
};

export const DialogThreadScreen: React.FC<Props> = ({ route, navigation }) => {
  const { channel, id, name, extra } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<NormalizedMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      if (channel === 'chat') {
        const raw = await fetchChatMessages(id);
        setMessages(raw.map((m: ChatMessage) => ({ id: m.id, mine: m.sender !== 'visitor', text: m.text, createdAt: m.createdAt })));
      } else if (channel === 'telegram') {
        const raw = await fetchTelegramMessages(id);
        const sorted = [...raw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setMessages(sorted.map((m: TelegramMessage) => ({ id: m.id, mine: m.direction === 'outgoing', text: m.text || '', createdAt: m.date, attachments: m.attachments || undefined })));
        markTelegramContactRead(id).catch(() => {});
      } else if (channel === 'whatsapp') {
        const raw = await fetchWhatsappMessages(id);
        const sorted = [...raw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setMessages(sorted.map((m: WhatsappMessage) => ({ id: m.id, mine: m.direction === 'outgoing', text: m.text || '', createdAt: m.date })));
        markWhatsappContactRead(id).catch(() => {});
      } else {
        if (!extra?.accountId || !extra?.counterpartEmail) throw new Error('missing email routing');
        const { items } = await fetchEmailMessages({ accountId: extra.accountId, limit: 200 });
        const thread = items
          .filter((m) => m.from.toLowerCase() === extra.counterpartEmail!.toLowerCase() || m.to.some((t) => t.toLowerCase() === extra.counterpartEmail!.toLowerCase()))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setMessages(thread.map((m: EmailMessage) => ({
          id: m.id, mine: m.direction === 'outgoing',
          text: [m.subject, m.textBody?.trim() || (m.htmlBody ? htmlToPlainText(m.htmlBody) : '')].filter(Boolean).join('\n\n'),
          createdAt: m.date,
        })));
        thread.filter((m) => m.direction === 'incoming' && !m.isRead).forEach((m) => patchEmailMessage(m.id, { isRead: true }).catch(() => {}));
      }
    } catch {
      showToast('Не удалось загрузить переписку', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [channel, id]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      let sent: NormalizedMessage;
      if (channel === 'chat') {
        const msg = await sendChatMessage(id, trimmed);
        sent = { id: msg.id, mine: true, text: msg.text, createdAt: msg.createdAt };
      } else if (channel === 'telegram') {
        if (!extra?.botId || !extra?.telegramUserId) throw new Error('missing telegram routing');
        const msg = await sendTelegramMessage(extra.botId, extra.telegramUserId, trimmed);
        sent = { id: msg.id, mine: true, text: msg.text || trimmed, createdAt: msg.date };
      } else if (channel === 'whatsapp') {
        if (!extra?.connectionId) throw new Error('missing whatsapp connection');
        const msg = await sendWhatsappMessage(extra.connectionId, id, trimmed);
        sent = { id: msg.id, mine: true, text: msg.text || trimmed, createdAt: msg.date };
      } else {
        if (!extra?.accountId || !extra?.counterpartEmail) throw new Error('missing email routing');
        const msg = await sendNewEmail({ accountId: extra.accountId, to: [extra.counterpartEmail], textBody: trimmed });
        sent = { id: msg.id, mine: true, text: trimmed, createdAt: msg.date };
      }
      setMessages((prev) => [...prev, sent]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      // Surface the real backend reason (e.g. Telegram's own error text, a missing bot token) —
      // a generic "failed to send" swallows exactly the detail needed to tell a routing bug from
      // a real delivery failure.
      const reason = err?.response?.data?.message || (err?.message === 'missing telegram routing' ? 'Контакт не привязан к боту' : err?.message === 'missing whatsapp connection' ? 'Не выбрано подключение WhatsApp' : null);
      showToast(reason ? `Не удалось отправить: ${reason}` : 'Не удалось отправить сообщение', { variant: 'error' });
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
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.semibold }]} numberOfLines={1}>{name}</Text>
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
            renderItem={({ item }) => (
              <View style={[styles.msgWrap, item.mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                {item.attachments?.map((a: TelegramAttachment, i: number) => (
                  <GlassCard
                    key={i}
                    variant="flat"
                    style={[styles.bubble, a.type === 'photo' && styles.photoBubble, item.mine && { backgroundColor: colors.ink, borderColor: colors.ink }]}
                    contentStyle={a.type === 'photo' ? undefined : styles.bubbleContent}
                  >
                    {a.type === 'photo' ? <AttachmentPhoto messageId={item.id} index={i} /> : <AttachmentFile messageId={item.id} index={i} attachment={a} mine={item.mine} />}
                  </GlassCard>
                ))}
                {!!item.text && (
                  <GlassCard variant="flat" style={[styles.bubble, item.mine && { backgroundColor: colors.ink, borderColor: colors.ink }]} contentStyle={styles.bubbleContent}>
                    <Text style={{ color: item.mine ? colors.onInk : colors.text, fontFamily: fonts.regular, fontSize: 14 }}>{item.text}</Text>
                  </GlassCard>
                )}
                <Text style={[styles.msgTime, { color: colors.textTertiary }]}>{fmtTime(item.createdAt)}</Text>
              </View>
            )}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <GlassCard variant="g" style={styles.inputRow} contentStyle={[styles.inputRowContent, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Написать сообщение…"
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  backTxt: { fontSize: 16, flexShrink: 1 },
  msgWrap: { gap: 3 },
  bubble: { maxWidth: '82%', borderRadius: radius.xl },
  bubbleContent: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  photoBubble: { overflow: 'hidden', padding: 0 },
  photo: { width: 220, height: 220, borderRadius: radius.xl },
  photoFallback: { width: 220, height: 140, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10 },
  msgTime: { fontSize: 10 },
  inputRow: { borderRadius: 0 },
  inputRowContent: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  input: { flex: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, maxHeight: 120, minHeight: 40 },
  sendBtn: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
});
