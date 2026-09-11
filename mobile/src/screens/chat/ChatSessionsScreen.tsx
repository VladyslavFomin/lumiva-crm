import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchChatSessions, deleteChatSession, ChatSession } from '../../api/chat';
import type { ChatStackParamList } from './ChatStack';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SwipeableRow, AvatarInitials, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatSessions'>;

function relTime(dateStr: string | null) {
  if (!dateStr) return '';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

export const ChatSessionsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const deleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<'open' | 'closed'>('open');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setSessions(await fetchChatSessions({ status }));
    } catch {
      showToast('Не удалось загрузить чаты', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const removeSession = useCallback((s: ChatSession) => {
    setSessions((prev) => prev.filter((x) => x.id !== s.id));
    const timer = setTimeout(() => {
      deleteChatSession(s.id).catch(() => {
        setSessions((prev) => [s, ...prev]);
        showToast('Не удалось удалить чат', { variant: 'error' });
      });
      delete deleteTimers.current[s.id];
    }, 3200);
    deleteTimers.current[s.id] = timer;
    showToast('Чат удалён', {
      actionLabel: 'Отменить',
      onAction: () => {
        clearTimeout(deleteTimers.current[s.id]);
        delete deleteTimers.current[s.id];
        setSessions((prev) => [s, ...prev]);
      },
    });
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <Text style={[styles.title, { color: colors.text, paddingTop: insets.top + 8 }]}>Чаты</Text>

      <Segmented
        options={[
          { key: 'open', label: 'Активные' },
          { key: 'closed', label: 'Закрытые' },
        ]}
        activeKey={status}
        onChange={(key) => setStatus(key as 'open' | 'closed')}
      />

      {loading ? (
        <SkeletonList count={6} />
      ) : sessions.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title="Нет чатов" subtitle="Здесь появятся обращения из виджета на сайте" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
        <Animated.FlatList
          data={sessions}
          keyExtractor={(item: ChatSession) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: s }: { item: ChatSession }) => {
            const name = s.visitorName || s.visitorEmail || 'Гость';
            return (
              <SwipeableRow rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => removeSession(s) }}>
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.line3 }]}
                  onPress={() => navigation.navigate('ChatMessages', { id: s.id })}
                  activeOpacity={0.7}
                >
                  <AvatarInitials name={name} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                      {s.unread && <View style={[styles.unreadDot, { backgroundColor: colors.error }]} />}
                    </View>
                    <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{s.siteHost}</Text>
                  </View>
                  <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(s.lastMessageAt)}</Text>
                </TouchableOpacity>
              </SwipeableRow>
            );
          }}
        />
        </GlassCard>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 4 },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: 'transparent' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14.5, fontFamily: fonts.semibold },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  meta: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  time: { fontSize: 11 },
});
