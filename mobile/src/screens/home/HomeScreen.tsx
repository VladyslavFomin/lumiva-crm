import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchLeadStats, fetchLeadAnalyticsRange, fetchLeads, Lead, LeadStats } from '../../api/leads';
import { fetchProjects, Project } from '../../api/projects';
import { fetchSales, Sale } from '../../api/sales';
import { fetchSalesAnalytics } from '../../api/sales';
import { fetchAllCompaniesAnalytics, fetchCompanies, Company } from '../../api/companies';
import { fetchGlobalAuditLog, GlobalAuditLogEntry } from '../../api/auditLog';
import { fetchCalendarEvents } from '../../api/calendar';
import { fetchProfile } from '../../api/profile';
import { fetchUnreadCount } from '../../api/notifications';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';
import { AuraBackground, GlassCard } from '../../components/glass';
import { MgHeader, CurrencyChip, ThemeChip, Pill, FunnelBars, Sparkline } from '../../components/mg';
import { showToast, AppBottomSheet, AppBottomSheetRef } from '../../components/ui';

const CREATE_OPTIONS: { label: string; icon: keyof typeof Ionicons.glyphMap; go: (nav: any) => void }[] = [
  { label: 'Лид', icon: 'podium-outline', go: (nav) => nav.navigate('Leads', { screen: 'LeadCreate' }) },
  { label: 'Проект', icon: 'folder-outline', go: (nav) => nav.navigate('Projects', { screen: 'ProjectCreate' }) },
  { label: 'Компания', icon: 'people-outline', go: (nav) => nav.navigate('Clients', { screen: 'CompanyCreate' }) },
  { label: 'Контакт', icon: 'person-outline', go: (nav) => nav.navigate('Clients', { screen: 'ContactCreate' }) },
];

type WidgetKey = 'pulse' | 'funnel' | 'tasks' | 'activity' | 'sources' | 'sales';
const DEFAULT_WIDGET_ORDER: WidgetKey[] = ['pulse', 'funnel', 'tasks', 'activity', 'sources', 'sales'];
const WIDGET_LABEL: Record<WidgetKey, string> = {
  pulse: 'Пульс', funnel: 'Воронка лидов', tasks: 'Открытые задачи', activity: 'Активность по лидам', sources: 'Источники за неделю', sales: 'Последние продажи',
};
const WIDGET_ORDER_STORAGE_KEY = 'home_widget_order';

const STATUS_LABEL: Record<string, string> = { new: 'Новые', in_progress: 'В работе', waiting: 'Ожидают', won: 'Выиграно', lost: 'Проиграно' };
const SALE_STATUS_LABEL: Record<string, string> = { new: 'Новая', pending: 'Ожидает', confirmed: 'Подтверждена', cancelled: 'Отменена', refunded: 'Возврат', other: 'Другое' };
const SALE_STATUS_TONE: Record<string, 'pos' | 'neg' | 'warn' | 'default'> = { new: 'default', pending: 'warn', confirmed: 'pos', cancelled: 'neg', refunded: 'neg', other: 'default' };

function statusColor(colors: ReturnType<typeof useTheme>['colors'], status: string): string {
  const map: Record<string, string> = { new: colors.info, in_progress: colors.textSecondary, waiting: colors.warning, won: colors.success, lost: colors.error };
  return map[status] || colors.textSecondary;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

interface HomeData {
  leadStats: LeadStats | null;
  weeklyStats: LeadStats | null;
  leads: Lead[];
  projects: Project[];
  sales: Sale[];
  monthAmount: number;
  monthCount: number;
  monthAvg: number;
  monthTimeline: number[];
  prevMonthAmount: number;
  conversionRate: number;
  potentialRevenue: number;
  activity: GlobalAuditLogEntry[];
  meetingsToday: number;
  unread: number;
  firstName: string;
}

export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const { fmt, toDisplay } = useCurrencyMode();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const createSheetRef = useRef<AppBottomSheetRef>(null);
  const searchSheetRef = useRef<AppBottomSheetRef>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>(DEFAULT_WIDGET_ORDER);
  const [editingOrder, setEditingOrder] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WIDGET_ORDER_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved: string[] = JSON.parse(raw);
        // Guard against a stale saved order from a previous app version (removed/renamed widget) —
        // fall back to the default rather than rendering a partial or broken list.
        if (saved.length === DEFAULT_WIDGET_ORDER.length && saved.every((k) => DEFAULT_WIDGET_ORDER.includes(k as WidgetKey))) {
          setWidgetOrder(saved as WidgetKey[]);
        }
      } catch {}
    });
  }, []);

  const moveWidget = (key: WidgetKey, direction: -1 | 1) => {
    setWidgetOrder((prev) => {
      const i = prev.indexOf(key);
      const j = i + direction;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      AsyncStorage.setItem(WIDGET_ORDER_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      const [leadStats, weeklyStats, leads, projects, sales, monthSales, prevMonthSales, companies, activityRes, events, profile, unread] = await Promise.all([
        fetchLeadStats().catch(() => null),
        fetchLeadAnalyticsRange(weekAgo, now.toISOString().slice(0, 10)).catch(() => null),
        fetchLeads().catch(() => [] as Lead[]),
        fetchProjects().catch(() => ({ total: 0, items: [] as Project[] })),
        fetchSales().catch(() => [] as Sale[]),
        fetchSalesAnalytics({ from: firstOfMonth }).catch(() => null),
        fetchSalesAnalytics({ from: firstOfPrevMonth, to: lastOfPrevMonth }).catch(() => null),
        fetchAllCompaniesAnalytics().catch(() => null),
        fetchGlobalAuditLog({ entityType: 'lead', limit: 6 }).catch(() => ({ items: [] as GlobalAuditLogEntry[], total: 0 })),
        fetchCalendarEvents(todayStart, todayEnd).catch(() => []),
        fetchProfile().catch(() => null),
        fetchUnreadCount().catch(() => 0),
      ]);

      const monthTimeline = (monthSales?.timeline.amount || []).map((row) =>
        Object.entries(row).filter(([k]) => k !== 'month').reduce((s, [, v]) => s + (v as number), 0),
      );

      setData({
        leadStats,
        weeklyStats,
        leads,
        projects: (projects as any)?.items || [],
        sales,
        monthAmount: monthSales?.totalAmount || 0,
        monthCount: monthSales?.totalCount || 0,
        monthAvg: monthSales?.avgCheck || 0,
        monthTimeline,
        prevMonthAmount: prevMonthSales?.totalAmount || 0,
        conversionRate: companies?.summary.avgConversionRate || 0,
        potentialRevenue: companies?.summary.totalPotentialRevenue || 0,
        activity: activityRes.items,
        meetingsToday: events.length,
        unread,
        firstName: (profile?.name || 'Пользователь').split(' ')[0],
      });
    } catch {
      showToast('Не удалось загрузить данные', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const funnelRows = useMemo(() => {
    if (!data) return [];
    return (data.leadStats?.byStatus || []).map((s) => {
      const sum = data.leads.filter((l) => l.status === s.status).reduce((a, l) => a + toDisplay(l.amount, l.currency), 0);
      return { label: STATUS_LABEL[s.status] || s.status, value: sum, displayValue: fmt(sum, undefined, { short: true }), color: statusColor(colors, s.status) };
    });
  }, [data, toDisplay, fmt, colors]);

  const myTasks = useMemo(() => {
    if (!data) return [];
    const out: { id: string; title: string; project: string; projectId: string; deadline: string | null; priority: string }[] = [];
    data.projects.forEach((p) => p.tasks.forEach((t) => {
      if (t.status !== 'Готово') out.push({ id: t.id, title: t.title, project: p.name, projectId: p.id, deadline: t.deadline, priority: t.priority });
    }));
    return out.slice(0, 5);
  }, [data]);

  const openSearch = () => {
    searchSheetRef.current?.snapToIndex(0);
    if (!companiesLoaded) {
      setCompaniesLoaded(true);
      fetchCompanies().then(setCompanies).catch(() => {});
    }
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchLeads = (data?.leads || []).filter((l) => !q || (l.name || '').toLowerCase().includes(q)).slice(0, 4);
    const matchProjects = (data?.projects || []).filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 3);
    const matchCompanies = companies.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 3);
    return { leads: matchLeads, projects: matchProjects, companies: matchCompanies };
  }, [searchQuery, data, companies]);

  if (loading || !data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <AuraBackground />
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  const monthDelta = data.prevMonthAmount > 0 ? Math.round(((data.monthAmount - data.prevMonthAmount) / data.prevMonthAmount) * 100) : null;
  const inWorkCount = (data.leadStats?.byStatus.find((s) => s.status === 'in_progress')?.count || 0) + (data.leadStats?.byStatus.find((s) => s.status === 'waiting')?.count || 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />
      <MgHeader
        title={greeting()}
        sub={`${data.firstName} · ${data.meetingsToday} встреч сегодня`}
        right={<>
          <CurrencyChip />
          <ThemeChip />
          <TouchableOpacity style={[styles.ib, { backgroundColor: colors.surfaceVariant }]} onPress={() => navigation.navigate('Account')} hitSlop={6}>
            <Ionicons name="notifications-outline" size={18} color={colors.text} />
            {data.unread > 0 && <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.background }]} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ib, { backgroundColor: colors.ink }]} onPress={() => createSheetRef.current?.snapToIndex(0)} hitSlop={6}>
            <Ionicons name="add" size={20} color={colors.onInk} />
          </TouchableOpacity>
        </>}
      >
        <TouchableOpacity onPress={openSearch} activeOpacity={0.8} style={{ marginTop: 10 }}>
          <GlassCard variant="flat" style={styles.searchCard} contentStyle={styles.searchCardContent}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 14, fontFamily: fonts.regular }}>Лиды, компании, проекты, продажи</Text>
          </GlassCard>
        </TouchableOpacity>
      </MgHeader>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
      >
        <GlassCard variant="g" style={styles.card} contentStyle={styles.heroContent}>
          <View style={styles.rowHead}>
            <Text style={[styles.kicker, { color: colors.textTertiary }]}>ПРОДАЖИ В ЭТОМ МЕСЯЦЕ</Text>
            <View style={{ flex: 1 }} />
            {monthDelta !== null && <Pill label={`${monthDelta >= 0 ? '+' : ''}${monthDelta}%`} tone={monthDelta >= 0 ? 'pos' : 'neg'} />}
          </View>
          <Text style={[styles.money, { color: colors.text, fontSize: 34 }]}>{fmt(data.monthAmount, undefined, { short: true })}</Text>
          {data.monthTimeline.length > 1 && <View style={{ marginTop: 12, marginHorizontal: -2 }}><Sparkline data={data.monthTimeline} height={60} /></View>}
          <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 8 }]}>{data.monthCount} заказов · средний чек {fmt(data.monthAvg, undefined, { short: true })}</Text>
        </GlassCard>

        <View style={styles.rowHead}>
          <Text style={[styles.kicker, { color: colors.textTertiary }]}>ВАША СВОДКА</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setEditingOrder((e) => !e)} activeOpacity={0.7}>
            <Text style={[styles.link, { color: colors.textSecondary }]}>{editingOrder ? 'Готово' : 'Изменить порядок'}</Text>
          </TouchableOpacity>
        </View>

        {widgetOrder.map((key) => {
          let content: React.ReactNode = null;
          if (key === 'pulse') {
            content = (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
                <View style={styles.rowHead}>
                  <Ionicons name="sparkles-outline" size={16} color={colors.text} />
                  <Text style={[styles.h2, { color: colors.text }]}>Пульс</Text>
                </View>
                <View style={styles.pulseGrid}>
                  <PulseCell label="Лидов всего" value={(data.leadStats?.total || 0).toLocaleString('ru-RU')} />
                  <PulseCell label="В работе" value={String(inWorkCount)} />
                  <PulseCell label="Конверсия лид→сделка" value={`${data.conversionRate.toFixed(1).replace('.', ',')}%`} />
                  <PulseCell label="Потенциал" value={fmt(data.potentialRevenue, undefined, { short: true })} />
                </View>
              </GlassCard>
            );
          } else if (key === 'funnel') {
            content = (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
                <View style={styles.rowHead}>
                  <Ionicons name="git-branch-outline" size={16} color={colors.text} />
                  <Text style={[styles.h2, { color: colors.text }]}>Воронка лидов</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => navigation.navigate('Leads')}><Text style={[styles.link, { color: colors.accent }]}>Канбан →</Text></TouchableOpacity>
                </View>
                <FunnelBars rows={funnelRows} />
              </GlassCard>
            );
          } else if (key === 'tasks' && myTasks.length > 0) {
            content = (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
                <View style={styles.rowHead}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.text} />
                  <Text style={[styles.h2, { color: colors.text }]}>Открытые задачи</Text>
                  <View style={{ flex: 1 }} />
                  <Pill label={String(myTasks.length)} />
                </View>
                {myTasks.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.taskRow, { borderTopColor: colors.line3 }]}
                    onPress={() => navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id: t.projectId } })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13.5, color: colors.text }} numberOfLines={1}>{t.title}</Text>
                      <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>{t.deadline || '—'} · {t.project}</Text>
                    </View>
                    {t.priority !== 'Обычный' && <Pill label={t.priority} tone={t.priority === 'Высокий' ? 'neg' : 'default'} />}
                  </TouchableOpacity>
                ))}
              </GlassCard>
            );
          } else if (key === 'activity' && data.activity.length > 0) {
            content = (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.listCardContent}>
                <Text style={[styles.h2, { color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>Активность по лидам</Text>
                {data.activity.map((a, i) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.activityRow, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
                    onPress={() => navigation.navigate('Leads', { screen: 'LeadDetail', params: { id: a.entityId } })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12.5, color: colors.text }} numberOfLines={1}><Text style={{ fontFamily: fonts.semibold }}>{a.entityLabel || 'Лид'}</Text> · {a.summary || a.action}</Text>
                      <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 2 }]}>{a.actorName || 'Система'}</Text>
                    </View>
                    <Text style={[styles.sub, { color: colors.textTertiary }]}>{relTime(a.createdAt)}</Text>
                  </TouchableOpacity>
                ))}
              </GlassCard>
            );
          } else if (key === 'sources' && data.weeklyStats && data.weeklyStats.bySource.length > 0) {
            content = (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.cardContent}>
                <View style={styles.rowHead}>
                  <Ionicons name="trending-up-outline" size={16} color={colors.text} />
                  <Text style={[styles.h2, { color: colors.text }]}>Источники за неделю</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[styles.kicker, { color: colors.textTertiary }]}>{data.weeklyStats.total} ЛИДОВ</Text>
                </View>
                <FunnelBars rows={data.weeklyStats.bySource.map((s) => ({ label: s.source, value: s.count, displayValue: String(s.count) }))} />
              </GlassCard>
            );
          } else if (key === 'sales' && data.sales.length > 0) {
            content = (
              <GlassCard variant="g" style={styles.card} contentStyle={styles.listCardContent}>
                <Text style={[styles.h2, { color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>Последние продажи</Text>
                {data.sales.slice(0, 4).map((s, i) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.activityRow, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
                    onPress={() => navigation.navigate('Sales', { screen: 'SaleDetail', params: { id: s.id } })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13, color: colors.text, fontFamily: fonts.medium }} numberOfLines={1}>{s.guestName || s.hotel || s.market || `№${s.externalOrderNo || s.id.slice(0, 6)}`}</Text>
                      <Pill label={SALE_STATUS_LABEL[s.status] || s.status} tone={SALE_STATUS_TONE[s.status] || 'default'} />
                    </View>
                    <Text style={[styles.money, { color: colors.text, fontSize: 13 }]}>{fmt(s.amount, s.currency, { short: true })}</Text>
                  </TouchableOpacity>
                ))}
              </GlassCard>
            );
          }

          if (!content) return null;
          return (
            <View key={key}>
              {editingOrder && (
                <View style={styles.reorderRow}>
                  <Text style={[styles.reorderLabel, { color: colors.textSecondary }]}>{WIDGET_LABEL[key]}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <TouchableOpacity style={[styles.reorderBtn, { backgroundColor: colors.card }]} onPress={() => moveWidget(key, -1)} hitSlop={6}>
                      <Ionicons name="chevron-up" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.reorderBtn, { backgroundColor: colors.card }]} onPress={() => moveWidget(key, 1)} hitSlop={6}>
                      <Ionicons name="chevron-down" size={16} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {content}
            </View>
          );
        })}

        <TouchableOpacity onPress={() => navigation.navigate('More')} style={styles.moreBtn} activeOpacity={0.8}>
          <Text style={[styles.link, { color: colors.textSecondary }]}>Все разделы</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      </ScrollView>

      <AppBottomSheet ref={createSheetRef} snapPoints={['38%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Создать</Text>
        <View style={styles.createGrid}>
          {CREATE_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.label}
              style={[styles.createTile, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}
              activeOpacity={0.7}
              onPress={() => { createSheetRef.current?.close(); o.go(navigation); }}
            >
              <Ionicons name={o.icon} size={19} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13.5, fontFamily: fonts.medium, marginTop: 8 }}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 10 }]}>Продажи и брони создаются из своих разделов, настройка модулей — на ПК.</Text>
      </AppBottomSheet>

      <AppBottomSheet ref={searchSheetRef} snapPoints={['70%', '92%']}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Поиск</Text>
        <GlassCard variant="flat" style={styles.searchInputCard} contentStyle={styles.searchCardContent}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            autoFocus
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Лиды, проекты, компании"
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
          />
        </GlassCard>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {searchResults.leads.length > 0 && (
            <>
              <Text style={[styles.searchGroupLabel, { color: colors.textTertiary }]}>ЛИДЫ</Text>
              <GlassCard variant="g2" style={styles.listCard}>
                {searchResults.leads.map((l, i) => (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.searchRow, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
                    activeOpacity={0.7}
                    onPress={() => { searchSheetRef.current?.close(); navigation.navigate('Leads', { screen: 'LeadDetail', params: { id: l.id } }); }}
                  >
                    <Text style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 13.5, fontFamily: fonts.regular }} numberOfLines={1}>{l.name || 'Без имени'}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{STATUS_LABEL[l.status] || l.status}</Text>
                  </TouchableOpacity>
                ))}
              </GlassCard>
            </>
          )}

          {searchResults.projects.length > 0 && (
            <>
              <Text style={[styles.searchGroupLabel, { color: colors.textTertiary }]}>ПРОЕКТЫ</Text>
              <GlassCard variant="g2" style={styles.listCard}>
                {searchResults.projects.map((p, i) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.searchRow, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
                    activeOpacity={0.7}
                    onPress={() => { searchSheetRef.current?.close(); navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id: p.id } }); }}
                  >
                    <Text style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 13.5, fontFamily: fonts.regular }} numberOfLines={1}>{p.name}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{p.status}</Text>
                  </TouchableOpacity>
                ))}
              </GlassCard>
            </>
          )}

          {searchResults.companies.length > 0 && (
            <>
              <Text style={[styles.searchGroupLabel, { color: colors.textTertiary }]}>КОМПАНИИ</Text>
              <GlassCard variant="g2" style={styles.listCard}>
                {searchResults.companies.map((c, i) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.searchRow, { borderTopColor: colors.line3, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}
                    activeOpacity={0.7}
                    onPress={() => { searchSheetRef.current?.close(); navigation.navigate('Clients', { screen: 'CompanyDetail', params: { id: c.id } }); }}
                  >
                    <Text style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 13.5, fontFamily: fonts.regular }} numberOfLines={1}>{c.name}</Text>
                    {!!c.industry && <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>{c.industry}</Text>}
                  </TouchableOpacity>
                ))}
              </GlassCard>
            </>
          )}

          {searchResults.leads.length === 0 && searchResults.projects.length === 0 && searchResults.companies.length === 0 && (
            <Text style={[styles.sub, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl }]}>
              {searchQuery.trim() ? 'Ничего не найдено' : 'Начните вводить запрос'}
            </Text>
          )}
        </ScrollView>
      </AppBottomSheet>
    </View>
  );
};

function PulseCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.pulseCell}>
      <Text style={[styles.kicker, { color: colors.textTertiary }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.money, { color: colors.text, fontSize: 21, marginTop: 3 }]}>{value}</Text>
    </View>
  );
}

function relTime(dateStr: string): string {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'сейчас';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  ib: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  dot: { position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  searchCard: { borderRadius: 999 },
  searchCardContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  card: { marginBottom: spacing.sm },
  heroContent: { padding: 18 },
  cardContent: { padding: spacing.lg },
  listCardContent: { paddingBottom: spacing.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  kicker: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8 },
  h2: { fontSize: 15, fontFamily: fonts.semibold },
  money: { fontFamily: fonts.semibold, letterSpacing: -0.4 },
  sub: { fontSize: 12, fontFamily: fonts.regular },
  link: { fontSize: 13, fontFamily: fonts.semibold },
  pulseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pulseCell: { flexBasis: '45%', flexGrow: 1 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.md },
  sheetTitle: { fontSize: 17, fontFamily: fonts.semibold, letterSpacing: -0.3 },
  createGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: spacing.md },
  createTile: { flexBasis: '47%', flexGrow: 1, paddingVertical: 15, paddingHorizontal: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
  searchInputCard: { borderRadius: 999, marginTop: spacing.md, marginBottom: spacing.md },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },
  searchGroupLabel: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.8, paddingBottom: 6, paddingTop: 4 },
  listCard: { marginBottom: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 11 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  reorderLabel: { flex: 1, fontSize: 12, fontFamily: fonts.medium },
  reorderBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
