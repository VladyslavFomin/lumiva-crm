import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { fetchUtms, Utm } from '../../api/marketing';

export const UtmsScreen: React.FC = () => {
  const { colors } = useTheme();
  const [utms, setUtms] = useState<Utm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await fetchUtms();
      setUtms(data);
    } catch (error) {
      console.error('Failed to load UTMs:', error);
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
        data={utms}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={styles.utmHeader}>
              <View style={[styles.utmIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="link" size={20} color={colors.primary} />
              </View>
              <View style={styles.utmInfo}>
                <Text style={[styles.utmSource, { color: colors.text }]}>{item.source}</Text>
                <Text style={[styles.utmMedium, { color: colors.textSecondary }]}>{item.medium}</Text>
              </View>
            </View>

            <View style={[styles.utmDetails, { borderTopColor: colors.borderLight }]}>
              <View style={styles.utmDetail}>
                <Text style={[styles.utmDetailLabel, { color: colors.textSecondary }]}>Кампания</Text>
                <Text style={[styles.utmDetailValue, { color: colors.text }]}>{item.campaign}</Text>
              </View>
              {item.term && (
                <View style={styles.utmDetail}>
                  <Text style={[styles.utmDetailLabel, { color: colors.textSecondary }]}>Термин</Text>
                  <Text style={[styles.utmDetailValue, { color: colors.text }]}>{item.term}</Text>
                </View>
              )}
            </View>

            <View style={[styles.utmStats, { borderTopColor: colors.borderLight }]}>
              <View style={styles.utmStat}>
                <Ionicons name="eye" size={16} color={colors.textTertiary} />
                <Text style={[styles.utmStatValue, { color: colors.text }]}>{item.clicks}</Text>
                <Text style={[styles.utmStatLabel, { color: colors.textSecondary }]}>Клики</Text>
              </View>
              <View style={styles.utmStat}>
                <Ionicons name="checkmark-circle" size={16} color={colors.textTertiary} />
                <Text style={[styles.utmStatValue, { color: colors.text }]}>{item.conversions}</Text>
                <Text style={[styles.utmStatLabel, { color: colors.textSecondary }]}>Конверсии</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="link-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Нет UTM меток</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>UTM метки будут отображаться здесь</Text>
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
  utmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  utmIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  utmInfo: { flex: 1 },
  utmSource: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  utmMedium: { fontSize: 14 },
  utmDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    marginBottom: 16,
  },
  utmDetail: { flex: 1, minWidth: '45%' },
  utmDetailLabel: { fontSize: 12, marginBottom: 4 },
  utmDetailValue: { fontSize: 15, fontWeight: '600' },
  utmStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  utmStat: {
    alignItems: 'center',
    gap: 4,
  },
  utmStatValue: { fontSize: 18, fontWeight: '700' },
  utmStatLabel: { fontSize: 12 },
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



