import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { fetchLeadStats, LeadStats } from '../../api/leads';

export const LeadsAnalyticsScreen: React.FC = () => {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const s = await fetchLeadStats();
        setStats(s);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const total = stats?.total || 0;
  const won = stats?.byStatus?.find((s) => s.status === 'won')?.count || 0;
  const lost = stats?.byStatus?.find((s) => s.status === 'lost')?.count || 0;
  const newCount = stats?.byStatus?.find((s) => s.status === 'new')?.count || 0;
  const conversion = total ? Math.round((won / total) * 100) : 0;

  const topChannels = useMemo(() => (stats?.bySource || []).slice(0, 6), [stats]);
  const topManagers = useMemo(() => (stats?.byManager || []).slice(0, 6), [stats]);
  const byStatus = useMemo(() => stats?.byStatus || [], [stats]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Аналитика лидов</Text>

      <View style={styles.grid}>
        <KpiCard label="Всего лидов" value={total} />
        <KpiCard label="Новые" value={newCount} />
        <KpiCard label="Выигранные" value={won} accent />
        <KpiCard label="Проигранные" value={lost} />
        <KpiCard label="Конверсия" value={conversion} suffix="%" />
      </View>

      <Section title="Статусы">
        {byStatus.length === 0 ? (
          <Empty text="Нет данных" />
        ) : (
          byStatus.map((s) => (
            <BarRow key={s.status} label={statusLabel(s.status)} value={s.count} />
          ))
        )}
      </Section>

      <Section title="Каналы">
        {topChannels.length === 0 ? (
          <Empty text="Нет данных" />
        ) : (
          topChannels.map((c) => (
            <BarRow key={c.source} label={c.source || '—'} value={c.count} color="#22c55e" />
          ))
        )}
      </Section>

      <Section title="Менеджеры">
        {topManagers.length === 0 ? (
          <Empty text="Нет данных" />
        ) : (
          topManagers.map((m) => (
            <View key={m.manager} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>{m.manager || '—'}</Text>
                <Text style={styles.rowSub}>Успех: {m.won} · Потери: {m.lost}</Text>
              </View>
              <Text style={styles.value}>{m.total}</Text>
            </View>
          ))
        )}
      </Section>
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

const KpiCard: React.FC<{ label: string; value: number; suffix?: string; accent?: boolean }> = ({ label, value, suffix, accent }) => (
  <View style={[styles.card, accent && styles.cardAccent]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.kpiValue}>
      {value}
      {suffix ? ` ${suffix}` : ''}
    </Text>
  </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const BarRow: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color = '#0ea5e9' }) => (
  <View style={{ marginVertical: 8 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={styles.rowSub}>{value}</Text>
    </View>
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(100, value * 10)}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.empty}>
    <Text style={styles.rowSub}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  content: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  grid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '48%',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  cardAccent: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' },
  kpiValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  value: { fontSize: 14, fontWeight: '700', color: '#111827' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  progressFill: { height: 8, borderRadius: 4 },
  empty: { paddingVertical: 6 },
});

export default LeadsAnalyticsScreen;
