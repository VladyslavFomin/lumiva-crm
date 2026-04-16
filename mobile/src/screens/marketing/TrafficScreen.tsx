import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchTraffic, TrafficData } from '../../api/marketing';
import { LineChart, StatCard } from '../../components/Charts';

export const TrafficScreen: React.FC = () => {
  const { colors } = useTheme();
  const [traffic, setTraffic] = useState<TrafficData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await fetchTraffic();
      setTraffic(data);
    } catch (error) {
      console.error('Failed to load traffic:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const chartData = useMemo(() => {
    const sorted = [...traffic].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const values = sorted.map((t) => t.visitors);
    const labels = sorted.map((t) => {
      const date = new Date(t.date);
      return `${date.getDate()}.${date.getMonth() + 1}`;
    });
    return { values, labels };
  }, [traffic]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const totalVisitors = traffic.reduce((sum, t) => sum + t.visitors, 0);
  const totalSessions = traffic.reduce((sum, t) => sum + t.sessions, 0);
  const totalPageviews = traffic.reduce((sum, t) => sum + t.pageviews, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.statsGrid}>
        <StatCard
          title="Посетители"
          value={totalVisitors.toLocaleString()}
          icon="👥"
          color={colors.primary}
        />
        <StatCard
          title="Сессии"
          value={totalSessions.toLocaleString()}
          icon="📊"
          color={colors.secondary}
        />
        <StatCard
          title="Просмотры"
          value={totalPageviews.toLocaleString()}
          icon="👁️"
          color={colors.info}
        />
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Динамика посетителей</Text>
            <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>За весь период</Text>
          </View>
        </View>
        {chartData.values.length > 0 ? (
          <LineChart
            data={chartData.values}
            labels={chartData.labels}
            color={colors.primary}
            showGrid
            showArea
          />
        ) : (
          <View style={styles.emptyChart}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyChartText, { color: colors.textSecondary }]}>Нет данных</Text>
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Детальная статистика</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{traffic.length} записей</Text>
        </View>
        {traffic.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="analytics-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Нет данных о трафике</Text>
          </View>
        ) : (
          traffic.slice(0, 10).map((item, index) => (
            <View key={index} style={[styles.trafficItem, { borderBottomColor: colors.borderLight }]}>
              <View style={styles.trafficHeader}>
                <View style={styles.trafficHeaderLeft}>
                  <View style={[styles.trafficIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="calendar" size={16} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.trafficDate, { color: colors.text }]}>
                      {new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={[styles.trafficSource, { color: colors.textSecondary }]}>{item.source}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.trafficStats}>
                <View style={styles.trafficStatItem}>
                  <Ionicons name="people" size={14} color={colors.textTertiary} />
                  <Text style={[styles.trafficStat, { color: colors.textSecondary }]}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{item.visitors}</Text> посетителей
                  </Text>
                </View>
                <View style={styles.trafficStatItem}>
                  <Ionicons name="stats-chart" size={14} color={colors.textTertiary} />
                  <Text style={[styles.trafficStat, { color: colors.textSecondary }]}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{item.sessions}</Text> сессий
                  </Text>
                </View>
                <View style={styles.trafficStatItem}>
                  <Ionicons name="eye" size={14} color={colors.textTertiary} />
                  <Text style={[styles.trafficStat, { color: colors.textSecondary }]}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{item.pageviews}</Text> просмотров
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
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
    gap: 12,
  },
  emptyChartText: {
    fontSize: 14,
  },
  section: {
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
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  sectionSubtitle: { fontSize: 13 },
  empty: {
    padding: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 14 },
  trafficItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  trafficHeader: {
    marginBottom: 12,
  },
  trafficHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trafficIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trafficDate: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  trafficSource: { fontSize: 13 },
  trafficStats: {
    gap: 8,
  },
  trafficStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trafficStat: { fontSize: 13 },
});

