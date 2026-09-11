import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchSales, Sale } from '../../api/sales';
import type { SalesStackParamList } from './SalesStack';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { CurrencyChip, StatGrid2 } from '../../components/mg';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, ToolbarButton, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<SalesStackParamList, 'SalesList'>;

const STATUS_ORDER = ['new', 'pending', 'confirmed', 'cancelled', 'refunded'] as const;
const STATUS_LABEL: Record<string, string> = {
  new: 'Новая', pending: 'Ожидает', confirmed: 'Подтверждена', cancelled: 'Отменена', refunded: 'Возврат', other: 'Другое',
};
const STATUS_TONE: Record<string, 'info' | 'neutral' | 'warning' | 'success' | 'error'> = {
  new: 'info', pending: 'warning', confirmed: 'success', cancelled: 'error', refunded: 'error', other: 'neutral',
};

function toneColor(colors: ReturnType<typeof useTheme>['colors'], tone: 'info' | 'neutral' | 'warning' | 'success' | 'error'): string {
  const map = { info: colors.info, neutral: colors.fg3, warning: colors.warning, success: colors.success, error: colors.error };
  return map[tone];
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export const SalesListScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fmt, toDisplay } = useCurrencyMode();
  const [items, setItems] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setItems(await fetchSales());
    } catch {
      showToast('Не удалось загрузить продажи', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => statusFilter === 'all' ? items : items.filter((s) => s.status === statusFilter), [items, statusFilter]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((s) => (m[s.status] = (m[s.status] || 0) + 1));
    return m;
  }, [items]);

  const turnover = useMemo(
    () => visible.filter((s) => s.status !== 'cancelled' && s.status !== 'refunded').reduce((sum, s) => sum + toDisplay(s.amount, s.currency), 0),
    [visible, toDisplay],
  );
  const confirmedCount = visible.filter((s) => s.status !== 'cancelled' && s.status !== 'refunded').length;
  const avgCheck = confirmedCount > 0 ? turnover / confirmedCount : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Продажи</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{visible.length} заказов · {fmt(turnover, undefined, { short: true })}</Text>
          </View>
          <CurrencyChip />
          <ToolbarButton icon="card-outline" onPress={() => navigation.navigate('Payments')} />
          <ToolbarButton icon="git-network-outline" onPress={() => navigation.navigate('SalesChannels')} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <TouchableOpacity style={[styles.chip, { backgroundColor: statusFilter === 'all' ? colors.ink : colors.surfaceVariant }]} onPress={() => setStatusFilter('all')}>
            <Text style={[styles.chipTxt, { color: statusFilter === 'all' ? colors.onInk : colors.text }]}>Все</Text>
            <Text style={[styles.chipCount, { color: statusFilter === 'all' ? colors.onInk : colors.textTertiary }]}>{items.length}</Text>
          </TouchableOpacity>
          {STATUS_ORDER.map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: statusFilter === s ? colors.ink : colors.surfaceVariant }]} onPress={() => setStatusFilter(s)}>
              <View style={[styles.chipDot, { backgroundColor: statusFilter === s ? colors.onInk : toneColor(colors, STATUS_TONE[s]) }]} />
              <Text style={[styles.chipTxt, { color: statusFilter === s ? colors.onInk : colors.text }]}>{STATUS_LABEL[s]}</Text>
              <Text style={[styles.chipCount, { color: statusFilter === s ? colors.onInk : colors.textTertiary }]}>{statusCounts[s] || 0}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : visible.length === 0 ? (
        <EmptyState icon="cash-outline" lottieSource={require('../../../assets/lottie/empty-pulse.json')} title="Нет продаж" subtitle="Здесь появятся закрытые сделки" />
      ) : (
        <Animated.FlatList
          data={visible}
          keyExtractor={(item: Sale) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <StatGrid2 items={[
              { label: 'Оборот', value: fmt(turnover, undefined, { short: true }) },
              { label: 'Средний чек', value: fmt(avgCheck, undefined, { short: true }) },
            ]} />
          }
          renderItem={({ item }: { item: Sale }) => {
            const tone = STATUS_TONE[item.status] || 'neutral';
            return (
            <GlassCard variant="flat" style={styles.card} contentStyle={styles.cardContent}>
            <TouchableOpacity
              onPress={() => navigation.navigate('SaleDetail', { id: item.id })}
              activeOpacity={0.7}
              style={styles.cardRow}
            >
              <View style={[styles.avatarWrap, { borderColor: toneColor(colors, tone) }]}>
                <Text style={[styles.avatarTxt, { color: colors.text, fontFamily: fonts.mono }]} numberOfLines={1}>№{item.externalOrderNo || item.id.slice(0, 4)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.guestName || item.hotel || item.market || 'Без имени'}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.chipDot, { backgroundColor: toneColor(colors, tone) }]} />
                  <Text style={[styles.metaTxt, { color: colors.textSecondary }]} numberOfLines={1}>{STATUS_LABEL[item.status] || item.status}{item.hotel ? ` · ${item.hotel}` : ''}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.amount, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmt(item.amount, item.currency, { short: true })}</Text>
                <Text style={[styles.date, { color: colors.textTertiary }]}>{fmtDate(item.saleDate || item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
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
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipTxt: { fontSize: 12.5, fontFamily: fonts.medium },
  chipCount: { fontSize: 10.5, fontFamily: fonts.mono },
  card: { borderRadius: radius.xl },
  cardContent: { padding: spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarWrap: { paddingHorizontal: 8, height: 30, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 10 },
  cardName: { fontSize: 14, fontFamily: fonts.semibold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaTxt: { fontSize: 11.5, flexShrink: 1 },
  amount: { fontSize: 14 },
  date: { fontSize: 11, marginTop: 2 },
});
