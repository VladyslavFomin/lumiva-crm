import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchSegment, runSegment, Segment, SegmentMatchedLead } from '../../api/marketing';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, Button, showToast } from '../../components/ui';
import { Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const STATUS_LABEL: Record<string, string> = {
  new: 'Новый', in_progress: 'В работе', waiting: 'Ожидает', won: 'Успех', lost: 'Проигран',
};
const STATUS_TONE: Record<string, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  new: 'acc', in_progress: 'default', waiting: 'warn', won: 'pos', lost: 'neg',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

export const SegmentDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params;

  const [segment, setSegment] = useState<Segment | null>(null);
  const [matched, setMatched] = useState<SegmentMatchedLead[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchSegment(id).then(setSegment).catch(() => showToast('Не удалось загрузить сегмент', { variant: 'error' })).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const leads = await runSegment(id);
      setMatched(leads);
      load();
      showToast(`Найдено лидов: ${leads.length}`, { variant: 'success' });
    } catch {
      showToast('Не удалось запустить сегмент', { variant: 'error' });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }
  if (!segment) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>Сегмент не найден</Text>
      </View>
    );
  }

  const filterRows = [
    segment.leadStatuses?.[0] && { label: 'Статус', value: STATUS_LABEL[segment.leadStatuses[0]] || segment.leadStatuses[0] },
    segment.source && { label: 'Источник', value: segment.source },
    segment.country && { label: 'Страна', value: segment.country },
    segment.manager && { label: 'Ответственный', value: segment.manager },
    (segment.createdFrom || segment.createdTo) && { label: 'Период создания', value: `${segment.createdFrom || '…'} — ${segment.createdTo || '…'}` },
    !!segment.trafficPresets?.length && { label: 'Кампании (UTM)', value: `${segment.trafficPresets!.length} шт. — детали на ПК` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuraBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backTxt, { color: colors.text, fontFamily: fonts.regular }]}>Сегменты</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroName, { color: colors.text }]}>{segment.name}</Text>
            {segment.description && <Text style={[styles.heroSub, { color: colors.textSecondary }]}>{segment.description}</Text>}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <Button label={running ? 'Запуск…' : 'Запустить сегмент'} variant="accent" fullWidth loading={running} onPress={handleRun} />
        </View>

        {filterRows.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ФИЛЬТРЫ</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {filterRows.map((r, i) => (
                <View key={i} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < filterRows.length - 1 ? 1 : 0 }]}>
                  <Text style={[styles.propLabel, { color: colors.textSecondary }]}>{r.label}</Text>
                  <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{r.value}</Text>
                </View>
              ))}
            </GlassCard>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ПОСЛЕДНИЙ ЗАПУСК</Text>
        <GlassCard variant="g2" style={[styles.listCard, { padding: spacing.lg }]}>
          <Text style={{ color: colors.text, fontSize: 13.5 }}>
            {segment.lastRunAt ? `${fmtDate(segment.lastRunAt)} · найдено ${segment.lastMatchedCount ?? 0} лидов` : 'Сегмент ещё ни разу не запускался'}
          </Text>
        </GlassCard>

        {matched && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>НАЙДЕННЫЕ ЛИДЫ ({matched.length})</Text>
            <GlassCard variant="g2" style={styles.listCard}>
              {matched.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13, padding: spacing.lg }}>Ничего не найдено по этим фильтрам</Text>
              ) : matched.map((l, i) => (
                <View key={l.id} style={[styles.propRow, { borderBottomColor: colors.line3, borderBottomWidth: i < matched.length - 1 ? 1 : 0 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.propValue, { color: colors.text }]} numberOfLines={1}>{l.name || 'Без имени'}</Text>
                    <Text style={[styles.propLabel, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>{l.phone || l.email || '—'}</Text>
                  </View>
                  <Pill label={STATUS_LABEL[l.status] || l.status} tone={STATUS_TONE[l.status] || 'default'} />
                </View>
              ))}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt: { fontSize: 15 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heroName: { fontSize: 20, fontFamily: fonts.bold, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  sectionTitle: { fontSize: 11, fontFamily: fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 6 },
  listCard: { borderRadius: radius.xxl, marginHorizontal: spacing.lg, overflow: 'hidden' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  propLabel: { fontSize: 11, fontFamily: fonts.medium },
  propValue: { fontSize: 14, fontFamily: fonts.medium },
});
