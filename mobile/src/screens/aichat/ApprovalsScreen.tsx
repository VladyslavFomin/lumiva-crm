import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchAiAgents, fetchPendingAiActions, approveAiAction, executeAiAction, rejectAiAction, AiAgent, AiAgentAction } from '../../api/aiApprovals';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, EmptyState, Button, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

function relTime(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

export const ApprovalsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [actions, setActions] = useState<AiAgentAction[]>([]);
  const [agents, setAgents] = useState<Record<string, AiAgent>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [pending, agentList] = await Promise.all([fetchPendingAiActions(), fetchAiAgents()]);
      setActions(pending);
      setAgents(Object.fromEntries(agentList.map((a) => [a.id, a])));
    } catch {
      showToast('Не удалось загрузить согласования', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (a: AiAgentAction) => {
    setBusyId(a.id);
    try {
      await approveAiAction(a.id);
      await executeAiAction(a.id);
      setActions((prev) => prev.filter((x) => x.id !== a.id));
      showToast('Действие одобрено и выполнено', { variant: 'success' });
    } catch {
      showToast('Не удалось выполнить действие', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (a: AiAgentAction) => {
    setBusyId(a.id);
    try {
      await rejectAiAction(a.id);
      setActions((prev) => prev.filter((x) => x.id !== a.id));
      showToast('Действие отклонено', { variant: 'success' });
    } catch {
      showToast('Не удалось отклонить действие', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Согласования</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{actions.length}</Text> ждут решения
        </Text>
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : actions.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="Всё разобрано" subtitle="Нет действий ИИ-сотрудников, ожидающих согласования" />
      ) : (
        <Animated.FlatList
          data={actions}
          keyExtractor={(item: AiAgentAction) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: AiAgentAction }) => {
            const agent = agents[item.agentId];
            const busy = busyId === item.id;
            return (
              <GlassCard variant="flat" style={styles.card} contentStyle={styles.cardContent}>
                <View style={styles.cardTop}>
                  <AvatarInitials name={agent?.name || 'ИИ'} size={34} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.agentName, { color: colors.textSecondary }]} numberOfLines={1}>{agent?.name || 'ИИ-сотрудник'}</Text>
                    <Text style={[styles.actionTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                  </View>
                  <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(item.createdAt)}</Text>
                </View>
                {item.reason && <Text style={[styles.reason, { color: colors.textSecondary }]} numberOfLines={3}>{item.reason}</Text>}
                <View style={styles.actionsRow}>
                  <Button label="Отклонить" variant="secondary" size="sm" loading={busy} disabled={busy} onPress={() => handleReject(item)} style={{ flex: 1 }} />
                  <Button label="Одобрить" variant="primary" size="sm" loading={busy} disabled={busy} onPress={() => handleApprove(item)} style={{ flex: 1 }} />
                </View>
              </GlassCard>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: { padding: 2 },
  title: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 4 },
  card: { borderRadius: radius.xxl },
  cardContent: { padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  agentName: { fontSize: 11, fontFamily: fonts.medium },
  actionTitle: { fontSize: 14, fontFamily: fonts.semibold, marginTop: 2 },
  time: { fontSize: 10.5, flexShrink: 0 },
  reason: { fontSize: 12, fontFamily: fonts.regular, lineHeight: 17 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
});
