import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchBiDashboardSummary, BiDashboardSummary, CurrencyAmount, Trend } from '../../api/biDashboard';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonCard, showToast } from '../../components/ui';
import { Segmented } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

const PERIODS = [
  { key: '7', label: '7 дней' },
  { key: '30', label: '30 дней' },
  { key: '90', label: '90 дней' },
];

function formatAmounts(amounts: CurrencyAmount[]): string {
  if (!amounts.length) return '—';
  return amounts.map((a) => formatMoney(a.amount, a.currency)).join(' · ');
}

const TrendBadge: React.FC<{ trend?: Trend | null }> = ({ trend }) => {
  const { colors } = useTheme();
  if (!trend || trend.pct === 0) return null;
  const color = trend.direction === 'up' ? colors.success : trend.direction === 'down' ? colors.error : colors.textTertiary;
  const icon = trend.direction === 'up' ? 'arrow-up' : trend.direction === 'down' ? 'arrow-down' : 'remove';
  return (
    <View style={styles.trendRow}>
      <Ionicons name={icon as any} size={10} color={color} />
      <Text style={[styles.trendTxt, { color, fontFamily: fonts.mono }]}>{trend.pct}%</Text>
    </View>
  );
};

export const BiDashboardScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [days, setDays] = useState('30');
  const [data, setData] = useState<BiDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((d: string) => {
    setLoading(true);
    fetchBiDashboardSummary(Number(d))
      .then(setData)
      .catch(() => showToast('Не удалось загрузить BI-дашборд', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const hasHotels = !!data?.hotels && (data.hotels.total > 0 || data.hotels.cancelled > 0 || data.hotels.revenue.length > 0);
  const telephonyEnabled = !!data?.telephony?.enabled;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Назад</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.largeTitle, { color: colors.text }]}>BI-дашборд</Text>
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          {data ? `за ${data.period.days} дней` : `за ${days} дней`}
        </Text>

        <Segmented options={PERIODS} activeKey={days} onChange={setDays} />

        {loading || !data ? (
          <View style={{ padding: spacing.lg, gap: spacing.md, flexDirection: 'row' }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            {/* KPI grid */}
            <View style={styles.kpiGrid}>
              <GlassCard variant="g" style={styles.kpiTile}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>КАСАНИЯ</Text>
                <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]}>{data.totals.touches}</Text>
                <TrendBadge trend={data.totals.touchesTrend} />
              </GlassCard>
              <GlassCard variant="g" style={styles.kpiTile}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>АКТИВНЫЕ КЛИЕНТЫ</Text>
                <Text style={[styles.kpiValue, { color: colors.text, fontFamily: fonts.bold }]}>{data.totals.activeClients}</Text>
              </GlassCard>
            </View>
            <View style={styles.kpiGrid}>
              <GlassCard variant="g" style={styles.kpiTile}>
                <Text style={[styles.kpiLabel, { color: data.totals.attentionCount > 0 ? colors.error : colors.textSecondary }]}>ТРЕБУЕТ ВНИМАНИЯ</Text>
                <Text style={[styles.kpiValue, { color: data.totals.attentionCount > 0 ? colors.error : colors.text, fontFamily: fonts.bold }]}>{data.totals.attentionCount}</Text>
              </GlassCard>
              {data.totals.avgSentiment != null && (
                <GlassCard variant="g" style={styles.kpiTile}>
                  <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>ТОНАЛЬНОСТЬ ЗВОНКОВ</Text>
                  <Text
                    style={[
                      styles.kpiValue,
                      { fontFamily: fonts.bold, color: data.totals.avgSentiment > 0.2 ? colors.success : data.totals.avgSentiment < -0.2 ? colors.error : colors.text },
                    ]}
                  >
                    {data.totals.avgSentiment > 0 ? '+' : ''}{data.totals.avgSentiment.toFixed(2)}
                  </Text>
                </GlassCard>
              )}
            </View>

            {/* Leads */}
            <GlassCard variant="g" style={styles.widget}>
              <View style={styles.widgetHeaderRow}>
                <Text style={[styles.widgetOverline, styles.widgetOverlineInline, { color: colors.textSecondary }]}>ЛИДЫ</Text>
                <TrendBadge trend={data.leads.trend} />
              </View>
              <View style={styles.rowsWrap}>
                <StatRow label="Всего" value={String(data.leads.total)} colors={colors} />
                <StatRow label="Выиграно" value={String(data.leads.won)} colors={colors} valueColor={colors.success} />
                <StatRow label="Проиграно" value={String(data.leads.lost)} colors={colors} valueColor={colors.error} />
                <StatRow label="Открытый пайплайн" value={String(data.leads.openPipeline)} colors={colors} />
                <StatRow label="Конверсия" value={`${data.leads.conversionRate}%`} colors={colors} last />
              </View>
            </GlassCard>

            {/* Sales */}
            <GlassCard variant="g" style={styles.widget}>
              <View style={styles.widgetHeaderRow}>
                <Text style={[styles.widgetOverline, styles.widgetOverlineInline, { color: colors.textSecondary }]}>ПРОДАЖИ</Text>
                <TrendBadge trend={data.sales.trend} />
              </View>
              <View style={styles.rowsWrap}>
                <StatRow label="Всего" value={String(data.sales.total)} colors={colors} />
                <StatRow label="Подтверждено" value={String(data.sales.confirmed)} colors={colors} valueColor={colors.success} />
                <StatRow label="Выручка" value={formatAmounts(data.sales.revenue)} colors={colors} />
                <StatRow label="Средний чек" value={formatAmounts(data.sales.avgDeal)} colors={colors} last />
              </View>
            </GlassCard>

            {/* Products */}
            <GlassCard variant="g" style={styles.widget}>
              <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ТОВАРЫ</Text>
              <View style={styles.rowsWrap}>
                <StatRow label="Активных" value={String(data.products.activeCount)} colors={colors} />
                <StatRow label="Стоимость склада" value={formatAmounts(data.products.inventoryValue)} colors={colors} />
                <StatRow
                  label="Мало на складе"
                  value={String(data.products.lowStockCount)}
                  colors={colors}
                  valueColor={data.products.lowStockCount > 0 ? colors.error : undefined}
                  last
                />
              </View>
            </GlassCard>

            {/* Bookings */}
            <GlassCard variant="g" style={styles.widget}>
              <View style={styles.widgetHeaderRow}>
                <Text style={[styles.widgetOverline, styles.widgetOverlineInline, { color: colors.textSecondary }]}>БРОНИРОВАНИЯ</Text>
                <TrendBadge trend={data.bookings.trend} />
              </View>
              <View style={styles.rowsWrap}>
                <StatRow label="Всего" value={String(data.bookings.total)} colors={colors} />
                <StatRow label="Завершено" value={String(data.bookings.completed)} colors={colors} valueColor={colors.success} />
                <StatRow label="Отменено" value={String(data.bookings.cancelled)} colors={colors} valueColor={data.bookings.cancelled > 0 ? colors.error : undefined} />
                <StatRow label="Выручка" value={formatAmounts(data.bookings.revenue)} colors={colors} last />
              </View>
            </GlassCard>

            {/* Hotels — only when there's real data */}
            {hasHotels && (
              <GlassCard variant="g" style={styles.widget}>
                <View style={styles.widgetHeaderRow}>
                  <Text style={[styles.widgetOverline, styles.widgetOverlineInline, { color: colors.textSecondary }]}>ОТЕЛИ</Text>
                  <TrendBadge trend={data.hotels.trend} />
                </View>
                <View style={styles.rowsWrap}>
                  <StatRow label="Всего броней" value={String(data.hotels.total)} colors={colors} />
                  <StatRow label="Отменено" value={String(data.hotels.cancelled)} colors={colors} valueColor={data.hotels.cancelled > 0 ? colors.error : undefined} />
                  <StatRow label="Выручка" value={formatAmounts(data.hotels.revenue)} colors={colors} last />
                </View>
              </GlassCard>
            )}

            {/* Telephony — only when the add-on is enabled for this tenant */}
            {telephonyEnabled && (
              <GlassCard variant="g" style={styles.widget}>
                <View style={styles.widgetHeaderRow}>
                  <Text style={[styles.widgetOverline, styles.widgetOverlineInline, { color: colors.textSecondary }]}>ТЕЛЕФОНИЯ</Text>
                  <TrendBadge trend={data.telephony.trend} />
                </View>
                <View style={styles.rowsWrap}>
                  <StatRow label="Звонков" value={String(data.telephony.calls)} colors={colors} />
                  <StatRow label="SMS" value={String(data.telephony.sms)} colors={colors} />
                  <StatRow label="Дозвон" value={`${data.telephony.pickupRate}%`} colors={colors} last />
                </View>
              </GlassCard>
            )}

            {/* Marketing */}
            <GlassCard variant="g" style={styles.widget}>
              <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>МАРКЕТИНГ</Text>
              <View style={styles.rowsWrap}>
                <StatRow label="Подключено каналов" value={String(data.marketing.connectedChannels)} colors={colors} />
                <StatRow label="Расход" value={formatAmounts(data.marketing.spend)} colors={colors} />
                <StatRow label="Кампаний" value={String(data.marketing.campaigns)} colors={colors} />
                <StatRow
                  label="Страны"
                  value={data.marketing.countries > 0 ? `${data.marketing.countries} (${data.marketing.topCountries.join(', ')})` : '0'}
                  colors={colors}
                  last={data.marketing.channels.length === 0}
                />
              </View>
            </GlassCard>

            {data.marketing.channels.length > 0 && (
              <GlassCard variant="g2" style={styles.listCard}>
                {data.marketing.channels.map((ch, i) => (
                  <View
                    key={`${ch.provider}-${i}`}
                    style={[styles.channelRow, { borderBottomColor: colors.line3, borderBottomWidth: i < data.marketing.channels.length - 1 ? 1 : 0 }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.dot, { backgroundColor: ch.connected ? colors.success : colors.textTertiary }]} />
                        <Text style={[styles.channelName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{ch.name}</Text>
                      </View>
                      <Text style={[styles.channelMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                        {ch.campaigns} кампани{ch.campaigns === 1 ? 'я' : 'й'}{ch.countries > 0 ? ` · ${ch.countries} стран` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.channelSpend, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{formatAmounts(ch.spend)}</Text>
                  </View>
                ))}
              </GlassCard>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const StatRow: React.FC<{ label: string; value: string; colors: any; valueColor?: string; last?: boolean }> = ({ label, value, colors, valueColor, last }) => (
  <View style={[styles.statRow, { borderBottomColor: colors.line3, borderBottomWidth: last ? 0 : 1 }]}>
    <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    <Text style={[styles.statValue, { color: valueColor || colors.text, fontFamily: fonts.semibold }]} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  largeTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 2 },
  subtitle: { fontSize: 12, fontFamily: fonts.regular, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },

  kpiGrid: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm },
  kpiTile: { flex: 1, borderRadius: radius.xxl, padding: 14, gap: 4 },
  kpiLabel: { fontSize: 10, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiValue: { fontSize: 20, letterSpacing: -0.4 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  trendTxt: { fontSize: 10.5 },

  widget: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.lg },
  widgetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  widgetOverline: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  widgetOverlineInline: { marginBottom: 0 },
  rowsWrap: {},
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, gap: spacing.sm },
  statLabel: { fontSize: 13, fontFamily: fonts.regular, flex: 1 },
  statValue: { fontSize: 13.5 },

  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, marginBottom: spacing.sm, overflow: 'hidden' },
  channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 12, gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  channelName: { fontSize: 13.5, flexShrink: 1 },
  channelMeta: { fontSize: 11, marginTop: 2 },
  channelSpend: { fontSize: 12.5 },
});

export default BiDashboardScreen;
