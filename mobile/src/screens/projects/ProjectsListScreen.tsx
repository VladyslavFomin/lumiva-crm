import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, TextInput, StatusBar, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProjects, Project, ProjectStatus } from '../../api/projects';
import type { ProjectsStackParamList } from './ProjectsStack';
import { useCurrencyMode } from '../../context/CurrencyModeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { CurrencyChip, StatGrid2, Pill } from '../../components/mg';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { ToolbarButton, SkeletonList, EmptyState, AvatarInitials, showToast } from '../../components/ui';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectsList'>;

// Real tenant-configurable status values from the backend (see ProjectSettingsScreen) — not UI
// chrome, so these are intentionally left in their stored language, same as elsewhere in the app.
const STATUS_ORDER: ProjectStatus[] = ['Новый', 'В работе', 'На проверке', 'Заморожен', 'Закрыт'];
const STATUS_TONE: Record<ProjectStatus, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  'Новый': 'acc', 'В работе': 'warn', 'На проверке': 'default', 'Заморожен': 'neg', 'Закрыт': 'pos',
};

function relTime(dateStr: string, t: (key: string) => string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days < 1) return t('projectsList.time.today');
  if (days === 1) return t('projectsList.time.yesterday');
  if (days < 30) return `${days} ${t('projectsList.time.daysAgo')}`;
  return `${Math.floor(days / 30)} ${t('projectsList.time.monthsAgo')}`;
}

export const ProjectsListScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { fmt, toDisplay } = useCurrencyMode();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const { items } = await fetchProjects();
      setProjects(items);
    } catch {
      showToast(t('projectsList.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let res = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((p) => p.name.toLowerCase().includes(q) || (p.owner || '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') res = res.filter((p) => p.status === statusFilter);
    return res;
  }, [projects, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    projects.forEach((p) => (m[p.status] = (m[p.status] || 0) + 1));
    return m;
  }, [projects]);

  const totalAmount = useMemo(() => filtered.reduce((s, p) => s + toDisplay(p.amount, p.currency), 0), [filtered, toDisplay]);
  const openTasksCount = useMemo(() => filtered.reduce((s, p) => s + p.tasks.filter((t) => t.status !== 'Готово').length, 0), [filtered]);
  const closedAmount = useMemo(() => projects.filter((p) => p.status === 'Закрыт').reduce((s, p) => s + toDisplay(p.amount, p.currency), 0), [projects, toDisplay]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{t('tabs.projects')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{filtered.length} {t('projectsList.subtitle')} · {openTasksCount} {t('projectsList.openTasks')}</Text>
          </View>
          <CurrencyChip />
          <ToolbarButton icon="checkbox-outline" onPress={() => navigation.navigate('AllTasks')} />
          <ToolbarButton icon="stats-chart-outline" onPress={() => navigation.navigate('ProjectsAnalytics')} />
          <ToolbarButton icon="settings-outline" onPress={() => navigation.navigate('ProjectSettings')} />
          <ToolbarButton icon="add" active onPress={() => navigation.navigate('ProjectCreate')} />
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceVariant }]}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            placeholder={t('projectsList.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <TouchableOpacity style={[styles.chip, { backgroundColor: statusFilter === 'all' ? colors.ink : colors.surfaceVariant }]} onPress={() => setStatusFilter('all')}>
            <Text style={[styles.chipTxt, { color: statusFilter === 'all' ? colors.onInk : colors.text }]}>{t('projectsList.all')}</Text>
            <Text style={[styles.chipCount, { color: statusFilter === 'all' ? colors.onInk : colors.textTertiary }]}>{projects.length}</Text>
          </TouchableOpacity>
          {STATUS_ORDER.map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: statusFilter === s ? colors.ink : colors.surfaceVariant }]} onPress={() => setStatusFilter(s)}>
              <View style={[styles.chipDot, { backgroundColor: statusFilter === s ? colors.onInk : toneColor(colors, STATUS_TONE[s]) }]} />
              <Text style={[styles.chipTxt, { color: statusFilter === s ? colors.onInk : colors.text }]}>{s}</Text>
              <Text style={[styles.chipCount, { color: statusFilter === s ? colors.onInk : colors.textTertiary }]}>{statusCounts[s] || 0}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          lottieSource={require('../../../assets/lottie/empty-pulse.json')}
          title={t('projectsList.empty.title')}
          subtitle={search || statusFilter !== 'all' ? t('projectsList.empty.subtitleFiltered') : t('projectsList.empty.subtitleDefault')}
        />
      ) : (
        <Animated.FlatList
          data={filtered}
          keyExtractor={(item: Project) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <StatGrid2 items={[
              { label: t('projectsList.stat.amount'), value: fmt(totalAmount, undefined, { short: true }) },
              { label: t('projectsList.stat.closed'), value: fmt(closedAmount, undefined, { short: true }) },
            ]} />
          }
          renderItem={({ item: p }: { item: Project }) => {
            const doneCount = p.tasks.filter((t) => t.status === 'Готово').length;
            const progress = p.tasks.length ? Math.round((doneCount / p.tasks.length) * 100) : 0;
            return (
            <GlassCard variant="flat" style={styles.card} contentStyle={styles.cardContent}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProjectDetail', { id: p.id })}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <AvatarInitials name={p.owner || p.name} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
                  <Text style={[styles.cardOwner, { color: colors.textSecondary }]} numberOfLines={1}>{p.owner || t('common.unassigned')}</Text>
                </View>
                <Pill label={p.status} tone={STATUS_TONE[p.status]} />
              </View>

              {p.tasks.length > 0 && (
                <View style={styles.progressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
                    <View style={{ width: `${progress}%`, backgroundColor: toneColor(colors, STATUS_TONE[p.status]), height: '100%', borderRadius: 999 }} />
                  </View>
                  <Text style={[styles.cardMeta, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{doneCount}/{p.tasks.length}</Text>
                </View>
              )}

              {p.tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {p.tags.slice(0, 3).map((t) => (
                    <View key={t} style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}>
                      <Text style={[styles.tagTxt, { color: colors.textSecondary }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.cardBottom}>
                <Text style={[styles.cardMeta, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{relTime(p.createdAt, t)}</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.cardAmount, { color: colors.text, fontFamily: fonts.monoSemibold }]}>{fmt(p.amount, p.currency, { short: true })}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
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

function toneColor(colors: ReturnType<typeof useTheme>['colors'], tone: 'acc' | 'default' | 'warn' | 'pos' | 'neg'): string {
  const map = { acc: colors.accent, default: colors.textSecondary, warn: colors.warning, pos: colors.success, neg: colors.error };
  return map[tone];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.lg, marginTop: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipTxt: { fontSize: 12.5, fontFamily: fonts.medium },
  chipCount: { fontSize: 10.5, fontFamily: fonts.mono },

  card: { borderRadius: radius.xxl },
  cardContent: { padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardName: { fontSize: 14.5, fontFamily: fonts.semibold, lineHeight: 20 },
  cardOwner: { fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressTrack: { flex: 1, height: 5, borderRadius: 999, overflow: 'hidden' },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  tagTxt: { fontSize: 10.5, fontFamily: fonts.medium },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardMeta: { fontSize: 11 },
  cardAmount: { fontSize: 13 },
});
