import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchProjects, Project, ProjectStatus, ProjectTask } from '../../api/projects';
import { formatMoney } from '../../utils/money';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonCard, showToast } from '../../components/ui';
import { Segmented, StatGrid2, FunnelBars, Sparkline } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { appLocale } from '../../i18n/format';

const STATUS_ORDER: ProjectStatus[] = ['Новый', 'В работе', 'На проверке', 'Заморожен', 'Закрыт'];
const TASK_STATUS_ORDER = ['К выполнению', 'В работе', 'На проверке', 'Заблокировано', 'Отложено'] as const;
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

type Tab = 'sum' | 'struct' | 'team' | 'tasks';

export const ProjectsAnalyticsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { fmt, toDisplay } = useCurrencyMode();
  const [tab, setTab] = useState<Tab>('sum');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects()
      .then((r) => setProjects(r.items))
      .catch(() => showToast('Не удалось загрузить аналитику', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const total = projects.length;
  const closed = useMemo(() => projects.filter((p) => p.status === 'Закрыт'), [projects]);
  const active = useMemo(() => projects.filter((p) => p.status !== 'Закрыт'), [projects]);
  const revenue = useMemo(() => closed.reduce((s, p) => s + toDisplay(p.amount || 0, p.currency), 0), [closed, toDisplay]);
  const potential = useMemo(() => active.reduce((s, p) => s + toDisplay(p.amount || 0, p.currency), 0), [active, toDisplay]);

  const timeline = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_SHORT[d.getMonth()], amount: 0 });
    }
    const byKey: Record<string, number> = {};
    buckets.forEach((b) => { byKey[b.key] = 0; });
    projects.forEach((p) => {
      const d = new Date(p.createdAt);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (k in byKey) byKey[k] += toDisplay(p.amount || 0, p.currency);
    });
    return buckets.map((b) => ({ ...b, amount: byKey[b.key] }));
  }, [projects, toDisplay]);

  const currencyBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    projects.forEach((p) => { if (p.amount) m[p.currency] = (m[p.currency] || 0) + p.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [projects]);

  const palette: Record<string, string> = { 'Новый': colors.info, 'В работе': colors.warning, 'На проверке': colors.fg3, 'Заморожен': colors.error, 'Закрыт': colors.success };

  const statusBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    projects.forEach((p) => { m[p.status] = (m[p.status] || 0) + 1; });
    return STATUS_ORDER.filter((s) => m[s] > 0).map((s) => ({ label: s, value: m[s], displayValue: String(m[s]), color: palette[s] }));
  }, [projects, colors]);

  const categoryBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    projects.forEach((p) => {
      const cat = p.category || 'Без категории';
      m[cat] = (m[cat] || 0) + toDisplay(p.amount || 0, p.currency);
    });
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, amount]) => ({ label: name, value: amount, displayValue: fmt(amount, undefined, { short: true }) }));
  }, [projects, toDisplay, fmt]);

  const managerBreakdown = useMemo(() => {
    const m: Record<string, { amount: number; active: number; closed: number }> = {};
    projects.forEach((p) => {
      const name = p.owner || 'Без ответственного';
      const cur = m[name] || { amount: 0, active: 0, closed: 0 };
      cur.amount += toDisplay(p.amount || 0, p.currency);
      if (p.status === 'Закрыт') cur.closed += 1; else cur.active += 1;
      m[name] = cur;
    });
    return Object.entries(m).sort((a, b) => b[1].amount - a[1].amount);
  }, [projects, toDisplay]);

  const allTasks = useMemo(() => {
    const out: (ProjectTask & { projectName: string })[] = [];
    projects.forEach((p) => p.tasks.forEach((t) => out.push({ ...t, projectName: p.name })));
    return out;
  }, [projects]);
  const openTasks = useMemo(() => allTasks.filter((t) => t.status !== 'Готово'), [allTasks]);
  const doneTasks = useMemo(() => allTasks.filter((t) => t.status === 'Готово'), [allTasks]);
  const overdueTasks = useMemo(() => {
    const today = new Date();
    return openTasks
      .filter((t) => t.deadline && new Date(t.deadline) < today)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  }, [openTasks]);
  const taskStatusBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    openTasks.forEach((t) => { m[t.status] = (m[t.status] || 0) + 1; });
    return TASK_STATUS_ORDER.filter((s) => m[s] > 0).map((s) => ({ label: s, value: m[s], displayValue: String(m[s]) }));
  }, [openTasks]);

  const daysOverdue = (deadline: string) => Math.max(1, Math.round((Date.now() - new Date(deadline).getTime()) / 86400000));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Проекты</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.largeTitle, { color: colors.text }]}>Аналитика проектов</Text>

      <View style={styles.segWrap}>
        <Segmented
          options={[
            { key: 'sum', label: 'Сводка' },
            { key: 'struct', label: 'Структура' },
            { key: 'team', label: 'Команда' },
            { key: 'tasks', label: 'Задачи' },
          ]}
          activeKey={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </View>

      {loading ? (
        <View style={{ padding: spacing.lg, flexDirection: 'row', gap: spacing.md }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {tab === 'sum' && (
            <>
              <GlassCard variant="g" style={styles.widget}>
                <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ВЫРУЧКА ПО ЗАКРЫТЫМ ПРОЕКТАМ</Text>
                <Text style={[styles.heroValue, { color: colors.text }]}>{fmt(revenue, undefined, { short: true })}</Text>
                <View style={{ marginTop: spacing.sm, marginHorizontal: -2 }}>
                  <Sparkline data={timeline.map((t) => t.amount)} height={70} />
                </View>
                <View style={styles.monthRow}>
                  {timeline.filter((_, i) => i % 3 === 0).map((t) => (
                    <Text key={t.key} style={[styles.monthLabel, { color: colors.textTertiary }]}>{t.label}</Text>
                  ))}
                </View>
              </GlassCard>

              <StatGrid2
                items={[
                  { label: 'В работе', value: String(active.length) },
                  { label: 'Закрыто', value: String(closed.length) },
                  { label: 'Проектов всего', value: String(total) },
                  { label: 'Потенциал', value: fmt(potential, undefined, { short: true }) },
                ]}
              />

              {(revenue > 0 || potential > 0) && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ЗАКРЫТО И ПОТЕНЦИАЛ</Text>
                  <FunnelBars rows={[
                    { label: 'Закрыто', value: revenue, displayValue: fmt(revenue, undefined, { short: true }) },
                    { label: 'В работе', value: potential, displayValue: fmt(potential, undefined, { short: true }) },
                  ]} />
                </GlassCard>
              )}

              {overdueTasks.length > 0 && (
                <GlassCard variant="g" style={styles.widget}>
                  <View style={styles.widgetHeadRow}>
                    <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПРОСРОЧЕННЫЕ ЗАДАЧИ</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.badge, { color: colors.error, backgroundColor: colors.errorBg }]}>{overdueTasks.length}</Text>
                  </View>
                  {overdueTasks.slice(0, 8).map((t, i) => (
                    <View key={t.id} style={[styles.taskRow, { borderTopColor: colors.line3, borderTopWidth: i ? 1 : 0 }]}>
                      <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>{t.title}</Text>
                      <Text style={[styles.taskMeta, { color: colors.textTertiary }]} numberOfLines={1}>{t.projectName} · срок {new Date(t.deadline!).toLocaleDateString(appLocale())}</Text>
                      <Text style={[styles.overdueBadge, { color: colors.error }]}>+{daysOverdue(t.deadline!)} дн</Text>
                    </View>
                  ))}
                </GlassCard>
              )}
            </>
          )}

          {tab === 'struct' && (
            <>
              {statusBreakdown.length > 0 && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО СТАТУСАМ</Text>
                  <FunnelBars rows={statusBreakdown} />
                </GlassCard>
              )}
              {categoryBreakdown.length > 0 && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО КАТЕГОРИЯМ</Text>
                  <FunnelBars rows={categoryBreakdown} />
                </GlassCard>
              )}
              {closed.length > 0 && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>СРЕДНИЙ ЧЕК ПРОЕКТА</Text>
                  <Text style={[styles.heroValue, { color: colors.text, fontSize: 26 }]}>{fmt(revenue / closed.length)}</Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>{closed.length} закрытых проектов</Text>
                </GlassCard>
              )}
              {currencyBreakdown.length > 1 && (
                <GlassCard variant="g" style={styles.widget}>
                  <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО ВАЛЮТАМ</Text>
                  {currencyBreakdown.map(([code, amount], i) => (
                    <View key={code} style={[styles.srcRow, { borderBottomColor: colors.line3, borderBottomWidth: i < currencyBreakdown.length - 1 ? 1 : 0 }]}>
                      <Text style={[styles.srcName, { color: colors.text, fontFamily: fonts.medium, width: 56 }]}>{code}</Text>
                      <Text style={{ flex: 1, fontSize: 14, color: colors.text, fontFamily: fonts.monoSemibold, textAlign: 'right' }}>{formatMoney(amount, code)}</Text>
                    </View>
                  ))}
                </GlassCard>
              )}
            </>
          )}

          {tab === 'team' && (
            <GlassCard variant="g" style={styles.widget}>
              <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>МЕНЕДЖЕРЫ ПРОЕКТОВ</Text>
              {managerBreakdown.length === 0 ? (
                <Text style={[styles.sub, { color: colors.textSecondary }]}>Нет данных об ответственных</Text>
              ) : (
                managerBreakdown.map(([name, m], i) => (
                  <View key={name} style={[styles.srcRow, { borderBottomColor: colors.line3, borderBottomWidth: i < managerBreakdown.length - 1 ? 1 : 0, flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text style={{ flex: 1, fontSize: 13, color: colors.text, fontFamily: fonts.medium }} numberOfLines={1}>{name}</Text>
                      <Text style={{ fontSize: 13, color: colors.text, fontFamily: fonts.monoSemibold }}>{fmt(m.amount, undefined, { short: true })}</Text>
                    </View>
                    <Text style={[styles.taskMeta, { color: colors.textTertiary, marginTop: 3 }]}>в работе {m.active} · закрыто {m.closed}</Text>
                  </View>
                ))
              )}
            </GlassCard>
          )}

          {tab === 'tasks' && (
            <>
              <GlassCard variant="g" style={styles.widget}>
                <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ЗАДАЧИ В РАБОТЕ</Text>
                <Text style={[styles.heroValue, { color: colors.text }]}>{openTasks.length}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>выполнено {doneTasks.length} · просрочено {overdueTasks.length}</Text>
                {taskStatusBreakdown.length > 0 && (
                  <View style={{ marginTop: spacing.md }}>
                    <FunnelBars rows={taskStatusBreakdown} />
                  </View>
                )}
              </GlassCard>
              <StatGrid2
                items={[
                  { label: 'Готово', value: String(doneTasks.length) },
                  { label: 'Просрочено', value: String(overdueTasks.length) },
                  { label: 'Всего задач', value: String(allTasks.length) },
                  { label: 'В работе', value: String(openTasks.length) },
                ]}
              />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  largeTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 4 },
  segWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  widget: { borderRadius: radius.xxl, marginBottom: spacing.sm, padding: spacing.lg },
  widgetOverline: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  widgetHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, marginTop: -spacing.sm },
  badge: { fontSize: 11, fontFamily: fonts.semibold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  heroValue: { fontSize: 30, fontFamily: fonts.semibold, letterSpacing: -0.5 },
  sub: { fontSize: 12.5, marginTop: 4 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  monthLabel: { fontSize: 10, fontFamily: fonts.mono },
  taskRow: { paddingVertical: 8 },
  taskTitle: { fontSize: 13.5, fontFamily: fonts.medium },
  taskMeta: { fontSize: 11.5, marginTop: 2 },
  overdueBadge: { fontSize: 11, fontFamily: fonts.semibold, marginTop: 4 },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  srcName: { fontSize: 13 },
});
