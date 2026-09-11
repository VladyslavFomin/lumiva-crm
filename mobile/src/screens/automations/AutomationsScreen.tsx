import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Switch, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { fetchAutomations, setAutomationActive, Automation } from '../../api/automations';
import { triggerLabel } from './triggerLabels';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

function relTime(dateStr: string | null) {
  if (!dateStr) return 'ещё не запускалась';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

export const AutomationsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setAutomations(await fetchAutomations());
    } catch {
      showToast('Не удалось загрузить автоматизации', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (a: Automation) => {
    const next = !a.isActive;
    setAutomations((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: next } : x)));
    try {
      await setAutomationActive(a.id, next);
    } catch {
      setAutomations((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: !next } : x)));
      showToast('Не удалось изменить статус', { variant: 'error' });
    }
  };

  const activeCount = automations.filter((a) => a.isActive).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Автоматизации</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{activeCount}</Text> активных из{' '}
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{automations.length}</Text>
        </Text>
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : automations.length === 0 ? (
        <EmptyState icon="flash-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title="Нет автоматизаций" subtitle="Создайте правила на сайте — здесь можно смотреть и включать/выключать" />
      ) : (
        <Animated.FlatList
          data={automations}
          keyExtractor={(item: Automation) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: Automation }) => (
            <GlassCard variant="flat" style={[styles.card, { opacity: item.isActive ? 1 : 0.6 }]} contentStyle={styles.cardContent}>
            <TouchableOpacity
              style={styles.cardTouchable}
              onPress={() => navigation.navigate('AutomationDetail', { id: item.id })}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.trigger, { color: colors.textSecondary }]} numberOfLines={1}>{triggerLabel(item.triggerEvent)}</Text>
                <Text style={[styles.stats, { color: colors.textTertiary, fontFamily: fonts.mono }]}>
                  {item.executionCount} выполнений{item.errorCount > 0 ? ` · ${item.errorCount} ошибок` : ''} · {relTime(item.lastExecutedAt)}
                </Text>
              </View>
              <Switch
                value={item.isActive}
                onValueChange={() => toggle(item)}
                trackColor={{ false: colors.line2, true: colors.success }}
                thumbColor={colors.card}
              />
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
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  card: { borderRadius: radius.xxl },
  cardContent: { flex: 1 },
  cardTouchable: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  name: { fontSize: 14.5, fontFamily: fonts.semibold },
  trigger: { fontSize: 12, fontFamily: fonts.medium, marginTop: 2 },
  stats: { fontSize: 10.5, marginTop: 4 },
});
