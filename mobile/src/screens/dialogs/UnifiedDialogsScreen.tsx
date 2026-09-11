import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DialogsStackParamList } from './DialogsStack';
import { fetchChatSessions, ChatSession } from '../../api/chat';
import { fetchTelegramContacts, telegramContactName, TelegramContact } from '../../api/telegramCrm';
import { fetchWhatsappContacts, whatsappContactName, WhatsappContact } from '../../api/whatsappCrm';
import { fetchEmailDialogs, EmailDialogItem } from '../../api/emailInbox';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Channel = 'chat' | 'telegram' | 'whatsapp' | 'email';
type ChannelFilter = 'all' | Channel;

interface DialogItem {
  channel: Channel;
  id: string;
  name: string;
  preview: string;
  timestamp: string | null;
  unreadCount: number;
  extra?: { botId?: string | null; telegramUserId?: string; connectionId?: string | null; accountId?: string; counterpartEmail?: string };
}

const CHANNEL_ICON: Record<Channel, keyof typeof Ionicons.glyphMap> = {
  chat: 'chatbubbles-outline', telegram: 'paper-plane-outline', whatsapp: 'logo-whatsapp', email: 'mail-outline',
};
const CHANNEL_COLOR: Record<Channel, string> = { chat: '#0284c7', telegram: '#229ED9', whatsapp: '#25D366', email: '#f59e0b' };

const ATTACHMENT_PREVIEW: Record<string, string> = { photo: '📷 Фото', document: '📎 Файл', voice: '🎤 Голосовое', video: '🎥 Видео' };
function attachmentPreview(attachments?: { type: string }[] | null): string {
  const first = attachments?.[0];
  return first ? ATTACHMENT_PREVIEW[first.type] || '📎 Вложение' : '';
}

function relTime(dateStr: string | null) {
  if (!dateStr) return '';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'сейчас';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

export const UnifiedDialogsScreen: React.FC<NativeStackScreenProps<DialogsStackParamList, 'Dialogs'>> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<DialogItem[]>([]);
  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [chats, tgContacts, waContacts, emailDialogs] = await Promise.all([
        fetchChatSessions({ status: 'open' }).catch(() => [] as ChatSession[]),
        fetchTelegramContacts().catch(() => [] as TelegramContact[]),
        fetchWhatsappContacts().catch(() => [] as WhatsappContact[]),
        fetchEmailDialogs().catch(() => [] as EmailDialogItem[]),
      ]);

      const chatItems: DialogItem[] = chats.map((s) => ({
        channel: 'chat', id: s.id, name: s.visitorName || s.visitorEmail || 'Гость',
        preview: s.siteHost, timestamp: s.lastMessageAt, unreadCount: s.unread ? 1 : 0,
      }));
      const tgItems: DialogItem[] = tgContacts.map((c) => ({
        channel: 'telegram', id: c.id, name: telegramContactName(c),
        preview: c.lastMessage?.text || attachmentPreview(c.lastMessage?.attachments), timestamp: c.lastMessage?.date || null, unreadCount: c.unreadCount,
        extra: { botId: c.botId, telegramUserId: c.telegramUserId },
      }));
      const waItems: DialogItem[] = waContacts.map((c) => ({
        channel: 'whatsapp', id: c.id, name: whatsappContactName(c),
        preview: c.lastMessage?.text || '', timestamp: c.lastMessage?.date || null, unreadCount: c.unreadCount,
        extra: { connectionId: c.connectionId },
      }));

      const emailItems: DialogItem[] = emailDialogs.map((d) => ({
        channel: 'email', id: d.counterpartEmail, name: d.counterpartName || d.counterpartEmail,
        preview: d.lastMessage, timestamp: d.lastDate, unreadCount: d.unreadCount,
        extra: { accountId: d.accountId, counterpartEmail: d.counterpartEmail },
      }));

      const all = [...chatItems, ...tgItems, ...waItems, ...emailItems].sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });
      setItems(all);
    } catch {
      showToast('Не удалось загрузить диалоги', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.channel === filter);
  const unreadTotal = items.reduce((a, i) => a + i.unreadCount, 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <Text style={[styles.title, { color: colors.text, paddingTop: insets.top + 8 }]}>Диалоги</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{unreadTotal} непрочитанных</Text>

      <Segmented
        options={[
          { key: 'all', label: 'Все' },
          { key: 'chat', label: 'Чат сайта' },
          { key: 'telegram', label: 'Telegram' },
          { key: 'whatsapp', label: 'WhatsApp' },
          { key: 'email', label: 'Почта' },
        ]}
        activeKey={filter}
        onChange={(key) => setFilter(key as ChannelFilter)}
      />

      {loading ? (
        <SkeletonList count={7} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="Нет диалогов" subtitle="Здесь появятся переписки из чата сайта, Telegram, WhatsApp и почты" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={filtered}
            keyExtractor={(item: DialogItem) => `${item.channel}-${item.id}`}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: DialogItem }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.line3 }]}
                onPress={() => navigation.navigate('DialogThread', { channel: item.channel, id: item.id, name: item.name, extra: item.extra })}
                activeOpacity={0.7}
              >
                <View>
                  <AvatarInitials name={item.name} size={40} />
                  <View style={[styles.channelBadge, { backgroundColor: CHANNEL_COLOR[item.channel] }]}>
                    <Ionicons name={CHANNEL_ICON[item.channel]} size={9} color="#fff" />
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    {item.unreadCount > 0 && <View style={[styles.unreadDot, { backgroundColor: colors.error }]} />}
                  </View>
                  <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>{item.preview || '—'}</Text>
                </View>
                <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(item.timestamp)}</Text>
              </TouchableOpacity>
            )}
          />
        </GlassCard>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg },
  sub: { fontSize: 12.5, fontFamily: fonts.regular, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: 4 },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  channelBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14.5, fontFamily: fonts.semibold, flexShrink: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  preview: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  time: { fontSize: 11 },
});
