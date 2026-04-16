import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchSegments, Segment } from '../../api/marketing';

export const SegmentsScreen: React.FC = () => {
  const { colors } = useTheme();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await fetchSegments();
      setSegments(data);
    } catch (error) {
      console.error('Failed to load segments:', error);
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={segments}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => {/* TODO: Navigate to create */}}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addButtonText}>Создать сегмент</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
            activeOpacity={0.9}
          >
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
            </View>
            <View style={[styles.segmentFooter, { borderTopColor: colors.borderLight }]}>
              <View style={styles.segmentStat}>
                <Ionicons name="person" size={16} color={colors.textTertiary} />
                <Text style={[styles.segmentStatValue, { color: colors.text }]}>{item.contactsCount}</Text>
                <Text style={[styles.segmentStatLabel, { color: colors.textSecondary }]}>контактов</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Нет сегментов</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Создайте первый сегмент для таргетинга</Text>
          </View>
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
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
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
  segmentName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  segmentDescription: { fontSize: 14, lineHeight: 20 },
  segmentFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
  },
  segmentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentStatValue: { fontSize: 18, fontWeight: '700' },
  segmentStatLabel: { fontSize: 14 },
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



