import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProjectsStackParamList } from './ProjectsStack';
import { fetchCalendarEvents, calendarEventEntityId, CalendarEvent } from '../../api/calendar';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, Button, showToast } from '../../components/ui';
import { Segmented, MonthCalendar } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectsCalendar'>;

const MONTH_NAME_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { project_task: 'checkbox-outline', custom_date: 'bookmark-outline' };

function fmtTime(d: string) { return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }

export const ProjectsCalendarScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'month' | 'list'>('month');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const load = useCallback(async (m: Date, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const from = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().slice(0, 10);
      const to = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString().slice(0, 10);
      const all = await fetchCalendarEvents(from, to);
      setEvents(all.filter((e) => e.type === 'project_task' || e.type === 'custom_date'));
    } catch {
      showToast('Не удалось загрузить события', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const eventsByDay = useMemo(() => {
    const m: Record<number, number> = {};
    events.forEach((e) => { const d = new Date(e.date).getDate(); m[d] = (m[d] || 0) + 1; });
    return m;
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (view === 'list' || selectedDay == null) return events;
    return events.filter((e) => new Date(e.date).getDate() === selectedDay);
  }, [events, selectedDay, view]);

  const changeMonth = (delta: number) => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setSelectedDay(null);
  };

  const openEvent = (e: CalendarEvent) => {
    const id = calendarEventEntityId(e);
    if (id) navigation.navigate('ProjectDetail', { id });
  };

  const listTitle = view === 'month' && selectedDay != null
    ? `${selectedDay} ${MONTH_NAME_GEN[month.getMonth()]}`
    : 'Все события месяца';

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <AuraBackground />
      <View style={styles.backRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Календарь проектов</Text>
            {!loading && <Text style={[styles.sub, { color: colors.textSecondary }]}>{events.length} событий в месяце</Text>}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(month, true)} tintColor={colors.ink} />}
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

          {visibleEvents.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="На этот день пусто"
              subtitle="Свободный день — задач и дат проектов не запланировано."
              ctaLabel="Создать проект"
              onCta={() => navigation.navigate('ProjectCreate')}
            />
          ) : (
            <>
              {visibleEvents.map((e) => (
                <GlassCard key={e.id} variant="flat" style={styles.row} contentStyle={styles.rowInner}>
                  <TouchableOpacity style={styles.rowTouchable} onPress={() => openEvent(e)} activeOpacity={0.7}>
                    <View style={[styles.icon, { backgroundColor: colors.surfaceVariant }]}>
                      <Ionicons name={TYPE_ICON[e.type] || 'bookmark-outline'} size={15} color={colors.text} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{e.title}</Text>
                      <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>{e.subtitle || (e.type === 'project_task' ? 'Задача проекта' : 'Дата проекта')}</Text>
                    </View>
                    <Text style={[styles.rowTime, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{fmtTime(e.date)}</Text>
                  </TouchableOpacity>
                </GlassCard>
              ))}
              <Button label="Добавить проект" variant="secondary" size="sm" fullWidth onPress={() => navigation.navigate('ProjectCreate')} />
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
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, marginTop: 2 },
  rowTime: { fontSize: 12 },
});
