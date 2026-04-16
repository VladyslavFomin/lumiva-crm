import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { fetchSales } from '../../api/sales';
import { fetchLeads, Lead } from '../../api/leads';

interface LeadRevenue {
  leadId: string;
  leadName: string;
  manager?: string | null;
  amount: number;
  projects: Set<string>;
}

export const LeadsRoiScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [leadRevenue, setLeadRevenue] = useState<LeadRevenue[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sales, leads] = await Promise.all([fetchSales(), fetchLeads()]);
        const leadMap: Record<string, Lead> = {};
        leads.forEach((l) => { leadMap[l.id] = l; });

        const agg: Record<string, LeadRevenue> = {};
        sales.forEach((s) => {
          if (!s.leadId) return;
          if (!agg[s.leadId]) {
            const lead = leadMap[s.leadId];
            agg[s.leadId] = {
              leadId: s.leadId,
              leadName: lead?.name || 'Без имени',
              manager: lead?.assignedTo,
              amount: 0,
              projects: new Set<string>(),
            };
          }
          agg[s.leadId].amount += s.amount || 0;
          if (s.projectId) agg[s.leadId].projects.add(s.projectId);
        });

        setLeadRevenue(Object.values(agg));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalRevenue = useMemo(() => leadRevenue.reduce((sum, r) => sum + r.amount, 0), [leadRevenue]);
  const leadsWithRevenue = leadRevenue.length;
  const projectsCount = useMemo(
    () => Array.from(leadRevenue.reduce((set, r) => { r.projects.forEach((p) => set.add(p)); return set; }, new Set<string>())).length,
    [leadRevenue],
  );
  const avgCheck = leadsWithRevenue ? Math.round(totalRevenue / leadsWithRevenue) : 0;

  const topLeads = useMemo(() => [...leadRevenue].sort((a, b) => b.amount - a.amount).slice(0, 5), [leadRevenue]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>ROI по лидам</Text>

      <View style={styles.grid}>
        <KpiCard label="Общий доход" value={totalRevenue} money />
        <KpiCard label="Лидов с доходом" value={leadsWithRevenue} />
        <KpiCard label="Средний чек" value={avgCheck} money />
        <KpiCard label="Проектов" value={projectsCount} />
      </View>

      <Section title="Топ лидов по доходу">
        {topLeads.length === 0 ? (
          <Empty text="Нет данных" />
        ) : (
          topLeads.map((l) => (
            <BarRow key={l.leadId} label={l.leadName} value={l.amount} trailing={l.manager || '—'} color="#22c55e" />
          ))
        )}
      </Section>

      <Section title="Лиды и доход">
        {leadRevenue.length === 0 ? (
          <Empty text="Нет данных" />
        ) : (
          leadRevenue.map((l) => (
            <View key={l.leadId} style={styles.row}>
              <View style={{ flex: 1.2 }}>
                <Text style={styles.rowTitle}>{l.leadName}</Text>
                <Text style={styles.rowSub}>{l.manager || '—'}</Text>
              </View>
              <Text style={[styles.rowTitle, { flex: 0.6, textAlign: 'right' }]}>{l.amount.toLocaleString()} €</Text>
              <Text style={[styles.rowSub, { flex: 0.4, textAlign: 'right' }]}>{l.projects.size || 0} проектов</Text>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
};

const KpiCard: React.FC<{ label: string; value: number; money?: boolean }> = ({ label, value, money }) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.kpiValue}>{money ? `${value.toLocaleString()} €` : value}</Text>
  </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const BarRow: React.FC<{ label: string; value: number; trailing?: string; color?: string }> = ({ label, value, trailing, color = '#0ea5e9' }) => (
  <View style={{ marginVertical: 8 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={styles.rowSub}>{trailing}</Text>
    </View>
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(100, value / (value ? value : 1) * 100)}%`, backgroundColor: color }]} />
    </View>
    <Text style={styles.rowSub}>{value.toLocaleString()} €</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  progressFill: { height: 8, borderRadius: 4 },
  empty: { paddingVertical: 6 },
});

export default LeadsRoiScreen;
