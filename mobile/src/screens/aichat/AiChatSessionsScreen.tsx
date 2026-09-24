import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AiChatStackParamList } from './AiChatStack';
import { fetchAiSessions, fetchAiStatus, deleteAiSession, AiChatSession, AiStatus } from '../../api/aiChat';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { SwipeableRow, SkeletonList, EmptyState, ToolbarButton, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { formatMoney } from '../../utils/money';

type Props = NativeStackScreenProps<AiChatStackParamList, 'AiChatSessions'>;

function relTime(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

export const AiChatSessionsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [s, st] = await Promise.all([fetchAiSessions(), fetchAiStatus().catch(() => null)]);
      setSessions(s);
      setStatus(st);
    } catch {
      showToast('Не удалось загрузить историю чата', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeSession = useCallback(async (s: AiChatSession) => {
    setSessions((prev) => prev.filter((x) => x.id !== s.id));
    try {
      await deleteAiSession(s.id);
    } catch {
      setSessions((prev) => [s, ...prev]);
      showToast('Не удалось удалить чат', { variant: 'error' });
    }
  }, []);

  if (status && !status.configured) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <Text style={[styles.title, { color: colors.text, paddingTop: insets.top + 8 }]}>ИИ-ассистент</Text>
        <EmptyState icon="sparkles-outline" title="ИИ-ассистент не настроен" subtitle="Добавьте ключ OpenAI (свой или через тариф) в настройках на сайте" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>ИИ-ассистент</Text>
        {status && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Доступно: <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{formatMoney(status.quota.totalAvailableCents / 100, 'EUR')}</Text>
          </Text>
        )}
        <View style={styles.toolbar}>
          <ToolbarButton icon="add" label="Новый чат" active onPress={() => navigation.navigate('AiChatThread', { sessionId: null })} />
          <ToolbarButton icon="sparkles-outline" label="Память" onPress={() => navigation.navigate('AiMemory')} />
          <ToolbarButton icon="mail-outline" label="Письмо" onPress={() => navigation.navigate('AiLetter')} />
          <ToolbarButton icon="checkmark-done-outline" label="Согласования" onPress={() => navigation.navigate('Approvals')} />
          <ToolbarButton icon="people-outline" label="ИИ-сотрудники" onPress={() => navigation.navigate('AiAgentsList')} />
        </View>
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : sessions.length === 0 ? (
        <EmptyState icon="sparkles-outline" title="Пока нет диалогов" subtitle="Начните новый чат с ИИ-ассистентом" />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={sessions}
            keyExtractor={(item: AiChatSession) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: s }: { item: AiChatSession }) => (
              <SwipeableRow rightAction={{ icon: 'trash-outline', label: 'Удалить', color: colors.error, onPress: () => removeSession(s) }}>
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.line3 }]}
                  onPress={() => navigation.navigate('AiChatThread', { sessionId: s.id })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.ico, { backgroundColor: colors.ink }]}>
                    <Ionicons name="sparkles" size={16} color={colors.onInk} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{s.title || 'Новый диалог'}</Text>
                  </View>
                  <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(s.updatedAt)}</Text>
                </TouchableOpacity>
              </SwipeableRow>
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
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingBottom: spacing.sm },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  ico: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  time: { fontSize: 11 },
});
