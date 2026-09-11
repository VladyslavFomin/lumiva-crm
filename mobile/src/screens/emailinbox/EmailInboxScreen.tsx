import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EmailInboxStackParamList } from './EmailInboxStack';
import { fetchEmailAccounts, EmailAccount } from '../../api/email';
import { fetchEmailFolders, fetchEmailMessages, patchEmailMessage, deleteEmailMessage, EmailFolder, EmailMessage } from '../../api/emailInbox';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SwipeableRow, SkeletonList, EmptyState, Fab, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Pill, Chips } from '../../components/mg';

type Props = NativeStackScreenProps<EmailInboxStackParamList, 'EmailInbox'>;

type FolderFilter = { key: string; label: string; folderId?: string; starred?: boolean };

function relTime(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'сейчас';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

export const EmailInboxScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [filterKey, setFilterKey] = useState('inbox');
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchEmailAccounts();
        setAccounts(list);
        if (list.length > 0) setAccountId(list[0].id);
      } catch {
        showToast('Не удалось загрузить почтовые аккаунты', { variant: 'error' });
      } finally {
        setLoadingAccounts(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!accountId) return;
    fetchEmailFolders(accountId).then(setFolders).catch(() => setFolders([]));
  }, [accountId]);

  const filters: FolderFilter[] = useMemo(() => {
    const inbox = folders.find((f) => f.systemKey === 'inbox');
    const sent = folders.find((f) => f.systemKey === 'sent');
    const custom = folders.filter((f) => !f.systemKey);
    const list: FolderFilter[] = [];
    if (inbox) list.push({ key: 'inbox', label: 'Входящие', folderId: inbox.id });
    if (sent) list.push({ key: 'sent', label: 'Отправленные', folderId: sent.id });
    list.push({ key: 'starred', label: 'Избранные', starred: true });
    custom.forEach((f) => list.push({ key: f.id, label: f.name, folderId: f.id }));
    return list;
  }, [folders]);

  const load = useCallback(async (isRefresh = false) => {
    if (!accountId) return;
    const active = filters.find((f) => f.key === filterKey) ?? filters[0];
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await fetchEmailMessages({
        accountId,
        folderId: active?.folderId,
        starred: active?.starred,
        search: search.trim() || undefined,
        limit: 50,
      });
      setMessages(res.items);
    } catch {
      showToast('Не удалось загрузить письма', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountId, filterKey, filters, search]);

  useEffect(() => { load(); }, [accountId, filterKey]);

  const toggleStar = useCallback(async (m: EmailMessage) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isStarred: !x.isStarred } : x)));
    try {
      await patchEmailMessage(m.id, { isStarred: !m.isStarred });
    } catch {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isStarred: m.isStarred } : x)));
      showToast('Не удалось изменить статус', { variant: 'error' });
    }
  }, []);

  const removeMessage = useCallback(async (m: EmailMessage) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await deleteEmailMessage(m.id);
    } catch {
      setMessages((prev) => [m, ...prev]);
      showToast('Не удалось удалить письмо', { variant: 'error' });
    }
  }, []);

  const openMessage = useCallback((m: EmailMessage) => {
    if (!m.isRead) {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)));
      patchEmailMessage(m.id, { isRead: true }).catch(() => {});
    }
    navigation.navigate('EmailMessageDetail', { id: m.id });
  }, [navigation]);

  if (loadingAccounts) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <Text style={[styles.title, { color: colors.text, paddingTop: insets.top + 8 }]}>Почта</Text>
        <SkeletonList count={7} />
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <Text style={[styles.title, { color: colors.text, paddingTop: insets.top + 8 }]}>Почта</Text>
        <EmptyState icon="mail-outline" title="Нет почтовых аккаунтов" subtitle="Подключите почтовый ящик в настройках на сайте" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <Text style={[styles.title, { color: colors.text, paddingTop: insets.top + 8 }]}>Почта</Text>

      {accounts.length > 1 && (
        <View style={styles.accountRow}>
          <Chips options={accounts.map((a) => ({ key: a.id, label: a.name || a.email }))} activeKey={accountId || ''} onChange={setAccountId} />
        </View>
      )}

      <View style={styles.searchWrap}>
        <GlassCard variant="flat" style={styles.searchCard} contentStyle={styles.searchCardContent}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder="Поиск по письмам…"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load()}
            returnKeyType="search"
          />
        </GlassCard>
      </View>

      <View style={styles.folderRow}>
        <Chips options={filters.map((f) => ({ key: f.key, label: f.label }))} activeKey={filterKey} onChange={setFilterKey} />
      </View>

      {loading ? (
        <SkeletonList count={7} />
      ) : messages.length === 0 ? (
        <EmptyState icon="mail-open-outline" title="Нет писем" subtitle="Здесь появятся письма этой папки" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={messages}
            keyExtractor={(item: EmailMessage) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 90 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: EmailMessage }) => (
              <SwipeableRow
                leftAction={{ icon: item.isStarred ? 'star' : 'star-outline', label: item.isStarred ? 'Снять' : 'Избранное', color: colors.warning, onPress: () => toggleStar(item) }}
                rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => removeMessage(item) }}
              >
                <TouchableOpacity style={[styles.row, { borderBottomColor: colors.line3 }]} onPress={() => openMessage(item)} activeOpacity={0.7}>
                  <AvatarInitials name={item.fromName || item.from} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.name, { color: colors.text, fontFamily: item.isRead ? fonts.regular : fonts.semibold }]} numberOfLines={1}>
                        {item.fromName || item.from}
                      </Text>
                      {item.isStarred && <Ionicons name="star" size={12} color={colors.warning} />}
                      {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.error }]} />}
                    </View>
                    <Text style={[styles.subject, { color: colors.text, fontFamily: item.isRead ? fonts.regular : fonts.semibold }]} numberOfLines={1}>
                      {item.subject || '(без темы)'}
                    </Text>
                    <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
                      {(item.textBody || '').replace(/\s+/g, ' ').trim() || '—'}
                    </Text>
                    {(!!item.attachments?.length || !!item.leadId) && (
                      <View style={styles.metaRow}>
                        {!!item.attachments?.length && <Pill label="вложение" />}
                        {!!item.leadId && <Pill label="связан с лидом" tone="acc" />}
                      </View>
                    )}
                  </View>
                  <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(item.date)}</Text>
                </TouchableOpacity>
              </SwipeableRow>
            )}
          />
        </GlassCard>
      )}

      {accountId && <Fab icon="create-outline" onPress={() => navigation.navigate('EmailCompose', { accountId })} />}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 4 },
  accountRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  searchWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  searchCard: { borderRadius: radius.xl },
  searchCardContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  folderRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 13, flexShrink: 1 },
  subject: { fontSize: 14, marginTop: 1 },
  preview: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2, lineHeight: 16 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  time: { fontSize: 11 },
});
