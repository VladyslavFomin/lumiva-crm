import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchSalesChannels, toggleSalesChannel, SalesChannel, SalesChannelType } from '../../api/salesChannels';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { Chips, StatGrid2, Pill } from '../../components/mg';
import { useCurrencyMode } from '../../context/CurrencyModeContext';

const TYPE_LABEL: Record<SalesChannelType, string> = { b2b: 'B2B', ota: 'OTA', direct: 'Напрямую', gds: 'GDS', other: 'Другое' };
const TYPE_ICON: Record<SalesChannelType, keyof typeof Ionicons.glyphMap> = {
  b2b: 'briefcase-outline', ota: 'globe-outline', direct: 'link-outline', gds: 'airplane-outline', other: 'ellipsis-horizontal-outline',
};

function relTime(dateStr: string | null) {
  if (!dateStr) return 'никогда';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

export const SalesChannelsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setChannels(await fetchSalesChannels());
    } catch {
      showToast('Не удалось загрузить каналы', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (c: SalesChannel) => {
    const next = !c.isEnabled;
    setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, isEnabled: next } : x)));
    try {
      await toggleSalesChannel(c.id, next);
    } catch {
      setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, isEnabled: !next } : x)));
      showToast('Не удалось изменить канал', { variant: 'error' });
    }
  };

  const typeCounts: Record<string, number> = {};
  channels.forEach((c) => (typeCounts[c.type] = (typeCounts[c.type] || 0) + 1));
  const visible = typeFilter === 'all' ? channels : channels.filter((c) => c.type === typeFilter);
  const totalAmount = channels.reduce((s, c) => s + toDisplay(c.totalSalesAmount, c.currency), 0);
  const totalCount = channels.reduce((s, c) => s + c.totalSalesCount, 0);
  const errorChannels = channels.filter((c) => c.lastSyncStatus === 'error');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Каналы продаж</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{channels.filter((c) => c.isEnabled).length}</Text> активных из {channels.length} · {totalCount} заказов
        </Text>
        {channels.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <Chips
              options={[
                { key: 'all', label: 'Все', count: channels.length },
                ...(Object.keys(TYPE_LABEL) as SalesChannelType[]).filter((t) => typeCounts[t]).map((t) => ({ key: t, label: TYPE_LABEL[t], count: typeCounts[t] })),
              ]}
              activeKey={typeFilter}
              onChange={setTypeFilter}
            />
          </View>
        )}
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : channels.length === 0 ? (
        <EmptyState icon="git-network-outline" title="Нет каналов" subtitle="Каналы продаж появляются при подключении интеграций или витрины" />
      ) : (
        <Animated.FlatList
          data={visible}
          keyExtractor={(item: SalesChannel) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.sm }}>
              <StatGrid2 items={[
                { label: 'Выручка каналов', value: fmt(totalAmount, undefined, { short: true }) },
                { label: 'Ошибок синхронизации', value: String(errorChannels.length) },
              ]} />
            </View>
          }
          renderItem={({ item }: { item: SalesChannel }) => (
            <GlassCard variant="flat" style={[styles.card, { opacity: item.isEnabled ? 1 : 0.6 }]} contentStyle={styles.cardContent}>
              <View style={[styles.ico, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name={TYPE_ICON[item.type]} size={16} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
                  {TYPE_LABEL[item.type]} · {item.totalSalesCount} продаж · {formatMoney(item.totalSalesAmount, item.currency)}
                </Text>
                {item.lastSyncStatus === 'error' ? (
                  <View style={{ marginTop: 3 }}><Pill label={item.lastError || 'ошибка синхронизации'} tone="neg" /></View>
                ) : (
                  <Text style={[styles.meta, { color: colors.textTertiary, marginTop: 1 }]} numberOfLines={1}>Синхр.: {relTime(item.lastSyncAt)}</Text>
                )}
              </View>
              <Switch value={item.isEnabled} onValueChange={() => toggle(item)} trackColor={{ false: colors.line2, true: colors.success }} thumbColor={colors.card} />
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
  ico: { width: 34, height: 34, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontFamily: fonts.semibold },
  meta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
});
