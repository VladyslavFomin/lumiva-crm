import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { fetchLeads, Lead, LeadStatusCode } from '../../api/leads';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { useTheme } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadsList'>;

const STATUS_ORDER: LeadStatusCode[] = ['new', 'in_progress', 'waiting', 'won', 'lost'];
const STATUS_LABEL: Record<LeadStatusCode, string> = {
  new: 'Новые',
  in_progress: 'В работе',
  waiting: 'Ожидают',
  won: 'Выигранные',
  lost: 'Проигранные',
};
const STATUS_COLOR: Record<LeadStatusCode, string> = {
  new: '#38bdf8',
  in_progress: '#fbbf24',
  waiting: '#a78bfa',
  won: '#22c55e',
  lost: '#ef4444',
};

export const LeadsListScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchLeads();
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const base: Record<LeadStatusCode, Lead[]> = {
      new: [],
      in_progress: [],
      waiting: [],
      won: [],
      lost: [],
    };
    leads.forEach((l) => {
      const status = (l.status || 'new') as LeadStatusCode;
      base[status] = [...base[status], l];
    });
    return base;
  }, [leads]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Лиды</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('LeadCreate')}>
          <Text style={styles.addText}>+ Новый лид</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.analyticsBtn, { backgroundColor: colors.card, borderColor: colors.primary }]} onPress={() => navigation.navigate('LeadsAnalytics')}>
            <Text style={[styles.analyticsText, { color: colors.primary }]}>Аналитика</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.analyticsBtn, { backgroundColor: colors.card, borderColor: colors.primary }]} onPress={() => navigation.navigate('LeadsRoi')}>
            <Text style={[styles.analyticsText, { color: colors.primary }]}>ROI</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        contentContainerStyle={styles.board}
      >
        {STATUS_ORDER.map((status) => (
          <View key={status} style={[styles.column, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.columnHeader}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
              <Text style={[styles.columnTitle, { color: colors.text }]}>{STATUS_LABEL[status]}</Text>
              <View style={[styles.counter, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.counterText, { color: colors.text }]}>{grouped[status]?.length || 0}</Text>
              </View>
            </View>

            {grouped[status]?.length ? (
              grouped[status].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('LeadDetail', { id: item.id })}
                  style={[styles.card, { backgroundColor: colors.surfaceVariant, borderColor: colors.borderLight }]}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name || 'Без имени'}</Text>
                  <Text style={[styles.channel, { color: colors.primary }]} numberOfLines={1}>{item.channel || '—'}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{item.email || item.phone || '—'}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={[styles.emptyCard, { borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Нет лидов</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  addBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  analyticsBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  analyticsText: { fontWeight: '700', fontSize: 13 },
  board: { padding: 12, gap: 12 },
  column: {
    width: 260,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  columnHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  columnTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  counter: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  counterText: { fontSize: 12, fontWeight: '700' },
  card: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: '700' },
  channel: { marginTop: 4, fontSize: 13, fontWeight: '600' },
  meta: { marginTop: 2, fontSize: 12 },
  emptyCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyText: { fontSize: 12 },
});
