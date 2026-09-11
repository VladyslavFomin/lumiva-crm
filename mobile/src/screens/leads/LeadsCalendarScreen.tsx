import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from './LeadsStack';
import { fetchLeads, Lead, LeadStatusCode } from '../../api/leads';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { AvatarInitials, SkeletonList, EmptyState, Button, showToast } from '../../components/ui';
import { Segmented, MonthCalendar, Pill } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadsCalendar'>;

const STATUS_TONE: Record<LeadStatusCode, 'acc' | 'default' | 'warn' | 'pos' | 'neg'> = {
  new: 'acc', in_progress: 'default', waiting: 'warn', won: 'pos', lost: 'neg',
};
const STATUS_LABEL: Record<LeadStatusCode, string> = {
  new: 'Новый', in_progress: 'В работе', waiting: 'Ожидает', won: 'Выиграно', lost: 'Проиграно',
};
const MONTH_NAME_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }

export const LeadsCalendarScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'month' | 'list'>('month');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setLeads(await fetchLeads());
    } catch {
      showToast('Не удалось загрузить лиды', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const leadsInMonth = useMemo(() => {
    return leads.filter((l) => {
      const d = new Date(l.createdAt);
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
    });
  }, [leads, month]);

  const eventsByDay = useMemo(() => {
    const m: Record<number, number> = {};
    leadsInMonth.forEach((l) => {
      const day = new Date(l.createdAt).getDate();
      m[day] = (m[day] || 0) + 1;
    });
    return m;
  }, [leadsInMonth]);

  const visibleLeads = useMemo(() => {
    if (view === 'list' || selectedDay == null) return leadsInMonth;
    return leadsInMonth.filter((l) => new Date(l.createdAt).getDate() === selectedDay);
  }, [leadsInMonth, selectedDay, view]);

  const changeMonth = (delta: number) => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setSelectedDay(null);
  };

  const listTitle = view === 'month' && selectedDay != null
    ? `${selectedDay} ${MONTH_NAME_GEN[month.getMonth()]}`
    : 'Все события месяца';

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.backRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('LeadsList')} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Календарь лидов</Text>
            {!loading && <Text style={[styles.sub, { color: colors.textSecondary }]}>{leadsInMonth.length} событий в месяце</Text>}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.segWrap}>
        <Segmented
          options={[{ key: 'month', label: 'Месяц' }, { key: 'list', label: 'Список' }]}
          activeKey={view}
          onChange={(k) => setView(k as 'month' | 'list')}
        />
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.ink} />}
          showsVerticalScrollIndicator={false}
        >
          {view === 'month' && (
            <GlassCard variant="g" style={styles.calCard} contentStyle={styles.calCardContent}>
              <MonthCalendar
                month={month}
                eventsByDay={eventsByDay}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onPrevMonth={() => changeMonth(-1)}
                onNextMonth={() => changeMonth(1)}
              />
            </GlassCard>
          )}

          <View style={styles.listHead}>
            <Text style={[styles.listTitle, { color: colors.text }]}>{listTitle}</Text>
            {view === 'month' && selectedDay != null && (
              <TouchableOpacity onPress={() => setSelectedDay(null)} style={[styles.chip, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.chipTxt, { color: colors.text }]}>Весь месяц</Text>
              </TouchableOpacity>
            )}
          </View>

          {visibleLeads.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="На этот день пусто"
              subtitle="Свободный день — можно запланировать звонок или встречу."
              ctaLabel="Добавить лид"
              onCta={() => navigation.navigate('LeadCreate')}
            />
          ) : (
            <>
              {visibleLeads.map((l) => (
                <GlassCard key={l.id} variant="flat" style={styles.row} contentStyle={styles.rowInner}>
                  <TouchableOpacity
                    style={styles.rowTouchable}
                    onPress={() => navigation.navigate('LeadDetail', { id: l.id })}
                    activeOpacity={0.7}
                  >
                    <AvatarInitials name={l.name || 'Без имени'} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{l.name || 'Без имени'}</Text>
                      <Text style={[styles.rowMeta, { color: colors.textTertiary, fontFamily: fonts.mono }]} numberOfLines={1}>
                        {new Date(l.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · {l.channel || '—'}
                      </Text>
                    </View>
                    <Pill label={STATUS_LABEL[l.status]} tone={STATUS_TONE[l.status]} />
                  </TouchableOpacity>
                </GlassCard>
              ))}
              <Button label="Добавить лид" variant="secondary" size="sm" fullWidth onPress={() => navigation.navigate('LeadCreate')} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 17, fontFamily: fonts.semibold, letterSpacing: -0.3 },
  sub: { fontSize: 11.5, marginTop: 1 },
  backRow: { paddingHorizontal: spacing.lg, marginBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  calCard: { borderRadius: 22 },
  calCardContent: { padding: spacing.lg },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: spacing.xs },
  listTitle: { fontSize: 15, fontFamily: fonts.semibold },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  chipTxt: { fontSize: 11.5, fontFamily: fonts.medium },
  row: { borderRadius: radius.xl },
  rowInner: { flex: 1 },
  rowTouchable: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, marginTop: 2 },
});
