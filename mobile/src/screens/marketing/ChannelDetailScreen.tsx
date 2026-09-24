import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import {
  fetchTraffic, fetchTrafficChannels, fetchTrafficByCountry,
  TrafficData, TrafficChannelStat, TrafficItem, TrafficCountryRow,
} from '../../api/marketing';
import { formatMoney } from '../../utils/money';
import { StatGrid2, FunnelBars, TapChart, WorldMap, CountryAgg, ZoomableChart, useDateDrilldown } from '../../components/mg';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { appLocale, formatDecimal } from '../../i18n/format';

const DS_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  meta_ads: { label: 'Meta Ads', icon: 'logo-facebook', color: '#0866FF' },
  google_ads: { label: 'Google Ads', icon: 'logo-google', color: '#EA4335' },
  telegram: { label: 'Telegram', icon: 'paper-plane', color: '#229ED9' },
  yandex_metrika: { label: 'Яндекс.Метрика', icon: 'search', color: '#FC3F1D' },
  yandex_direct: { label: 'Яндекс.Директ', icon: 'search', color: '#FC3F1D' },
  vk_ads: { label: 'VK Ads', icon: 'logo-vk', color: '#0077FF' },
  ga4: { label: 'Google Analytics', icon: 'analytics-outline', color: '#F9AB00' },
  whatsapp: { label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  instagram: { label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  direct: { label: 'Прямой', icon: 'navigate-circle-outline', color: '#555' },
  organic: { label: 'Органика', icon: 'leaf-outline', color: '#1f8a5e' },
};
function dsMeta(dataSource: string, labels?: Record<string, string>) {
  const m = DS_META[dataSource];
  return {
    label: labels?.[dataSource] || m?.label || dataSource,
    icon: (m?.icon || 'ellipse-outline') as keyof typeof Ionicons.glyphMap,
    color: m?.color || '#888',
  };
}
function campaignLabel(it: TrafficItem): string {
  const c = (it.campaign || '').trim();
  return c || '(без названия)';
}

interface DimAgg { key: string; sessions: number; clicks: number; cost: number; currency: string }
function aggregateBy(rows: TrafficItem[], dim: 'source' | 'medium'): DimAgg[] {
  const m = new Map<string, DimAgg>();
  rows.forEach((r) => {
    const raw = (dim === 'source' ? r.source : r.medium) || '';
    const key = raw.trim() || '(не задано)';
    const cur = m.get(key) || { key, sessions: 0, clicks: 0, cost: 0, currency: r.currency };
    cur.sessions += r.sessions;
    cur.clicks += r.clicks;
    cur.cost += r.cost;
    m.set(key, cur);
  });
  return [...m.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 8);
}

export const ChannelDetailScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const channelKey: string = route.params?.channelKey;

  const [daily, setDaily] = useState<TrafficData[]>([]);
  const { toDisplay, cur } = useCurrencyMode();
  const [rawStat, setStat] = useState<TrafficChannelStat | null>(null);
  const [items, setItems] = useState<TrafficItem[]>([]);
  const [countryRows, setCountryRows] = useState<TrafficCountryRow[]>([]);
  const [labels, setLabels] = useState<Record<string, string> | undefined>();
  const [loading, setLoading] = useState(true);
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const { from, to, label: rangeLabel, canZoomIn, canZoomOut, zoomIn, zoomOut } = useDateDrilldown();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dailyData, channelStats, geo] = await Promise.all([
        fetchTraffic({ dataSource: channelKey, from, to }),
        fetchTrafficChannels({ dataSource: channelKey, from, to }),
        fetchTrafficByCountry({ dataSource: channelKey, from, to }),
      ]);
      setDaily(dailyData);
      setLabels(channelStats.dataSourceLabels);
      setStat(channelStats.providerBreakdown.find((c) => c.dataSource === channelKey) || (channelStats.totalSessions ? {
        dataSource: channelKey, sessions: channelStats.totalSessions, clicks: channelStats.totalClicks, leads: channelStats.totalLeads,
        revenue: channelStats.totalRevenue, cost: channelStats.totalCost, impressions: channelStats.totalImpressions, currency: channelStats.currency,
      } : null));
      setItems(channelStats.items || []);
      setCountryRows(geo);
    } catch {
      showToast('Не удалось загрузить канал', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [channelKey, from, to]);

  useEffect(() => { load(); }, [load]);

  const meta = dsMeta(channelKey, labels);

  const sortedDaily = useMemo(
    () => [...daily]
      .filter((d) => d.date && !Number.isNaN(new Date(d.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [daily],
  );

  // A channel whose rows span several currencies comes back as `currency: 'MIXED'` with a raw cross-currency sum —
  // rebuild cost/revenue from the per-campaign rows in the display currency instead.
  const stat = useMemo<TrafficChannelStat | null>(() => {
    if (!rawStat || rawStat.currency !== 'MIXED' || items.length === 0) return rawStat;
    return {
      ...rawStat,
      cost: items.reduce((s, i) => s + toDisplay(i.cost, i.currency), 0),
      revenue: items.reduce((s, i) => s + toDisplay(i.revenue, i.currency), 0),
      currency: cur,
    };
  }, [rawStat, items, toDisplay, cur]);

  const ctr = stat && stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : null;
  const cpc = stat && stat.clicks > 0 ? stat.cost / stat.clicks : null;
  const cpm = stat && stat.impressions > 0 ? (stat.cost / stat.impressions) * 1000 : null;

  const topByCost = useMemo(() => [...items].filter((i) => i.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 6), [items]);
  const topByImpressions = useMemo(() => [...items].filter((i) => i.impressions > 0).sort((a, b) => b.impressions - a.impressions).slice(0, 6), [items]);
  const visibleItems = showAllCampaigns ? items : items.slice(0, 8);

  const bySource = useMemo(() => aggregateBy(items, 'source'), [items]);
  const byMedium = useMemo(() => aggregateBy(items, 'medium'), [items]);

  const countryMap = useMemo(() => {
    const m = new Map<string, CountryAgg>();
    countryRows.forEach((r) => {
      const iso = (r.country || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(iso)) return;
      const cur = m.get(iso) || { sessions: 0, clicks: 0, impressions: 0 };
      cur.sessions += r.sessions;
      cur.clicks += r.clicks;
      cur.impressions += r.impressions;
      m.set(iso, cur);
    });
    return m;
  }, [countryRows]);
  const sortedCountries = useMemo(() => [...countryRows].sort((a, b) => b.sessions - a.sessions).slice(0, 10), [countryRows]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text }]}>Каналы</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.channelHeader}>
          <View style={[styles.channelLogo, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.channelName, { color: colors.text }]}>{meta.label}</Text>
            <Text style={[styles.channelSub, { color: colors.textSecondary }]}>Источник трафика · {channelKey}</Text>
          </View>
        </View>

        {loading ? (
          <SkeletonList count={4} />
        ) : !stat ? (
          <EmptyState icon="bar-chart-outline" title="Нет данных" subtitle="За выбранный период по этому каналу трафика не было" />
        ) : (
          <>
            <View style={styles.statsWrap}>
              <StatGrid2
                items={[
                  { label: 'Показы', value: stat.impressions.toLocaleString(appLocale()) },
                  { label: 'Клики / просмотры', value: stat.clicks.toLocaleString(appLocale()) },
                  { label: 'Сессии / визиты', value: stat.sessions.toLocaleString(appLocale()) },
                  { label: 'CTR', value: ctr != null ? `${formatDecimal(ctr, 2)}%` : '—' },
                  { label: 'CPC', value: cpc != null && cpc > 0 ? formatMoney(cpc, stat.currency) : '—' },
                  { label: 'CPM', value: cpm != null && cpm > 0 ? formatMoney(cpm, stat.currency) : '—' },
                ]}
              />
            </View>

            {sortedDaily.length > 1 && (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Динамика по дням</Text>
                <ZoomableChart label={rangeLabel} canZoomIn={canZoomIn} canZoomOut={canZoomOut} onZoomIn={zoomIn} onZoomOut={zoomOut}>
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

            {topByCost.length > 0 && (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Расход по кампаниям</Text>
                <FunnelBars rows={topByCost.map((it) => ({ label: campaignLabel(it), value: it.cost, displayValue: formatMoney(it.cost, it.currency) }))} />
              </GlassCard>
            )}

            {topByImpressions.length > 0 && (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Топ кампаний по показам</Text>
                <FunnelBars rows={topByImpressions.map((it) => ({ label: campaignLabel(it), value: it.impressions, displayValue: it.impressions.toLocaleString(appLocale()) }))} />
              </GlassCard>
            )}

            {items.length > 0 && (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Все кампании в выборке</Text>
                  <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>{items.length}</Text>
                </View>
                {visibleItems.map((it, i) => (
                  <View key={i} style={[styles.campRow, i > 0 && { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}>
                    <Text style={[styles.campName, { color: colors.text }]} numberOfLines={1}>{campaignLabel(it)}</Text>
                    <View style={styles.campMetrics}>
                      <Text style={[styles.campMetric, { color: colors.textSecondary }]}>Показы <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{it.impressions.toLocaleString(appLocale())}</Text></Text>
                      <Text style={[styles.campMetric, { color: colors.textSecondary }]}>Клики <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{it.clicks.toLocaleString(appLocale())}</Text></Text>
                      <Text style={[styles.campMetric, { color: colors.textSecondary }]}>Сессии <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{it.sessions.toLocaleString(appLocale())}</Text></Text>
                      {it.leads > 0 && <Text style={[styles.campMetric, { color: colors.textSecondary }]}>Лиды <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{it.leads}</Text></Text>}
                      <Text style={[styles.campMetric, { color: colors.textSecondary }]}>Расход <Text style={{ color: colors.text, fontFamily: fonts.monoSemibold }}>{formatMoney(it.cost, it.currency)}</Text></Text>
                      {it.revenue > 0 && <Text style={[styles.campMetric, { color: colors.success }]}>Выручка <Text style={{ color: colors.success, fontFamily: fonts.monoSemibold }}>{formatMoney(it.revenue, it.currency)}</Text></Text>}
                    </View>
                  </View>
                ))}
                {items.length > 8 && (
                  <TouchableOpacity onPress={() => setShowAllCampaigns((v) => !v)} style={styles.showMoreBtn}>
                    <Text style={[styles.showMoreTxt, { color: colors.accent }]}>{showAllCampaigns ? 'Свернуть' : `Показать все ${items.length}`}</Text>
                  </TouchableOpacity>
                )}
              </GlassCard>
            )}

            {(bySource.length > 0 || byMedium.length > 0) && (
              <View style={styles.dimRow}>
                {bySource.length > 0 && (
                  <GlassCard variant="g" style={[styles.card, styles.dimCard]} contentStyle={styles.cardContent}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Источники</Text>
                    {bySource.map((r, i) => (
                      <View key={r.key} style={[styles.dimRowItem, i > 0 && { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}>
                        <Text style={[styles.dimName, { color: colors.text }]} numberOfLines={1}>{r.key}</Text>
                        <Text style={[styles.dimValue, { color: colors.textSecondary }]}>{r.sessions.toLocaleString(appLocale())} сесс.</Text>
                      </View>
                    ))}
                  </GlassCard>
                )}
                {byMedium.length > 0 && (
                  <GlassCard variant="g" style={[styles.card, styles.dimCard]} contentStyle={styles.cardContent}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Тип канала</Text>
                    {byMedium.map((r, i) => (
                      <View key={r.key} style={[styles.dimRowItem, i > 0 && { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}>
                        <Text style={[styles.dimName, { color: colors.text }]} numberOfLines={1}>{r.key}</Text>
                        <Text style={[styles.dimValue, { color: colors.textSecondary }]}>{r.sessions.toLocaleString(appLocale())} сесс.</Text>
                      </View>
                    ))}
                  </GlassCard>
                )}
              </View>
            )}

            <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>География</Text>
              <WorldMap byCountry={countryMap} />
              {sortedCountries.length > 0 && (
                <View style={{ marginTop: spacing.md }}>
                  {sortedCountries.map((r, i) => (
                    <View key={`${r.country}-${i}`} style={[styles.countryRow, i > 0 && { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}>
                      <Text style={[styles.countryName, { color: colors.text }]}>{r.country || '—'}</Text>
                      <Text style={[styles.countryMetric, { color: colors.textSecondary }]}>{r.sessions.toLocaleString(appLocale())} сесс.</Text>
                      <Text style={[styles.countryMetric, { color: colors.textSecondary }]}>{r.impressions.toLocaleString(appLocale())} показ.</Text>
                    </View>
                  ))}
                </View>
              )}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15, fontFamily: fonts.regular },

  channelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: spacing.lg },
  channelLogo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  channelName: { fontSize: 21, fontFamily: fonts.bold, letterSpacing: -0.4 },
  channelSub: { fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },

  statsWrap: { paddingHorizontal: 16, marginBottom: spacing.sm },
  card: { borderRadius: 22, marginHorizontal: 16, marginBottom: spacing.sm },
  cardContent: { padding: spacing.lg },
  sectionTitle: { fontSize: 15, fontFamily: fonts.semibold, marginBottom: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionCount: { fontSize: 12, fontFamily: fonts.mono },

  campRow: { paddingVertical: spacing.sm },
  campName: { fontSize: 13.5, fontFamily: fonts.semibold, marginBottom: 4 },
  campMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  campMetric: { fontSize: 11 },
  showMoreBtn: { paddingTop: spacing.sm, alignItems: 'center' },
  showMoreTxt: { fontSize: 12.5, fontFamily: fonts.semibold },

  countryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 },
  countryName: { flex: 1, fontSize: 13, fontFamily: fonts.medium },
  countryMetric: { fontSize: 11.5 },

  dimRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: 16, marginBottom: spacing.sm },
  dimCard: { flex: 1, marginHorizontal: 0, marginBottom: 0 },
  dimRowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingVertical: 6 },
  dimName: { flex: 1, fontSize: 12, fontFamily: fonts.medium },
  dimValue: { fontSize: 10.5 },
});
