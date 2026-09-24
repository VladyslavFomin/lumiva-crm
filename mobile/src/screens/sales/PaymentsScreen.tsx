import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchPayments, fetchPaymentsAnalytics, Payment, PaymentStatus, PaymentsAnalytics } from '../../api/payments';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ToolbarButton, SkeletonList, EmptyState, AppBottomSheet, AppBottomSheetRef, Button, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const STATUS_TONE: Record<PaymentStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  pending: 'warn', paid: 'pos', failed: 'neg', cancelled: 'default',
};
const PROVIDER_LABEL: Record<string, string> = { iyzico: 'iyzico', paytr: 'PayTR', yookassa: 'ЮKassa' };
const STATUS_ORDER: PaymentStatus[] = ['pending', 'paid', 'failed', 'cancelled'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const PaymentsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const STATUS_LABEL: Record<PaymentStatus, string> = { pending: t('payments.status.pending'), paid: t('payments.status.paid'), failed: t('payments.status.failed'), cancelled: t('payments.status.cancelled') };
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const filterSheetRef = useRef<AppBottomSheetRef>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [analytics, setAnalytics] = useState<PaymentsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | null>(null);
  const [draftFilter, setDraftFilter] = useState<PaymentStatus | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [list, an] = await Promise.all([
        fetchPayments({ status: statusFilter || undefined }),
        fetchPaymentsAnalytics(30).catch(() => null),
      ]);
      setPayments(list.items);
      setTotal(list.total);
      setAnalytics(an);
    } catch {
      showToast(t('payments.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, t]);

  useEffect(() => { load(); }, [load]);

  const openFilterSheet = () => {
    setDraftFilter(statusFilter);
    filterSheetRef.current?.snapToIndex(0);
  };
  const applyFilter = () => {
    setStatusFilter(draftFilter);
    filterSheetRef.current?.close();
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
          <Text style={[styles.title, { color: colors.text }]}>{t('payments.title')}</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{total}</Text> {t('payments.subtitle')}
        </Text>
      </View>

      {analytics && (
        <GlassCard variant="g" style={styles.statsCard} contentStyle={styles.statsCardRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success, fontFamily: fonts.mono }]}>{analytics.paidCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('payments.stat.paid')}</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.error, fontFamily: fonts.mono }]}>{analytics.failedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('payments.stat.failed')}</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.separator }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: fonts.mono }]}>{Math.round(analytics.successRate)}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('payments.stat.success')}</Text>
          </View>
        </GlassCard>
      )}

      <View style={styles.toolbar}>
        <ToolbarButton icon="options-outline" label={t('payments.filters')} active={!!statusFilter} onPress={openFilterSheet} />
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : payments.length === 0 ? (
        <EmptyState icon="card-outline" title={t('payments.empty.title')} subtitle={statusFilter ? t('payments.empty.subtitleFiltered') : t('payments.empty.subtitleDefault')} />
      ) : (
        <GlassCard variant="g2" style={styles.listCard} contentStyle={{ flex: 1 }}>
          <Animated.FlatList
            data={payments}
            keyExtractor={(item: Payment) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: { item: Payment }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.line3 }]}
                disabled={!item.saleId}
                onPress={() => item.saleId && navigation.navigate('Sales', { screen: 'SaleDetail', params: { id: item.saleId } })}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.buyerName || item.saleOrderNo || `#${item.id.slice(0, 8)}`}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                    {PROVIDER_LABEL[item.provider] || item.provider} · {fmtDate(item.paidAt || item.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.amount, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{formatMoney(item.amount, item.currency)}</Text>
                  <Pill label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
                </View>
              </TouchableOpacity>
            )}
          />
        </GlassCard>
      )}

      <AppBottomSheet ref={filterSheetRef} snapPoints={['45%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('payments.sheetTitle')}</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <TouchableOpacity style={[styles.filterRow, { borderColor: draftFilter === null ? colors.ink : colors.line2 }]} onPress={() => setDraftFilter(null)}>
            <Text style={[styles.filterAllTxt, { color: colors.text }]}>{t('payments.allStatuses')}</Text>
          </TouchableOpacity>
          {STATUS_ORDER.map((s) => (
            <TouchableOpacity key={s} style={[styles.filterRow, { borderColor: draftFilter === s ? colors.ink : colors.line2 }]} onPress={() => setDraftFilter(s)}>
              <Pill label={STATUS_LABEL[s]} tone={STATUS_TONE[s]} />
            </TouchableOpacity>
          ))}
        </View>
        <Button label={t('payments.apply')} variant="primary" fullWidth onPress={applyFilter} style={{ marginTop: spacing.xl }} />
      </AppBottomSheet>
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
  statsCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.xxl, padding: 14 },
  statsCardRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontFamily: fonts.semibold },
  statLabel: { fontSize: 10, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 },
  statDiv: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm, paddingBottom: spacing.sm },
  listCard: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  amount: { fontSize: 13 },
  sheetTitle: { fontSize: 16, fontFamily: fonts.semibold },
  filterRow: { paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  filterAllTxt: { fontSize: 13, fontFamily: fonts.medium },
});
