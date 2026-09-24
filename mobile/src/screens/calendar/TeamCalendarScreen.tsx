import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchCalendarEvents, calendarEventEntityId, CalendarEvent, CalendarEventType } from '../../api/calendar';
import { useTheme, fonts, spacing, radius } from '../../theme/ThemeContext';
import { SkeletonList, EmptyState, showToast } from '../../components/ui';
import { Segmented, MonthCalendar } from '../../components/mg';
import { AuraBackground, GlassCard } from '../../components/glass';
import { appLocale } from '../../i18n/format';

const TYPE_LABEL: Record<CalendarEventType, string> = {
  lead_meeting: 'Встреча с лидом', project_task: 'Задача проекта', booking: 'Бронирование',
  hotel_reservation: 'Заезд в отель', custom_date: 'Дата проекта',
};
const TYPE_ICON: Record<CalendarEventType, keyof typeof Ionicons.glyphMap> = {
  lead_meeting: 'flash-outline', project_task: 'checkbox-outline', booking: 'calendar-outline',
  hotel_reservation: 'bed-outline', custom_date: 'bookmark-outline',
};
const TYPE_COLOR: Record<CalendarEventType, string> = {
  lead_meeting: '#1769d1', project_task: '#c08319', booking: '#1f8a5e', hotel_reservation: '#5a45a8', custom_date: '#888',
};
const MONTH_NAME_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function fmtTime(d: string) { return new Date(d).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }); }

function navigateToEvent(navigation: any, e: CalendarEvent) {
  const id = calendarEventEntityId(e);
  if (!id) return;
  switch (e.type) {
    case 'lead_meeting':
      return navigation.navigate('App', { screen: 'Leads', params: { screen: 'LeadDetail', params: { id } } });
    case 'project_task':
    case 'custom_date':
      return navigation.navigate('Projects', { screen: 'ProjectDetail', params: { id } });
    case 'booking':
      return navigation.navigate('Bookings', { screen: 'BookingDetail', params: { id } });
    default:
      return undefined;
  }
}

export const TeamCalendarScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: Date) => {
    setLoading(true);
    try {
      const from = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().slice(0, 10);
      const to = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString().slice(0, 10);
      setEvents(await fetchCalendarEvents(from, to));
    } catch {
      showToast('Не удалось загрузить календарь', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const eventsByDay = useMemo(() => {
    const m: Record<number, number> = {};
    events.forEach((e) => { const d = new Date(e.date).getDate(); m[d] = (m[d] || 0) + 1; });
    return m;
  }, [events]);

  const visibleEvents = useMemo(() => {
    const list = view === 'list' || selectedDay == null ? events : events.filter((e) => new Date(e.date).getDate() === selectedDay);
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }, [events, selectedDay, view]);

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
      <StatusBar barStyle="dark-content" />
      <Text style={[styles.title, { color: colors.text }]}>Календарь команды</Text>

      <View style={styles.segWrap}>
        <Segmented
          options={[{ key: 'month', label: 'Месяц' }, { key: 'list', label: 'Список' }]}
          activeKey={view}
          onChange={(k) => setView(k as 'month' | 'list')}
        />
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
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
            <EmptyState icon="calendar-outline" title="Нет событий" subtitle="На этот период ничего не запланировано" />
          ) : (
            <GlassCard variant="g2" style={styles.listCard}>
              {visibleEvents.map((e, i) => {
                const canOpen = !!calendarEventEntityId(e) && e.type !== 'hotel_reservation';
                const Row = canOpen ? TouchableOpacity : View;
                return (
                  <Row
                    key={e.id}
                    style={[styles.row, { borderBottomColor: colors.line3, borderBottomWidth: i < visibleEvents.length - 1 ? 1 : 0 }]}
                    onPress={canOpen ? () => navigateToEvent(navigation, e) : undefined}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.typeIco, { backgroundColor: TYPE_COLOR[e.type] + '20' }]}>
                      <Ionicons name={TYPE_ICON[e.type]} size={16} color={TYPE_COLOR[e.type]} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{e.title}</Text>
                      <Text style={[styles.rowMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                        {TYPE_LABEL[e.type]}{e.subtitle ? ` · ${e.subtitle}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.time, { color: colors.textTertiary, fontFamily: fonts.mono }]}>{fmtTime(e.date)}</Text>
                    {canOpen && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
                  </Row>
                );
              })}
            </GlassCard>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 24, fontFamily: fonts.bold, letterSpacing: -0.4, paddingHorizontal: spacing.lg, marginBottom: 4 },
  segWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  calCard: { borderRadius: 22 },
  calCardContent: { padding: spacing.lg },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: spacing.xs },
  listTitle: { fontSize: 15, fontFamily: fonts.semibold },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  chipTxt: { fontSize: 11.5, fontFamily: fonts.medium },
  listCard: { borderRadius: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  typeIco: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14, fontFamily: fonts.semibold },
  rowMeta: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  time: { fontSize: 11 },
});
