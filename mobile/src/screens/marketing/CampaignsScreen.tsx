import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchTrafficChannels, TrafficItem } from '../../api/marketing';
import { formatMoney } from '../../utils/money';
import { StatGrid2, FunnelBars, Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { showToast } from '../../components/ui';

interface CampaignAgg {
  campaign: string;
  dataSource: string | null;
  sessions: number;
  clicks: number;
  leads: number;
  impressions: number;
  cost: number;
  revenue: number;
  currency: string;
}

function aggregateByCampaign(items: TrafficItem[]): CampaignAgg[] {
  const m = new Map<string, CampaignAgg>();
  items.forEach((it) => {
    const name = (it.campaign || '').trim() || '(без названия)';
    const key = `${it.dataSource || ''}::${name}`;
    const cur = m.get(key) || { campaign: name, dataSource: it.dataSource, sessions: 0, clicks: 0, leads: 0, impressions: 0, cost: 0, revenue: 0, currency: it.currency };
    cur.sessions += it.sessions;
    cur.clicks += it.clicks;
    cur.leads += it.leads;
    cur.impressions += it.impressions;
    cur.cost += it.cost;
    cur.revenue += it.revenue;
    m.set(key, cur);
  });
  return [...m.values()].sort((a, b) => b.cost - a.cost || b.clicks - a.clicks);
}

export const CampaignsScreen: React.FC = () => {
  const { colors } = useTheme();
  const [campaigns, setCampaigns] = useState<CampaignAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const stats = await fetchTrafficChannels();
      setCampaigns(aggregateByCampaign(stats.items || []));
    } catch {
      showToast('Не удалось загрузить кампании', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => ({
        cost: acc.cost + c.cost, clicks: acc.clicks + c.clicks, impressions: acc.impressions + c.impressions, leads: acc.leads + c.leads,
      }),
      { cost: 0, clicks: 0, impressions: 0, leads: 0 },
    );
  }, [campaigns]);

  const topByClicks = useMemo(() => {
    return [...campaigns]
      .filter((c) => c.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 6)
      .map((c) => ({
        label: c.campaign.length > 12 ? c.campaign.slice(0, 12) + '…' : c.campaign,
        value: c.clicks,
        displayValue: c.clicks.toLocaleString('ru-RU'),
      }));
  }, [campaigns]);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <StatGrid2
          items={[
            { label: 'Расход', value: formatMoney(totals.cost, campaigns[0]?.currency) },
            { label: 'Клики', value: totals.clicks.toLocaleString('ru-RU') },
            { label: 'Показы', value: totals.impressions.toLocaleString('ru-RU') },
            { label: 'Лиды', value: totals.leads.toLocaleString('ru-RU') },
          ]}
        />

        {topByClicks.length > 0 && (
          <GlassCard variant="g" style={styles.chartCard} contentStyle={styles.chartContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="stats-chart-outline" size={16} color={colors.text} />
              <Text style={[styles.chartTitle, { color: colors.text }]}>Топ кампаний по кликам</Text>
            </View>
            <FunnelBars rows={topByClicks} />
          </GlassCard>
        )}

        {campaigns.map((item, i) => (
          <GlassCard key={`${item.dataSource}-${item.campaign}-${i}`} variant="flat" style={styles.card} contentStyle={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={[styles.campaignName, { color: colors.text }]} numberOfLines={1}>{item.campaign}</Text>
              {item.dataSource && <Pill label={item.dataSource} tone="acc" />}
            </View>

            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>ПОКАЗЫ</Text>
                <Text style={[styles.metricValue, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{item.impressions.toLocaleString('ru-RU')}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>КЛИКИ</Text>
                <Text style={[styles.metricValue, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{item.clicks.toLocaleString('ru-RU')}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>СЕССИИ</Text>
                <Text style={[styles.metricValue, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{item.sessions.toLocaleString('ru-RU')}</Text>
              </View>
              {item.leads > 0 && (
                <View style={styles.metric}>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>ЛИДЫ</Text>
                  <Text style={[styles.metricValue, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{item.leads.toLocaleString('ru-RU')}</Text>
                </View>
              )}
            </View>

            <View style={[styles.dates, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.dateText, { color: colors.textTertiary }]}>Расход {formatMoney(item.cost, item.currency)}</Text>
              {item.revenue > 0 && <Text style={[styles.dateText, { color: colors.success }]}>Выручка {formatMoney(item.revenue, item.currency)}</Text>}
            </View>
          </GlassCard>
        ))}

        {campaigns.length === 0 && (
          <GlassCard variant="g" style={styles.emptyState} contentStyle={styles.emptyStateContent}>
            <Ionicons name="megaphone-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Нет кампаний</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Здесь появятся кампании из подключённых рекламных источников</Text>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: 32 },
  chartCard: { borderRadius: 22, marginTop: spacing.sm, marginBottom: spacing.sm },
  chartContent: { padding: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  chartTitle: { fontSize: 17, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  card: { borderRadius: radius.xxl, marginBottom: spacing.sm },
  cardContent: { padding: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  campaignName: { fontSize: 15.5, fontFamily: fonts.semibold, flex: 1 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  metric: { flex: 1, minWidth: '45%' },
  metricLabel: { fontSize: 10, fontFamily: fonts.mono, letterSpacing: 0.5, marginBottom: 3 },
  metricValue: { fontSize: 15 },
  dates: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md, marginTop: spacing.md, borderTopWidth: 1 },
  dateText: { fontSize: 11.5, fontFamily: fonts.regular },
  emptyState: { borderRadius: 24, marginTop: 32 },
  emptyStateContent: { alignItems: 'center', padding: 48 },
  emptyText: { fontSize: 20, fontFamily: fonts.bold, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, fontFamily: fonts.regular, textAlign: 'center' },
});
