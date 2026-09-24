import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchTraffic, fetchTrafficChannels, TrafficData, TrafficChannelStat } from '../../api/marketing';
import { formatMoney } from '../../utils/money';
import { StatGrid2, Pill, TapChart, ZoomableChart, useDateDrilldown } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { appLocale, formatDecimal } from '../../i18n/format';

function dsLabel(dataSource: string, labels?: Record<string, string>): string {
  return labels?.[dataSource] || dataSource;
}

export const TrafficScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [daily, setDaily] = useState<TrafficData[]>([]);
  const [channels, setChannels] = useState<TrafficChannelStat[]>([]);
  const [labels, setLabels] = useState<Record<string, string> | undefined>();
  const [totals, setTotals] = useState({ sessions: 0, leads: 0, revenue: 0, cost: 0, clicks: 0, impressions: 0, currency: 'EUR' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toDisplay, cur, mode } = useCurrencyMode();
  const { from, to, label, canZoomIn, canZoomOut, zoomIn, zoomOut } = useDateDrilldown();

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [dailyData, stats] = await Promise.all([fetchTraffic({ from, to }), fetchTrafficChannels({ from, to })]);
      setDaily(dailyData);
      setChannels((stats.providerBreakdown || []).slice().sort((a, b) => b.sessions - a.sessions));
      setLabels(stats.dataSourceLabels);
      setTotals({
        sessions: stats.totalSessions, leads: stats.totalLeads, revenue: stats.totalRevenue, cost: stats.totalCost,
        clicks: stats.totalClicks, impressions: stats.totalImpressions, currency: stats.currency,
      });
    } catch (error) {
      console.error('Failed to load traffic:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const sortedDaily = useMemo(
    () => [...daily]
      .filter((d) => d.date && !Number.isNaN(new Date(d.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [daily],
  );
  const topSessions = channels[0]?.sessions || 1;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null;
  // The backend sums `cost` across rows of different currencies and reports `currency: 'MIXED'` — meaningless as a
  // single number. Convert per provider row (each has its own currency) into the display currency, like the website does.
  // Native mode + one currency in the data: keep that currency untouched.
  const single = totals.currency !== 'MIXED' && mode === 'native';
  const costTotal = single ? totals.cost : channels.reduce((sum, c) => sum + toDisplay(c.cost, c.currency), 0);
  const moneyCur = single ? totals.currency : cur;
  const cpc = totals.clicks > 0 ? costTotal / totals.clicks : null;
  const cpm = totals.impressions > 0 ? (costTotal / totals.impressions) * 1000 : null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {sortedDaily.length > 1 && (
          <GlassCard variant="g" style={styles.heroCard} contentStyle={styles.heroContent}>
            <ZoomableChart label={label} canZoomIn={canZoomIn} canZoomOut={canZoomOut} onZoomIn={zoomIn} onZoomOut={zoomOut}>
              <TapChart
                dates={sortedDaily.map((d) => d.date)}
                series={[
                  { key: 'sessions', label: 'Сессии', color: colors.text, values: sortedDaily.map((d) => d.sessions) },
                  { key: 'clicks', label: 'Клики', color: colors.accent, values: sortedDaily.map((d) => d.clicks) },
                ]}
                formatDate={(d) => new Date(d).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short' })}
              />
            </ZoomableChart>
          </GlassCard>
        )}

        <StatGrid2
          items={[
            { label: 'Показы', value: totals.impressions.toLocaleString(appLocale()) },
            { label: 'Клики / просмотры', value: totals.clicks.toLocaleString(appLocale()) },
            { label: 'Сессии / визиты', value: totals.sessions.toLocaleString(appLocale()) },
            { label: 'CTR', value: ctr != null ? `${formatDecimal(ctr, 2)}%` : '—' },
            { label: 'CPC', value: cpc != null && cpc > 0 ? formatMoney(cpc, moneyCur) : '—' },
            { label: 'CPM', value: cpm != null && cpm > 0 ? formatMoney(cpm, moneyCur) : '—' },
          ]}
        />

        <GlassCard variant="g" style={styles.section} contentStyle={styles.sectionContent}>
          <View style={styles.sectionHeader}>
            <Ionicons name="git-network-outline" size={16} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Источники</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.kicker, { color: colors.textTertiary }]}>сессии · лиды</Text>
          </View>
          {channels.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="analytics-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Нет данных о трафике</Text>
            </View>
          ) : (
            channels.map((ch, i) => {
              const cr = ch.sessions > 0 ? (ch.leads / ch.sessions) * 100 : 0;
              const cpl = ch.leads > 0 ? ch.cost / ch.leads : null;
              return (
                <TouchableOpacity
                  key={`${ch.dataSource}-${i}`}
                  style={[styles.sourceRow, i > 0 && { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}
                  onPress={() => navigation.navigate('ChannelDetail', { channelKey: ch.dataSource })}
                  activeOpacity={0.7}
                >
                  <View style={styles.sourceTop}>
                    <Text style={[styles.sourceName, { color: colors.text }]} numberOfLines={1}>{dsLabel(ch.dataSource, labels)}</Text>
                    <Text style={[styles.sourceNum, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{ch.sessions.toLocaleString(appLocale())}</Text>
                    <Pill label={`${ch.leads} лид.`} tone="acc" />
                    <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                  </View>
                  <View style={[styles.bar, { backgroundColor: colors.surfaceVariant }]}>
                    <View style={[styles.barFill, { width: `${Math.max(2, (ch.sessions / topSessions) * 100)}%`, backgroundColor: colors.accent }]} />
                  </View>
                  <Text style={[styles.sourceMeta, { color: colors.textTertiary }]}>
                    CR {formatDecimal(cr, 1)}% · CPL {cpl != null ? formatMoney(cpl, ch.currency) : 'бесплатно'}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg },
  heroCard: { borderRadius: 22, marginBottom: spacing.sm },
  heroContent: { padding: spacing.lg },
  kicker: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.6 },
  heroValue: { fontSize: 30, fontFamily: fonts.semibold, letterSpacing: -0.5, marginTop: 4 },
  section: { borderRadius: 22, marginTop: spacing.sm },
  sectionContent: { padding: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  sectionTitle: { fontSize: 17, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  empty: { padding: 48, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: fonts.regular },
  sourceRow: { paddingVertical: spacing.sm + 2 },
  sourceTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  sourceName: { flex: 1, fontSize: 13, fontFamily: fonts.regular },
  sourceNum: { fontSize: 12.5 },
  bar: { height: 5, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full },
  sourceMeta: { fontSize: 11.5, marginTop: 5 },
});
