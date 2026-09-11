import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchLeadStats, LeadStats } from '../../api/leads';
import { fetchSalesAnalytics, SalesAnalytics } from '../../api/sales';
import { fetchAllCompaniesAnalytics, AllCompaniesAnalytics } from '../../api/companies';
import { fetchLeadRoi, LeadsRoiStats } from '../../api/leads';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { AuraBackground, GlassCard } from '../../components/glass';
import { MgHeader, CurrencyChip, ThemeChip, Segmented, Chips, Pill, StatGrid2, FunnelBars, Sparkline } from '../../components/mg';
import { showToast } from '../../components/ui';

type AnTab = 'leads' | 'sales' | 'companies' | 'roi';

const STATUS_LABEL: Record<string, string> = { new: 'Новые', in_progress: 'В работе', waiting: 'Ожидают', won: 'Выиграно', lost: 'Проиграно' };
const STATUS_COLOR: Record<string, string> = {};

function statusColor(colors: ReturnType<typeof useTheme>['colors'], status: string): string {
  const map: Record<string, string> = { new: colors.info, in_progress: colors.textSecondary, waiting: colors.warning, won: colors.success, lost: colors.error };
  return map[status] || colors.textSecondary;
}

export const AnalyticsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { cur, mode, setMode } = useCurrencyMode();
  const [tab, setTab] = useState<AnTab>('leads');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <MgHeader
        title="Аналитика"
        sub={mode === 'native' ? 'Суммы в валюте записи' : `Пересчёт в ${cur} по курсу тенанта`}
        right={<><CurrencyChip /><ThemeChip /></>}
      >
        <View style={{ marginTop: 11 }}>
          <Segmented
            options={[
              { key: 'leads', label: 'Лиды' },
              { key: 'sales', label: 'Продажи' },
              { key: 'companies', label: 'Компании' },
              { key: 'roi', label: 'ROI' },
            ]}
            activeKey={tab}
            onChange={(k) => setTab(k as AnTab)}
          />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Chips
            options={[
              { key: 'converted', label: `Пересчёт в ${cur}` },
              { key: 'native', label: 'Как в записи' },
            ]}
            activeKey={mode}
            onChange={(k) => setMode(k as 'converted' | 'native')}
          />
        </View>
      </MgHeader>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {tab === 'leads' && <LeadsAnalytics />}
        {tab === 'sales' && <SalesAnalyticsTab />}
        {tab === 'companies' && <CompaniesAnalyticsTab />}
        {tab === 'roi' && <RoiAnalyticsTab />}
      </ScrollView>
    </View>
  );
};

function CardHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>;
}

function LeadsAnalytics() {
  const { colors } = useTheme();
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadStats().then(setStats).catch(() => showToast('Не удалось загрузить аналитику лидов', { variant: 'error' })).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />;
  if (!stats) return null;

  const total = stats.total || 1;
  const wonCount = stats.byStatus.find((s) => s.status === 'won')?.count || 0;
  const conv = ((wonCount / total) * 100).toFixed(1).replace('.', ',');
  const maxSource = Math.max(...stats.bySource.map((s) => s.count), 1);
  const maxCountry = Math.max(...stats.byCountry.map((s) => s.count), 1);

  return (
    <>
      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.cardHeadRow}>
          <Text style={[styles.kicker, { color: colors.textTertiary }]}>ВСЕГО ЛИДОВ</Text>
          <View style={styles.spacer} />
          <Pill label={`конверсия ${conv}%`} tone="pos" />
        </View>
        <Text style={[styles.money, { color: colors.text, fontSize: 32 }]}>{stats.total.toLocaleString('ru-RU')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>за всё время · корзина и архив исключены</Text>
        <View style={{ marginTop: spacing.md }}>
          <FunnelBars rows={stats.byStatus.map((s) => ({ label: STATUS_LABEL[s.status] || s.status, value: s.count, displayValue: String(s.count), color: statusColor(colors, s.status) }))} max={total} />
        </View>
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="Источники" />
        <FunnelBars rows={stats.bySource.map((s) => ({ label: s.source, value: s.count, displayValue: String(s.count) }))} max={maxSource} />
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.cardHeadRow}>
          <Text style={[styles.h2, { color: colors.text }]}>Менеджеры</Text>
          <View style={styles.spacer} />
          <Text style={[styles.kicker, { color: colors.textTertiary }]}>WON / LOST</Text>
        </View>
        {stats.byManager.map((m) => (
          <View key={m.manager} style={{ paddingVertical: 8 }}>
            <View style={styles.row}>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text }} numberOfLines={1}>{m.manager}</Text>
              <Pill label={String(m.won)} tone="pos" />
              <Pill label={String(m.lost)} tone="neg" />
              <Text style={[styles.num, { color: colors.textSecondary, width: 40, textAlign: 'right' }]}>{Math.round((m.won / (m.total || 1)) * 100)}%</Text>
            </View>
            <View style={[styles.splitBar, { backgroundColor: colors.surfaceVariant }]}>
              <View style={{ width: `${(m.won / (m.total || 1)) * 100}%`, backgroundColor: colors.success }} />
              <View style={{ width: `${(m.lost / (m.total || 1)) * 100}%`, backgroundColor: colors.error }} />
            </View>
          </View>
        ))}
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="Гео" />
        <FunnelBars rows={stats.byCountry.map((c) => ({ label: c.country, value: c.count, displayValue: String(c.count) }))} max={maxCountry} />
      </GlassCard>
    </>
  );
}

function SalesAnalyticsTab() {
  const { colors } = useTheme();
  const { fmt } = useCurrencyMode();
  const [a, setA] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesAnalytics().then(setA).catch(() => showToast('Не удалось загрузить аналитику продаж', { variant: 'error' })).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />;
  if (!a) return null;

  const timelineTotals = a.timeline.amount.map((row) => Object.entries(row).filter(([k]) => k !== 'month').reduce((s, [, v]) => s + (v as number), 0));
  const topStatus = a.byStatus[0];
  const refunds = a.byStatus.find((s) => s.status === 'refunded');
  const maxChannel = Math.max(...a.byChannel.map((c) => c.amount), 1);
  const maxManager = Math.max(...a.byManager.map((m) => m.amount), 1);

  return (
    <>
      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <Text style={[styles.kicker, { color: colors.textTertiary }]}>ОБОРОТ</Text>
        <Text style={[styles.money, { color: colors.text, fontSize: 30 }]}>{fmt(a.totalAmount, a.displayCurrency, { short: true })}</Text>
        {timelineTotals.length > 1 && <View style={{ marginTop: 12, marginHorizontal: -2 }}><Sparkline data={timelineTotals} height={80} /></View>}
      </GlassCard>

      <StatGrid2 items={[
        { label: 'Заказов', value: a.totalCount.toString() },
        { label: 'Средний чек', value: fmt(a.avgCheck, a.displayCurrency) },
        { label: topStatus ? topStatus.status : '—', value: topStatus ? topStatus.count.toString() : '0' },
        { label: 'Возвраты', value: refunds ? fmt(refunds.amount, a.displayCurrency, { short: true }) : '—' },
      ]} />

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="По статусам" />
        <FunnelBars rows={a.byStatus.map((s) => ({ label: s.status, value: s.amount, displayValue: fmt(s.amount, a.displayCurrency, { short: true }) }))} />
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="Каналы" />
        <FunnelBars rows={a.byChannel.map((c) => ({ label: c.label, value: c.amount, displayValue: fmt(c.amount, a.displayCurrency, { short: true }) }))} max={maxChannel} />
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.cardHeadRow}>
          <Text style={[styles.h2, { color: colors.text }]}>По валютам</Text>
          <View style={styles.spacer} />
          <Text style={[styles.kicker, { color: colors.textTertiary }]}>ИСХОДНЫЕ СУММЫ</Text>
        </View>
        {a.byCurrency.map((c) => (
          <View key={c.label} style={[styles.row, { paddingVertical: 6 }]}>
            <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13 }}>{c.label} · {c.count} заказов</Text>
            <Text style={[styles.money, { color: colors.text, fontSize: 13 }]}>{fmt(c.amount, c.label, { short: true })}</Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="Менеджеры" />
        <FunnelBars rows={a.byManager.map((m) => ({ label: m.label, value: m.amount, displayValue: fmt(m.amount, a.displayCurrency, { short: true }) }))} max={maxManager} />
      </GlassCard>
    </>
  );
}

function CompaniesAnalyticsTab() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { fmt } = useCurrencyMode();
  const [c, setC] = useState<AllCompaniesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'revenue' | 'projects' | 'leads'>('revenue');

  useEffect(() => {
    fetchAllCompaniesAnalytics().then(setC).catch(() => showToast('Не удалось загрузить аналитику компаний', { variant: 'error' })).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />;
  if (!c) return null;

  const top = c.topByRevenue;
  const total = top.reduce((a, x) => a + x.revenue, 0) || 1;
  const top3 = top.slice(0, 3).reduce((a, x) => a + x.revenue, 0);
  const rows = [...top].sort((a, b) => b[metric] - a[metric]);
  const maxV = rows[0]?.[metric] || 1;

  return (
    <>
      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.summaryGrid}>
          {[
            ['Компаний', c.summary.totalCompanies.toLocaleString('ru-RU')],
            ['Лидов', c.summary.totalLeads.toLocaleString('ru-RU')],
            ['Проектов', c.summary.totalProjects.toLocaleString('ru-RU')],
            ['Выручка', fmt(c.summary.totalRevenue, c.summary.currency, { short: true })],
            ['Потенциал', fmt(c.summary.totalPotentialRevenue, c.summary.currency, { short: true })],
            ['Конверсия', `${c.summary.avgConversionRate.toFixed(1).replace('.', ',')}%`],
          ].map(([l, v]) => (
            <View key={l} style={styles.summaryCell}>
              <Text style={[styles.kicker, { color: colors.textTertiary }]}>{l}</Text>
              <Text style={[styles.money, { color: colors.text, fontSize: 17, marginTop: 3 }]}>{v}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="Лидеры" />
        <View style={{ marginBottom: spacing.sm }}>
          <Segmented
            options={[{ key: 'revenue', label: 'Выручка' }, { key: 'projects', label: 'Проекты' }, { key: 'leads', label: 'Лиды' }]}
            activeKey={metric}
            onChange={(k) => setMetric(k as any)}
          />
        </View>
        {rows.map((r, i) => (
          <TouchableOpacity
            key={r.companyId}
            style={{ paddingVertical: 7 }}
            onPress={() => navigation.navigate('Clients', { screen: 'CompanyDetail', params: { id: r.companyId } })}
            activeOpacity={0.7}
          >
            <View style={styles.row}>
              <Text style={[styles.num, { color: colors.textTertiary, width: 16 }]}>{i + 1}</Text>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text }} numberOfLines={1}>{r.companyName}</Text>
              <Text style={[styles.money, { color: colors.text, fontSize: 13 }]}>{metric === 'revenue' ? fmt(r.revenue, c.summary.currency, { short: true }) : r[metric]}</Text>
            </View>
            <View style={[styles.bar, { backgroundColor: colors.surfaceVariant, marginTop: 5 }]}>
              <View style={{ width: `${((r[metric] as number) / maxV) * 100}%`, backgroundColor: colors.accent, height: '100%', borderRadius: 999 }} />
            </View>
          </TouchableOpacity>
        ))}
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="Концентрация" />
        <Text style={[styles.money, { color: colors.text, fontSize: 28 }]}>{Math.round((top3 / total) * 100)}%</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>выручки дают топ-3 клиента</Text>
        <View style={[styles.bar, { backgroundColor: colors.surfaceVariant, marginTop: 12 }]}>
          <View style={{ width: `${(top3 / total) * 100}%`, backgroundColor: colors.accent, height: '100%', borderRadius: 999 }} />
        </View>
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="Закрыто и потенциал" />
        <FunnelBars
          rows={[
            { label: 'Закрыто', value: c.summary.totalRevenue, displayValue: fmt(c.summary.totalRevenue, c.summary.currency, { short: true }) },
            { label: 'Потенциал', value: c.summary.totalPotentialRevenue, displayValue: fmt(c.summary.totalPotentialRevenue, c.summary.currency, { short: true }) },
          ]}
        />
      </GlassCard>
    </>
  );
}

function RoiAnalyticsTab() {
  const { colors } = useTheme();
  const { fmt } = useCurrencyMode();
  const [r, setR] = useState<LeadsRoiStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadRoi().then(setR).catch(() => showToast('Не удалось загрузить ROI', { variant: 'error' })).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />;
  if (!r) return null;

  const byChannel = new Map<string, { revenue: number; deals: number }>();
  r.items.forEach((it) => {
    const key = it.channel || '—';
    const cur = byChannel.get(key) || { revenue: 0, deals: 0 };
    cur.revenue += it.totalRevenue;
    cur.deals += it.dealsCount;
    byChannel.set(key, cur);
  });
  const channelRows = Array.from(byChannel.entries()).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = Math.max(...channelRows.map((c) => c.revenue), 1);

  return (
    <>
      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <Text style={[styles.kicker, { color: colors.textTertiary }]}>ВЫРУЧКА ПО ЛИДАМ</Text>
        <Text style={[styles.money, { color: colors.text, fontSize: 30 }]}>{fmt(r.totalRevenue, r.currency, { short: true })}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{r.leadsWithRevenue} лидов с выручкой · {r.dealsCount} сделок · чек {fmt(r.avgCheck, r.currency)}</Text>
      </GlassCard>

      <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
        <CardHeader title="Выручка по каналам" />
        {channelRows.map((c) => (
          <View key={c.label} style={{ paddingVertical: 8 }}>
            <View style={styles.row}>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>{c.label}</Text>
              <Text style={[styles.money, { color: colors.text, fontSize: 13 }]}>{fmt(c.revenue, r.currency, { short: true })}</Text>
            </View>
            <View style={[styles.bar, { backgroundColor: colors.surfaceVariant, marginTop: 5 }]}>
              <View style={{ width: `${(c.revenue / maxRevenue) * 100}%`, backgroundColor: colors.accent, height: '100%', borderRadius: 999 }} />
            </View>
            <Text style={[styles.sub, { color: colors.textTertiary, marginTop: 3 }]}>{c.deals} сделок</Text>
          </View>
        ))}
        {channelRows.length === 0 && <Text style={{ color: colors.textSecondary, fontSize: 12.5, textAlign: 'center', padding: 12 }}>Нет данных за период</Text>}
      </GlassCard>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { marginBottom: spacing.sm },
  cardContent: { padding: spacing.lg },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  spacer: { flex: 1 },
  kicker: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8, textTransform: 'uppercase' },
  h2: { fontSize: 15, fontFamily: fonts.semibold },
  cardTitle: { fontSize: 15, fontFamily: fonts.semibold, marginBottom: spacing.sm },
  money: { fontFamily: fonts.semibold, letterSpacing: -0.4 },
  sub: { fontSize: 12.5, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  num: { fontSize: 11, fontFamily: fonts.mono },
  bar: { height: 5, borderRadius: 999, overflow: 'hidden' },
  splitBar: { height: 5, borderRadius: 999, overflow: 'hidden', flexDirection: 'row' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  summaryCell: { flexBasis: '30%', flexGrow: 1 },
});
