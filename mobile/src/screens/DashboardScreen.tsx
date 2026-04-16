import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchLeadStats, fetchLeads, LeadStats, Lead } from '../api/leads';
import { fetchProjects, Project } from '../api/projects';
import { fetchSales } from '../api/sales';
import { useTheme } from '../theme/ThemeContext';
import { LineChart, BarChart, PieChart, StatCard } from '../components/Charts';

export const DashboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesSum, setSalesSum] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<any>();

  const statusMap = useMemo(() => {
    const map: Record<string, number> = {};
    (leadStats?.byStatus || []).forEach((s) => {
      map[(s.status || '').toLowerCase()] = s.count;
    });
    return map;
  }, [leadStats]);

  const load = async () => {
    setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const [ls, pr, sa, lsAll] = await Promise.all([
        fetchLeadStats(),
        fetchProjects(),
        fetchSales(),
        fetchLeads(),
      ]);
      setLeadStats(ls);
      setProjectsTotal(pr?.total || 0);
      setSalesTotal(sa.length);
      setSalesSum(sa.reduce((sum, s) => sum + (s.amount || 0), 0));
      setLeads(lsAll.slice(0, 12));
      setProjects(pr?.items || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const latestChannels = (leadStats?.bySource || []).slice(0, 6);
  const managers = (leadStats?.byManager || []).slice(0, 4);

  const leadsToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return leads.filter((l) => {
      const d = new Date(l.createdAt);
      return d >= today;
    }).length;
  }, [leads]);

  const conversion = useMemo(() => {
    const total = leadStats?.total || 0;
    const won = statusMap['won'] || 0;
    return total ? Math.round((won / total) * 100) : 0;
  }, [leadStats, statusMap]);

  const leadTimeline = useMemo(() => {
    const days = 14;
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    const buckets: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    leads.forEach((l) => {
      const key = l.createdAt.slice(0, 10);
      if (buckets[key] !== undefined) buckets[key] += 1;
    });
    const values = Object.values(buckets);
    const labels = Object.keys(buckets).map((d) => d.slice(5).replace('-', '.'));
    return { values, labels };
  }, [leads]);

  const channelData = useMemo(() => {
    return latestChannels.map((c) => ({
      label: c.source || '—',
      value: c.count,
      color: colors.primary,
    }));
  }, [latestChannels, colors.primary]);

  const statusPieData = useMemo(() => {
    const statusColors: Record<string, string> = {
      new: colors.info,
      in_progress: colors.warning,
      waiting: colors.secondary,
      won: colors.success,
      lost: colors.error,
    };
    return (leadStats?.byStatus || [])
      .filter((s) => s.count > 0)
      .map((s) => ({
        label: statusLabel(s.status || ''),
        value: s.count,
        color: statusColors[s.status?.toLowerCase() || ''] || colors.primary,
      }));
  }, [leadStats, colors]);

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={[styles.heroOverline, { color: colors.textSecondary }]}>LUMIVA · CRM</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Обзор платформы</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Дашборд по всем лидам, проектам и продажам
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.primary }]}
            onPress={load}
            disabled={loading}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={[styles.errorCard, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatCard
          title="Лиды сегодня"
          value={leadsToday}
          subtitle={`Всего: ${leadStats?.total || 0}`}
          icon="📊"
          color={colors.primary}
        />
        <StatCard
          title="Конверсия"
          value={`${conversion}%`}
          subtitle={`Выиграно: ${statusMap['won'] || 0}`}
          icon="🎯"
          color={colors.success}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Выручка"
          value={`${salesSum.toLocaleString()} €`}
          subtitle={`Сделок: ${salesTotal}`}
          icon="💰"
          color={colors.warning}
        />
        <StatCard
          title="Проекты"
          value={projectsTotal}
          subtitle="Активных проектов"
          icon="🚀"
          color={colors.secondary}
        />
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Динамика лидов</Text>
            <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>За последние 14 дней</Text>
          </View>
        </View>
        {leadTimeline.values.length > 0 ? (
          <LineChart
            data={leadTimeline.values}
            labels={leadTimeline.labels}
            color={colors.primary}
            showGrid
            showArea
          />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={[styles.emptyChartText, { color: colors.textSecondary }]}>Нет данных</Text>
          </View>
        )}
      </View>

      <View style={styles.chartsRow}>
        <View style={[styles.chartCard, styles.chartCardHalf, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>Лиды по каналам</Text>
          {channelData.length > 0 ? (
            <BarChart data={channelData} />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={[styles.emptyChartText, { color: colors.textSecondary }]}>Нет данных</Text>
            </View>
          )}
        </View>

        <View style={[styles.chartCard, styles.chartCardHalf, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>По статусам</Text>
          {statusPieData.length > 0 ? (
            <PieChart data={statusPieData} size={180} />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={[styles.emptyChartText, { color: colors.textSecondary }]}>Нет данных</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Последние лиды</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Leads')}>
            <Text style={[styles.sectionAction, { color: colors.primary }]}>Все лиды →</Text>
          </TouchableOpacity>
        </View>
        {leads.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Нет лидов</Text>
          </View>
        ) : (
          leads.slice(0, 5).map((l) => (
            <TouchableOpacity
              key={l.id}
              style={[styles.leadItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => navigation.navigate('Leads', { screen: 'LeadDetail', params: { id: l.id } })}
              activeOpacity={0.7}
            >
              <View style={styles.leadItemLeft}>
                <View style={[styles.leadAvatar, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.leadAvatarText, { color: colors.primary }]}>
                    {(l.name || 'L')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.leadItemInfo}>
                  <Text style={[styles.leadName, { color: colors.text }]} numberOfLines={1}>
                    {l.name || 'Без имени'}
                  </Text>
                  <Text style={[styles.leadMeta, { color: colors.textSecondary }]}>
                    {l.channel || '—'} · {statusLabel(l.status)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.leadDate, { color: colors.textTertiary }]}>
                {new Date(l.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const statusLabel = (code: string) => {
  const map: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    waiting: 'Ожидает',
    won: 'Выигран',
    lost: 'Проигран',
  };
  return map[code?.toLowerCase()] || code || '—';
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroOverline: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  chartCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  chartCardHalf: {
    flex: 1,
    minWidth: '48%',
  },
  chartsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 13,
  },
  emptyChart: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 14,
  },
  sectionCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  leadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  leadItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  leadAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  leadAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  leadItemInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  leadMeta: {
    fontSize: 13,
  },
  leadDate: {
    fontSize: 12,
  },
});
