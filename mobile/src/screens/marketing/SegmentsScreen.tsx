import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, fonts } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchSegments, Segment } from '../../api/marketing';
import { AuraBackground, GlassCard } from '../../components/glass';

function relTime(dateStr: string | null): string {
  if (!dateStr) return 'ни разу не запускался';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'запущен сегодня';
  if (days === 1) return 'запущен вчера';
  return `запущен ${days} дн. назад`;
}

export const SegmentsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setSegments(await fetchSegments());
    } catch (error) {
      console.error('Failed to load segments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { const unsub = navigation.addListener('focus', () => load()); return unsub; }, [navigation, load]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AuraBackground />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <FlatList
        data={segments}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('SegmentCreate')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addButtonText}>Создать сегмент</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('SegmentDetail', { id: item.id })}>
            <GlassCard variant="flat" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.segmentIcon, { backgroundColor: colors.secondary + '15' }]}>
                  <Ionicons name="people" size={24} color={colors.secondary} />
                </View>
                <View style={styles.segmentInfo}>
                  <Text style={[styles.segmentName, { color: colors.text }]}>{item.name}</Text>
                  {item.description && (
                    <Text style={[styles.segmentDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </View>
              <View style={[styles.segmentFooter, { borderTopColor: colors.borderLight }]}>
                <View style={styles.segmentStat}>
                  <Ionicons name="person" size={16} color={colors.textTertiary} />
                  <Text style={[styles.segmentStatValue, { color: colors.text }]}>{item.lastMatchedCount ?? '—'}</Text>
                  <Text style={[styles.segmentStatLabel, { color: colors.textSecondary }]}>{item.lastMatchedCount != null ? 'лидов при запуске' : ''}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Text style={[styles.segmentStatLabel, { color: colors.textTertiary }]}>{relTime(item.lastRunAt)}</Text>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <GlassCard variant="g" style={styles.emptyState} contentStyle={styles.emptyStateContent}>
            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Нет сегментов</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Создайте первый сегмент для таргетинга</Text>
          </GlassCard>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  segmentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  segmentInfo: { flex: 1 },
  segmentName: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 4 },
  segmentDescription: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  segmentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  segmentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentStatValue: { fontSize: 18, fontFamily: fonts.bold },
  segmentStatLabel: { fontSize: 12, fontFamily: fonts.regular },
  emptyState: {
    borderRadius: 24,
    padding: 48,
    marginTop: 32,
  },
  emptyStateContent: {
    alignItems: 'center',
  },
  emptyText: { fontSize: 20, fontFamily: fonts.bold, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, fontFamily: fonts.regular, textAlign: 'center' },
});
