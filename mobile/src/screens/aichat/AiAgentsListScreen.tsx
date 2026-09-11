import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchAiAgents, AiAgent } from '../../api/aiApprovals';
import { agentStatusLabel } from './aiEmployeeLabels';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

function statusTone(status?: string): 'pos' | 'warn' | 'default' {
  if (status === 'active') return 'pos';
  if (status === 'paused' || status === 'setup_required') return 'warn';
  return 'default';
}

export const AiAgentsListScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setAgents(await fetchAiAgents());
    } catch {
      showToast('Не удалось загрузить ИИ-сотрудников', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = agents.filter((a) => a.status === 'active').length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>ИИ-сотрудники</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{activeCount}</Text> активных из{' '}
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{agents.length}</Text>
        </Text>
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : agents.length === 0 ? (
        <EmptyState icon="people-outline" title="Нет ИИ-сотрудников" subtitle="Добавьте ИИ-сотрудника на сайте, чтобы управлять им отсюда" />
      ) : (
        <Animated.FlatList
          data={agents}
          keyExtractor={(item: AiAgent) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: AiAgent }) => (
            <GlassCard variant="flat" style={styles.card}>
              <TouchableOpacity
                style={styles.cardContent}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AiAgentDetail', { id: item.id })}
              >
                <AvatarInitials name={item.name} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.role, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.roleTitle || item.jobTitle || item.role}
                  </Text>
                  {item.department ? (
                    <Text style={[styles.department, { color: colors.textTertiary }]} numberOfLines={1}>{item.department}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Pill label={agentStatusLabel(item.status || '')} tone={statusTone(item.status)} />
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            </GlassCard>
          )}
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
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { fontSize: 14.5, fontFamily: fonts.semibold },
  role: { fontSize: 12.5, fontFamily: fonts.medium, marginTop: 2 },
  department: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
});
