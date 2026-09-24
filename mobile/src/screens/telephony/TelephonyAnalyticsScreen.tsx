import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchTelephonyAnalytics, TelephonyAnalytics } from '../../api/telephony';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonCard, showToast } from '../../components/ui';
import { StatGrid2, FunnelBars, TapChart } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function shortDate(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export const TelephonyAnalyticsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<TelephonyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchTelephonyAnalytics(30)
      .then(setData)
      .catch(() => showToast('Не удалось загрузить аналитику', { variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxHour = data ? Math.max(1, ...data.hourlyLoad.map((h) => h.count)) : 1;
  const managerRows = data
    ? [...data.byManager].sort((a, b) => (b.calls + b.sms) - (a.calls + a.sms)).map((m) => ({
        label: m.name, value: m.calls + m.sms, displayValue: `${m.calls + m.sms}`,
      }))
    : [];
  const sentimentRows = data
    ? [
        { label: 'Позитивный', value: data.sentiment.positive, displayValue: String(data.sentiment.positive), color: colors.success },
        { label: 'Нейтральный', value: data.sentiment.neutral, displayValue: String(data.sentiment.neutral), color: colors.warning },
        { label: 'Негативный', value: data.sentiment.negative, displayValue: String(data.sentiment.negative), color: colors.error },
      ].filter((r) => r.value > 0)
    : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Телефония</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.largeTitle, { color: colors.text }]}>Аналитика</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>За последние 30 дней</Text>

      {loading || !data ? (
        <View style={{ padding: spacing.lg, flexDirection: 'row', gap: spacing.md }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <StatGrid2
            items={[
              { label: 'Звонков', value: String(data.kpis.totalCalls) },
              { label: 'SMS', value: String(data.kpis.totalSms) },
              { label: 'Дозвон', value: `${Math.round(data.kpis.pickupRate)}%` },
              { label: 'Ср. длительность', value: fmtDuration(data.kpis.avgCallDurationSeconds) },
            ]}
          />

          {data.dailySeries.length > 1 && (
            <GlassCard variant="g" style={styles.widget}>
              <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ДИНАМИКА ЗВОНКОВ И SMS</Text>
              <TapChart
                dates={data.dailySeries.map((d) => d.date)}
                series={[
                  { key: 'calls', label: 'Звонки', color: colors.text, values: data.dailySeries.map((d) => d.calls) },
                  { key: 'sms', label: 'SMS', color: colors.info, values: data.dailySeries.map((d) => d.sms) },
                ]}
                formatDate={shortDate}
              />
            </GlassCard>
          )}

          {managerRows.length > 0 && (
            <GlassCard variant="g" style={styles.widget}>
              <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ПО МЕНЕДЖЕРАМ</Text>
              <FunnelBars rows={managerRows} />
            </GlassCard>
          )}

          {sentimentRows.length > 0 && (
            <GlassCard variant="g" style={styles.widget}>
              <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ТОНАЛЬНОСТЬ РАЗГОВОРОВ</Text>
              <FunnelBars rows={sentimentRows} />
              <Text style={[styles.sentimentNote, { color: colors.textTertiary }]}>из {data.sentiment.analyzed} разобранных записей</Text>
              {data.sentiment.topNegativeTopics.length > 0 && (
                <Text style={[styles.sentimentNote, { color: colors.textSecondary, marginTop: 6 }]}>
                  Топ негативных тем: {data.sentiment.topNegativeTopics.map((t) => t.topic).join(', ')}
                </Text>
              )}
            </GlassCard>
          )}

          {data.hourlyLoad.some((h) => h.count > 0) && (
            <GlassCard variant="g" style={styles.widget}>
              <Text style={[styles.widgetOverline, { color: colors.textSecondary }]}>ЗАГРУЗКА ПО ЧАСАМ</Text>
              <View style={styles.hourRow}>
                {data.hourlyLoad.map((h) => (
                  <View key={h.hour} style={styles.hourCol}>
                    <View style={[styles.hourBar, { height: Math.max(2, (h.count / maxHour) * 56), backgroundColor: colors.accent, opacity: 0.35 + (h.count / maxHour) * 0.65 }]} />
                  </View>
                ))}
              </View>
              <View style={styles.hourLabelRow}>
                {data.hourlyLoad.map((h) => (
                  <Text key={h.hour} style={[styles.hourLabel, { color: colors.textTertiary }]}>{h.hour % 3 === 0 ? h.hour : ''}</Text>
                ))}
              </View>
            </GlassCard>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  largeTitle: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 2 },
  sub: { fontSize: 12, paddingHorizontal: spacing.lg },
  widget: { borderRadius: radius.xxl, marginTop: spacing.sm, padding: spacing.lg },
  widgetOverline: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  sentimentNote: { fontSize: 11, marginTop: 8 },
  hourRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 56 },
  hourCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 56 },
  hourBar: { width: '100%', borderRadius: 2 },
  hourLabelRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  hourLabel: { flex: 1, textAlign: 'center', fontSize: 8.5, fontFamily: fonts.mono },
});
