import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchHelpdeskTickets, HelpdeskTicketListItem, HelpdeskTicketStatus, HelpdeskChannel } from '../../api/helpdesk';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Chips, Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const STATUS_LABEL: Record<HelpdeskTicketStatus, string> = { open: 'Открыт', pending: 'Ожидает', resolved: 'Решён', closed: 'Закрыт' };
const STATUS_TONE: Record<HelpdeskTicketStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  open: 'acc', pending: 'warn', resolved: 'pos', closed: 'default',
};
const CHANNEL_ICON: Record<HelpdeskChannel, keyof typeof Ionicons.glyphMap> = {
  portal: 'globe-outline', email: 'mail-outline', telegram: 'paper-plane-outline', whatsapp: 'logo-whatsapp', sms: 'chatbox-outline', internal: 'person-outline',
};

function relTime(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

export const HelpdeskTicketsListScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [tickets, setTickets] = useState<HelpdeskTicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | HelpdeskTicketStatus>('open');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setTickets(await fetchHelpdeskTickets());
    } catch {
      showToast('Не удалось загрузить тикеты', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter), [tickets, statusFilter]);
  const totalUnread = useMemo(() => visible.reduce((s, t) => s + t.unreadCount, 0), [visible]);
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach((t) => (m[t.status] = (m[t.status] || 0) + 1));
    return m;
  }, [tickets]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Хелпдеск</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{visible.length}</Text> тикетов
          {totalUnread > 0 && <Text style={{ color: colors.error, fontFamily: fonts.monoSemibold }}> · {totalUnread} новых</Text>}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <Chips
            options={[
              { key: 'all', label: 'Все', count: tickets.length },
              { key: 'open', label: 'Открытые', count: statusCounts.open || 0, dotColor: colors.info },
              { key: 'pending', label: 'Ожидают', count: statusCounts.pending || 0, dotColor: colors.warning },
              { key: 'resolved', label: 'Решены', count: statusCounts.resolved || 0, dotColor: colors.success },
              { key: 'closed', label: 'Закрыты', count: statusCounts.closed || 0, dotColor: colors.fg3 },
            ]}
            activeKey={statusFilter}
            onChange={(key) => setStatusFilter(key as typeof statusFilter)}
          />
        </View>
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : visible.length === 0 ? (
        <EmptyState icon="help-buoy-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title="Нет тикетов" subtitle="Здесь появятся обращения клиентов и сотрудников" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
        <Animated.FlatList
          data={visible}
          keyExtractor={(item: HelpdeskTicketListItem) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: t }: { item: HelpdeskTicketListItem }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.line3 }]}
              onPress={() => navigation.navigate('HelpdeskTicketDetail', { id: t.id })}
              activeOpacity={0.7}
            >
              <View style={[styles.channelIco, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={CHANNEL_ICON[t.channel]} size={16} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.subject, { color: colors.text }]} numberOfLines={1}>{t.subject}</Text>
                  {t.overdue && <Ionicons name="alert-circle" size={14} color={colors.error} />}
                </View>
                <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t.contactName || t.requesterName || 'Без имени'}{t.lastMessagePreview ? ` · ${t.lastMessagePreview}` : ''}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(t.lastMessageAt)}</Text>
                {t.unreadCount > 0 ? (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.unreadTxt}>{t.unreadCount}</Text>
                  </View>
                ) : (
                  <Pill label={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
                )}
              </View>
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
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  channelIco: { width: 36, height: 36, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subject: { fontSize: 14, fontFamily: fonts.semibold, flexShrink: 1 },
  preview: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  rowEnd: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 10.5 },
  unreadBadge: { minWidth: 18, height: 18, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadTxt: { color: '#fff', fontSize: 10, fontFamily: fonts.bold },
});
