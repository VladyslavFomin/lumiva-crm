import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchCampaigns, Campaign } from '../../api/marketing';
import { BarChart, StatCard } from '../../components/Charts';

export const CampaignsScreen: React.FC = () => {
  const { colors } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await fetchCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
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

  const campaignStats = useMemo(() => {
    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    return { totalBudget, totalSpent, totalClicks, totalConversions };
  }, [campaigns]);

  const chartData = useMemo(() => {
    return campaigns.slice(0, 6).map((c) => ({
      label: c.name.length > 10 ? c.name.substring(0, 10) + '...' : c.name,
      value: c.clicks,
      color: colors.primary,
    }));
  }, [campaigns, colors.primary]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'активна':
        return colors.success;
      case 'paused':
      case 'приостановлена':
        return colors.warning;
      case 'completed':
      case 'завершена':
        return colors.textSecondary;
      default:
        return colors.primary;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.statsGrid}>
        <StatCard
          title="Бюджет"
          value={`${campaignStats.totalBudget.toLocaleString()} €`}
          subtitle={`Потрачено: ${campaignStats.totalSpent.toLocaleString()} €`}
          icon="💰"
          color={colors.primary}
        />
        <StatCard
          title="Клики"
          value={campaignStats.totalClicks.toLocaleString()}
          subtitle="Всего кликов"
          icon="👆"
          color={colors.secondary}
        />
        <StatCard
          title="Конверсии"
          value={campaignStats.totalConversions.toLocaleString()}
          subtitle="Успешных конверсий"
          icon="🎯"
          color={colors.success}
        />
      </View>

      {campaigns.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>Топ кампаний по кликам</Text>
          <BarChart data={chartData} />
        </View>
      )}

      {campaigns.map((item) => {
        const statusColor = getStatusColor(item.status);
        const spentPercent = item.budget > 0 ? Math.round((item.spent / item.budget) * 100) : 0;
        return (
          <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.campaignName, { color: colors.text }]}>{item.name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Бюджет</Text>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{item.budget.toLocaleString()} €</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Потрачено</Text>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{item.spent.toLocaleString()} €</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Показы</Text>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{item.impressions.toLocaleString()}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Клики</Text>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{item.clicks.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: colors.borderLight }]}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, spentPercent)}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                  Потрачено {spentPercent}% от бюджета
                </Text>
              </View>

              <View style={[styles.dates, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                  Начало: {new Date(item.startDate).toLocaleDateString()}
                </Text>
                {item.endDate && (
                  <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                    Конец: {new Date(item.endDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          );
      })}

      {campaigns.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="megaphone-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Нет кампаний</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Создайте первую рекламную кампанию</Text>
          </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
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
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  list: { padding: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  campaignName: { fontSize: 18, fontWeight: '700', flex: 1 },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  metric: { flex: 1, minWidth: '45%' },
  metricLabel: { fontSize: 12, marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  progressContainer: { marginBottom: 16 },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressText: { fontSize: 12 },
  dates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  dateText: { fontSize: 12 },
  emptyState: {
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 32,
  },
  emptyText: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
});

